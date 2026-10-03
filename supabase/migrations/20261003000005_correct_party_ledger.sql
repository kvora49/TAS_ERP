-- =============================================================================
-- Migration: 20260928000005_rpc_fn_party_ledger.sql
-- Description: PostgreSQL RPC function for /api/parties/[id]/ledger.
-- Replaces 16 parallel queries and ~500 lines of in-memory JavaScript
-- array allocations, sorting, unioning, and running-balance reduction with
-- a single database-level CTE & window function execution.
-- STABLE read-only computation reduces edge/serverless CPU; it does not cache results.
-- =============================================================================

-- Replaces route-level raw-row fetch/group/sum/reduce work with PostgreSQL aggregation
-- to reduce application CPU and transferred intermediate rows for edge/serverless compatibility.
-- Read-only STABLE SECURITY INVOKER preserves caller RLS.
CREATE OR REPLACE FUNCTION public.fn_party_ledger(
  p_business_id uuid,
  p_party_id uuid,
  p_bill_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_party jsonb;
  v_is_customer_only boolean := false;
  v_party_type text[];
  v_ob_val numeric := 0;
  v_ob_date text;
  v_remaining_advance numeric := 0;
  v_pending_cheques jsonb := '[]'::jsonb;
  v_ledger jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  -- 1. Fetch Party or Worker
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'type', p.type,
    'opening_balance', p.opening_balance,
    'opening_balance_date', p.opening_balance_date,
    'created_at', p.created_at
  ),
  p.type,
  COALESCE(p.opening_balance, 0),
  COALESCE(p.opening_balance_date::text, SUBSTRING(p.created_at::text, 1, 10), CURRENT_DATE::text)
  INTO v_party, v_party_type, v_ob_val, v_ob_date
  FROM public.parties p
  WHERE p.id = p_party_id AND p.business_id = p_business_id;

  IF v_party IS NULL THEN
    -- Fallback to worker
    SELECT jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'type', jsonb_build_array('worker'),
      'opening_balance', COALESCE((to_jsonb(w)->>'opening_balance')::numeric, 0),
      'opening_balance_date', SUBSTRING(w.created_at::text, 1, 10),
      'created_at', w.created_at
    ),
    ARRAY['worker']::text[],
    COALESCE(COALESCE((to_jsonb(w)->>'opening_balance')::numeric, 0), 0),
    COALESCE(SUBSTRING(w.created_at::text, 1, 10), CURRENT_DATE::text)
    INTO v_party, v_party_type, v_ob_val, v_ob_date
    FROM public.workers w
    WHERE w.id = p_party_id AND w.business_id = p_business_id;
  END IF;

  IF v_party IS NULL THEN
    RETURN jsonb_build_object('error', 'Party/Worker not found');
  END IF;

  -- Determine if customer-only
  IF ('customer' = ANY(v_party_type)) AND NOT ('supplier' = ANY(v_party_type)) AND NOT ('worker' = ANY(v_party_type)) THEN
    v_is_customer_only := true;
  ELSE
    v_is_customer_only := false;
  END IF;

  -- 2. Pending Cheques
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'cheque_number', c.cheque_number,
        'direction', c.direction,
        'bank_name', c.bank_name,
        'account_no', c.account_no,
        'cheque_date', c.cheque_date::text,
        'due_date', c.due_date::text,
        'amount', c.amount,
        'status', c.status,
        'settlement_type', c.settlement_type,
        'remarks', c.remarks
      )
    ),
    '[]'::jsonb
  )
  INTO v_pending_cheques
  FROM public.cheques c
  WHERE c.party_id = p_party_id
    AND c.business_id = p_business_id
    AND c.status IN ('pending', 'deposited');

  -- 3. Remaining Advance
  SELECT COALESCE(SUM(remaining_amount), 0)
  INTO v_remaining_advance
  FROM public.advance_payments
  WHERE party_id = p_party_id
    AND business_id = p_business_id
    AND is_settled = false;

  -- 4. Build All Ledger Raw Transactions via CTEs
  WITH raw_entries AS (
    -- Opening Balance
    SELECT
      'opening'::text AS id,
      p_party_id::text AS record_id,
      v_ob_date AS entry_date,
      'Opening Balance'::text AS particulars,
      'Opening'::text AS voucher_type,
      '-'::text AS voucher_no,
      CASE WHEN v_ob_val < 0 THEN ABS(v_ob_val) ELSE 0 END AS debit,
      CASE WHEN v_ob_val > 0 THEN v_ob_val ELSE 0 END AS credit,
      'both'::text AS bill_category,
      'General'::text AS bill_type_name,
      0 AS sort_order,
      NULL::text AS view_url,
      NULL::jsonb AS allocations

    UNION ALL

    -- Raw Material Purchases
    SELECT
      'rm-purchase-' || rmp.id::text,
      rmp.id::text,
      rmp.invoice_date::text,
      'Raw Material Purchase #' || rmp.purchase_number,
      'Purchase',
      rmp.purchase_number,
      0,
      rmp.grand_total,
      CASE WHEN rmp.gst_type = 'without_gst' THEN 'kacha' ELSE 'pakka' END,
      CASE WHEN rmp.gst_type = 'without_gst' THEN 'Kaccha' ELSE 'Pakka' END,
      1,
      '/raw-materials/purchases/' || rmp.id::text,
      NULL::jsonb
    FROM public.raw_material_purchases rmp
    WHERE rmp.supplier_id = p_party_id
      AND rmp.business_id = p_business_id
      AND rmp.status <> 'cancelled'
      AND rmp.deleted_at IS NULL

    UNION ALL

    -- Purchase Bills (Finished Goods)
    SELECT
      'fg-purchase-' || pb.id::text,
      pb.id::text,
      pb.invoice_date::text,
      'Purchase Bill #' || pb.bill_number,
      'Purchase',
      pb.bill_number,
      0,
      pb.grand_total,
      COALESCE(to_jsonb(pb)->>'bill_type', 'pakka'),
      CASE WHEN to_jsonb(pb)->>'bill_type' = 'kacha' THEN 'Kaccha' ELSE 'Pakka' END,
      1,
      '/purchases/' || pb.id::text,
      NULL::jsonb
    FROM public.purchase_bills pb
    WHERE pb.supplier_id = p_party_id
      AND pb.business_id = p_business_id
      AND pb.status = 'active'
      AND (p_bill_type IS NULL OR p_bill_type IN ('', 'all') OR COALESCE(to_jsonb(pb)->>'bill_type', 'pakka') = p_bill_type)

    UNION ALL

    -- Sale Bills (Customer Invoices)
    SELECT
      'sale-' || sb.id::text,
      sb.id::text,
      sb.bill_date::text,
      'Sales Invoice #' || sb.bill_number,
      'Sale',
      sb.bill_number,
      sb.grand_total,
      0,
      CASE WHEN sb.bill_type = 'kacha' THEN 'kacha' ELSE 'pakka' END,
      CASE WHEN sb.bill_type = 'kacha' THEN 'Kaccha' ELSE 'Pakka' END,
      1,
      '/sales/' || sb.id::text,
      NULL::jsonb
    FROM public.sale_bills sb
    WHERE sb.party_id = p_party_id
      AND sb.business_id = p_business_id
      AND sb.status <> 'cancelled'
      AND sb.deleted_at IS NULL
      AND NOT (sb.bill_number LIKE 'TEMP-%')
      AND (sb.remarks IS NULL OR NOT (sb.remarks LIKE '%[TEMPORARY]%'))
      AND (p_bill_type IS NULL OR p_bill_type = '' OR sb.bill_type = p_bill_type)

    UNION ALL

    -- Stage Entries (Worker Job Work)
    SELECT
      'stage-entry-' || se.id::text,
      se.id::text,
      se.entry_date::text,
      'Production Job Work #' || COALESCE(se.entry_number, SUBSTRING(se.id::text, 1, 8)) || ' (' || COALESCE(se.qty_out, 0)::text || ' Pcs @ ₹' || ROUND(COALESCE(se.job_work_rate, 0), 2)::text || ')',
      'Job Work',
      COALESCE(se.entry_number, '-'),
      0,
      COALESCE(se.total_job_work_amount, COALESCE(se.qty_out, 0) * COALESCE(se.job_work_rate, 0)),
      'both',
      'General',
      1,
      '/production/stage-entries/' || se.id::text,
      NULL::jsonb
    FROM public.stage_entries se
    WHERE se.worker_id = p_party_id
      AND se.business_id = p_business_id

    UNION ALL

    -- Purchase Returns
    SELECT
      'return-' || pr.id::text,
      pr.id::text,
      pr.return_date::text,
      'Purchase Return #' || pr.return_number,
      'Return',
      pr.return_number,
      pr.grand_total,
      0,
      CASE WHEN COALESCE(to_jsonb(pr)->>'gst_type', 'with_gst') = 'without_gst' THEN 'kacha' ELSE 'pakka' END,
      CASE WHEN COALESCE(to_jsonb(pr)->>'gst_type', 'with_gst') = 'without_gst' THEN 'Kaccha' ELSE 'Pakka' END,
      2,
      '/raw-materials/purchase-returns/' || pr.id::text,
      NULL::jsonb
    FROM public.purchase_returns pr
    WHERE pr.supplier_id = p_party_id
      AND pr.business_id = p_business_id
      AND pr.status = 'completed'
      AND pr.deleted_at IS NULL

    UNION ALL

    -- Credit Notes
    SELECT
      'credit-note-' || cn.id::text,
      cn.id::text,
      cn.cn_date::text,
      CASE WHEN cn.return_id IS NOT NULL THEN 'Sales Return / Credit Note #' || cn.cn_number ELSE 'Credit Note #' || cn.cn_number || COALESCE(' (' || cn.reason || ')', '') END,
      'Credit Note',
      cn.cn_number,
      0,
      cn.amount,
      CASE WHEN COALESCE(to_jsonb(sr)->>'gst_type', 'with_gst') = 'without_gst' THEN 'kacha' ELSE 'pakka' END,
      CASE WHEN COALESCE(to_jsonb(sr)->>'gst_type', 'with_gst') = 'without_gst' THEN 'Kaccha' ELSE 'Pakka' END,
      2,
      CASE WHEN cn.return_id IS NOT NULL THEN '/sales/returns/' || cn.return_id::text ELSE '/sales/credit-notes' END,
      NULL::jsonb
    FROM public.credit_notes cn
    LEFT JOIN public.sales_returns sr ON sr.id = cn.return_id
    WHERE cn.party_id = p_party_id
      AND cn.business_id = p_business_id

    UNION ALL

    -- Standalone Debit Notes
    SELECT
      'debit-note-' || dn.id::text,
      dn.id::text,
      dn.dn_date::text,
      'Debit Note #' || dn.dn_number || COALESCE(' (' || dn.reason || ')', ''),
      'Debit Note',
      dn.dn_number,
      dn.amount,
      0,
      'pakka',
      'Pakka',
      2,
      '/sales/debit-notes',
      NULL::jsonb
    FROM public.debit_notes dn
    WHERE dn.party_id = p_party_id
      AND dn.business_id = p_business_id
      AND dn.related_purchase_return_id IS NULL

    UNION ALL

    -- Legacy Purchase Payments
    SELECT
      'legacy-pay-' || pp.id::text,
      pp.id::text,
      pp.payment_date::text,
      'Payment via ' || UPPER(REPLACE(COALESCE(pp.payment_mode, 'PAYMENT'), '_', ' ')) || COALESCE(' (' || pp.reference_no || ')', ''),
      'Payment',
      COALESCE(pp.reference_no, UPPER(SUBSTRING(pp.id::text, 1, 8))),
      pp.paid_amount,
      0,
      'both',
      'General',
      3,
      '/payments',
      NULL::jsonb
    FROM public.purchase_payments pp
    WHERE pp.supplier_id = p_party_id
      AND pp.business_id = p_business_id
      AND pp.status = 'success'

    UNION ALL

    -- Job Work Payments
    SELECT
      'jw-pay-' || jwp.id::text,
      jwp.id::text,
      jwp.payment_date::text,
      'Job Work Payment (' || UPPER(REPLACE(COALESCE(jwp.payment_mode, 'PAYMENT'), '_', ' ')) || ')' || COALESCE(' (' || jwp.reference_no || ')', ''),
      'Payment',
      COALESCE(jwp.payment_number, jwp.reference_no, '-'),
      COALESCE(jwp.paid_amount, 0),
      0,
      'both',
      'General',
      3,
      '/production/job-work',
      NULL::jsonb
    FROM public.job_work_payments jwp
    WHERE jwp.worker_id = p_party_id
      AND jwp.business_id = p_business_id
      AND jwp.status = 'success'

    UNION ALL

    -- Salary Advances
    SELECT
      'salary-adv-' || sa.id::text,
      sa.id::text,
      sa.advance_date::text,
      'Salary Advance (' || UPPER(REPLACE(COALESCE(sa.payment_mode, 'ADVANCE'), '_', ' ')) || ')' || COALESCE(' — ' || sa.notes, ''),
      'Advance',
      '-',
      COALESCE(sa.amount, 0),
      0,
      'both',
      'General',
      3,
      '/salary/advances',
      NULL::jsonb
    FROM public.employee_advances sa
    WHERE sa.worker_id = p_party_id
      AND sa.business_id = p_business_id

    UNION ALL

    -- Salary Entries
    SELECT
      'salary-' || se.id::text,
      se.id::text,
      COALESCE(se.payment_date::text, se.salary_year::text || '-' || LPAD(se.salary_month::text, 2, '0') || '-01'),
      'Salary Payout ' || se.salary_month::text || '/' || se.salary_year::text || ' (' || UPPER(COALESCE(se.payment_mode, 'PAID')) || ')' || COALESCE(' — ' || se.remarks, ''),
      'Salary',
      COALESCE(se.reference_no, '-'),
      COALESCE(se.net_salary, 0),
      0,
      'both',
      'General',
      3,
      '/salary',
      NULL::jsonb
    FROM public.salary_entries se
    WHERE se.worker_id = p_party_id
      AND se.business_id = p_business_id

    UNION ALL

    -- Unified Payments
    SELECT
      'payment-' || py.id::text,
      py.id::text,
      py.payment_date::text,
      CASE
        WHEN py.is_advance = true AND (SELECT COUNT(*) FROM public.payment_allocations WHERE payment_id = py.id) = 0 THEN
          'Advance Payment (' || UPPER(REPLACE(COALESCE(py.payment_mode, 'PAYMENT'), '_', ' ')) || ')' ||
          CASE WHEN ba.name IS NOT NULL THEN ' [' || ba.name || ']' ELSE '' END ||
          COALESCE(' — ' || py.remarks, '')
        ELSE
          CASE WHEN py.direction = 'received' THEN 'Payment received via ' ELSE 'Payment made via ' END || UPPER(REPLACE(COALESCE(py.payment_mode, 'PAYMENT'), '_', ' ')) ||
          CASE WHEN ba.name IS NOT NULL THEN ' [' || ba.name || ']' ELSE '' END ||
          COALESCE(' (' || py.reference_no || ')', '')
      END,
      CASE WHEN py.is_advance = true AND (SELECT COUNT(*) FROM public.payment_allocations WHERE payment_id = py.id) = 0 THEN 'Advance' WHEN py.direction = 'received' THEN 'Receipt' ELSE 'Payment' END,
      COALESCE(py.payment_number, py.reference_no, UPPER(SUBSTRING(py.id::text, 1, 8))),
      CASE WHEN py.direction = 'paid' THEN py.amount ELSE 0 END,
      CASE WHEN py.direction = 'received' THEN py.amount ELSE 0 END,
      CASE
        WHEN ba.account_category IN ('kacha', 'pakka') THEN ba.account_category
        WHEN py.payment_mode = 'cash' THEN 'kacha'
        ELSE 'both'
      END,
      CASE
        WHEN ba.account_category = 'kacha' OR (ba.account_category IS NULL AND py.payment_mode = 'cash') THEN 'Kaccha'
        WHEN ba.account_category = 'pakka' THEN 'Pakka'
        ELSE 'General'
      END,
      3,
      '/payments',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'billNo', COALESCE(sb2.bill_number, pb2.bill_number, rmp2.purchase_number, 'Advance / Unallocated'),
              'amount', pa.allocated_amount
            )
          ),
          '[]'::jsonb
        )
        FROM public.payment_allocations pa
        LEFT JOIN public.sale_bills sb2 ON sb2.id = pa.bill_id AND sb2.business_id = p_business_id
        LEFT JOIN public.purchase_bills pb2 ON pb2.id = pa.bill_id AND pb2.business_id = p_business_id
        LEFT JOIN public.raw_material_purchases rmp2 ON rmp2.id = pa.bill_id AND rmp2.business_id = p_business_id
        WHERE pa.payment_id = py.id
      )
    FROM public.payments py
    LEFT JOIN public.bank_accounts ba ON ba.id = py.bank_account_id AND ba.business_id = p_business_id
    WHERE py.party_id = p_party_id
      AND py.business_id = p_business_id
      AND py.status IN ('completed', 'success')

    UNION ALL

    -- Write-offs
    SELECT
      'writeoff-' || wo.id::text,
      wo.id::text,
      SUBSTRING(wo.written_off_at::text, 1, 10),
      'Write-off (' || UPPER(wo.write_off_type) || ') on bill ' || COALESCE(sb.bill_number, pb.bill_number, rmp.purchase_number, '-') || ': ' || COALESCE(wo.remarks, ''),
      'Write-off',
      '-',
      CASE WHEN wo.bill_type = 'sale_bill' THEN 0 ELSE wo.amount END,
      CASE WHEN wo.bill_type = 'sale_bill' THEN wo.amount ELSE 0 END,
      CASE
        WHEN sb.bill_type = 'kacha' OR rmp.gst_type = 'without_gst' THEN 'kacha'
        ELSE 'pakka'
      END,
      CASE
        WHEN sb.bill_type = 'kacha' OR rmp.gst_type = 'without_gst' THEN 'Kaccha'
        ELSE 'Pakka'
      END,
      4,
      '/payments/write-offs',
      NULL::jsonb
    FROM public.write_offs wo
    LEFT JOIN public.sale_bills sb ON sb.id = wo.bill_id AND sb.business_id = p_business_id AND wo.bill_type = 'sale_bill'
    LEFT JOIN public.purchase_bills pb ON pb.id = wo.bill_id AND pb.business_id = p_business_id AND wo.bill_type = 'purchase_bill'
    LEFT JOIN public.raw_material_purchases rmp ON rmp.id = wo.bill_id AND rmp.business_id = p_business_id AND wo.bill_type = 'raw_material_purchase'
    WHERE wo.business_id = p_business_id
      AND wo.reversed_at IS NULL
      AND (sb.party_id = p_party_id OR pb.supplier_id = p_party_id OR rmp.supplier_id = p_party_id)
  ),
  ordered_entries AS (
    SELECT
      re.*,
      CASE
        WHEN v_is_customer_only THEN
          SUM(re.debit - re.credit) OVER (ORDER BY re.entry_date ASC, re.sort_order ASC, re.id ASC)
        ELSE
          SUM(re.credit - re.debit) OVER (ORDER BY re.entry_date ASC, re.sort_order ASC, re.id ASC)
      END AS running_balance
    FROM raw_entries re
    WHERE p_bill_type IS NULL OR p_bill_type IN ('', 'all') OR re.bill_category IN (p_bill_type, 'both')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', oe.id,
        'recordId', oe.record_id,
        'date', oe.entry_date,
        'particulars', oe.particulars,
        'voucherType', oe.voucher_type,
        'voucherNo', oe.voucher_no,
        'debit', ROUND(oe.debit, 2),
        'credit', ROUND(oe.credit, 2),
        'billCategory', oe.bill_category,
        'billTypeName', oe.bill_type_name,
        'sortOrder', oe.sort_order,
        'viewUrl', oe.view_url,
        'allocations', oe.allocations,
        'balance', ROUND(oe.running_balance, 2),
        'balanceSign', CASE
          WHEN v_is_customer_only THEN CASE WHEN oe.running_balance >= 0 THEN 'Dr' ELSE 'Cr' END
          ELSE CASE WHEN oe.running_balance >= 0 THEN 'Cr' ELSE 'Dr' END
        END,
        'balanceStr', '₹' || TRIM(TO_CHAR(ABS(oe.running_balance), 'FM99,99,99,990.00')) || ' ' ||
          CASE
            WHEN v_is_customer_only THEN CASE WHEN oe.running_balance >= 0 THEN 'Dr' ELSE 'Cr' END
            ELSE CASE WHEN oe.running_balance >= 0 THEN 'Cr' ELSE 'Dr' END
          END
      )
      ORDER BY oe.entry_date ASC, oe.sort_order ASC, oe.id ASC
    ),
    '[]'::jsonb
  )
  INTO v_ledger
  FROM ordered_entries oe;

  -- Construct final return
  v_result := jsonb_build_object(
    'party', v_party,
    'ledger', v_ledger,
    'remainingAdvance', ROUND(v_remaining_advance, 2),
    'pendingCheques', v_pending_cheques
  );

  RETURN v_result;
END;
$$;
