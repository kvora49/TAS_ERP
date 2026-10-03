-- =============================================================================
-- Migration: 20260928000001_rpc_fn_report_payments.sql
-- Description: PostgreSQL RPC function for /api/reports/payments.
-- Replaces ~750 lines of in-memory JavaScript loops, reductions, and filters
-- with database aggregation to reduce edge/serverless JavaScript CPU and memory.
-- =============================================================================

-- Replaces route-level raw-row fetch/group/sum/reduce work with PostgreSQL aggregation
-- to reduce application CPU and transferred intermediate rows for edge/serverless compatibility.
-- Read-only STABLE SECURITY INVOKER preserves caller RLS.
CREATE OR REPLACE FUNCTION public.fn_report_payments(
  p_business_id uuid,
  p_tab text DEFAULT 'receivables',
  p_from text DEFAULT NULL,
  p_to text DEFAULT NULL,
  p_bill_type text DEFAULT NULL,
  p_party_id uuid DEFAULT NULL,
  p_aging_bucket text DEFAULT NULL,
  p_account_id uuid DEFAULT NULL,
  p_direction text DEFAULT NULL,
  p_account_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
  v_today date := CURRENT_DATE;
  v_cash_balance numeric := 0;
  v_result jsonb;
BEGIN
  -- Default dates if not provided
  IF p_to IS NOT NULL AND p_to <> '' THEN
    v_to := p_to::date;
  ELSE
    v_to := v_today;
  END IF;

  IF p_from IS NOT NULL AND p_from <> '' THEN
    v_from := p_from::date;
  ELSE
    -- FY Start (April 1st)
    IF EXTRACT(MONTH FROM v_today) >= 4 THEN
      v_from := make_date(EXTRACT(YEAR FROM v_today)::int, 4, 1);
    ELSE
      v_from := make_date(EXTRACT(YEAR FROM v_today)::int - 1, 4, 1);
    END IF;
  END IF;

  -- Cash / Bank balance utility
  SELECT COALESCE(SUM(a.current_balance - COALESCE(m.after_to,0)),0)
  INTO v_cash_balance FROM public.bank_accounts a
  LEFT JOIN LATERAL (SELECT SUM(signed_amount) after_to FROM public.report_account_movements(p_business_id) WHERE account_id=a.id AND entry_date>v_to) m ON true
  WHERE a.business_id=p_business_id AND a.deleted_at IS NULL;

  -- ===========================================================================
  -- 1. TAB: RECEIVABLES
  -- ===========================================================================
  IF p_tab = 'receivables' THEN
    WITH raw_bills AS (
      SELECT
        sb.id,
        sb.bill_number AS number,
        sb.bill_date::text AS date,
        COALESCE(sb.due_date, sb.bill_date)::text AS due_date,
        sb.bill_type,
        COALESCE(p.company_name, p.name, '—') AS party,
        p.id AS party_id,
        sb.grand_total::numeric AS total,
        public.report_paid_at(p_business_id, sb.id, 'sale_bill', sb.paid_amount, v_to) AS paid,
        GREATEST(0, sb.grand_total - public.report_paid_at(p_business_id, sb.id, 'sale_bill', sb.paid_amount, v_to))::numeric AS outstanding,
        GREATEST(0, (v_to - COALESCE(sb.due_date, sb.bill_date)))::int AS age_days,
        CASE
          WHEN (v_to - COALESCE(sb.due_date, sb.bill_date)) <= 30 THEN '0-30'
          WHEN (v_to - COALESCE(sb.due_date, sb.bill_date)) <= 60 THEN '31-60'
          WHEN (v_to - COALESCE(sb.due_date, sb.bill_date)) <= 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        CASE WHEN public.report_paid_at(p_business_id,sb.id,'sale_bill',sb.paid_amount,v_to) >= sb.grand_total THEN 'paid' WHEN public.report_paid_at(p_business_id,sb.id,'sale_bill',sb.paid_amount,v_to)>0 THEN 'partial' ELSE 'unpaid' END AS status
      FROM public.sale_bills sb
      LEFT JOIN public.parties p ON p.id = sb.party_id AND p.business_id = p_business_id
      WHERE sb.business_id = p_business_id
        AND sb.status = 'active'
        AND sb.deleted_at IS NULL
        AND (sb.grand_total - public.report_paid_at(p_business_id, sb.id, 'sale_bill', sb.paid_amount, v_to)) > 0
        AND sb.bill_date <= v_to
        AND (p_bill_type IS NULL OR p_bill_type = 'all' OR sb.bill_type = p_bill_type)
        AND (p_party_id IS NULL OR sb.party_id = p_party_id)
    ),
    filtered_bills AS (
      SELECT * FROM raw_bills
      WHERE (p_aging_bucket IS NULL OR p_aging_bucket = 'all' OR bucket = p_aging_bucket)
    ),
    aging_calc AS (
      SELECT
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '0-30'), 0) AS b_0_30,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '31-60'), 0) AS b_31_60,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '61-90'), 0) AS b_61_90,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '90+'), 0) AS b_90_plus,
        COALESCE(SUM(outstanding), 0) AS total_outstanding,
        COALESCE(SUM(outstanding) FILTER (WHERE age_days > 0), 0) AS overdue_amount,
        COUNT(*)::int AS total_bills,
        COALESCE(SUM(paid), 0) AS total_received
      FROM filtered_bills
    ),
    top_cust AS (
      SELECT
        party AS name,
        COALESCE(SUM(total), 0) AS total,
        COALESCE(SUM(paid), 0) AS received,
        COALESCE(SUM(outstanding), 0) AS outstanding
      FROM filtered_bills
      GROUP BY party_id, party
      ORDER BY outstanding DESC
      LIMIT 5
    ),
    status_summary AS (
      SELECT
        jsonb_build_object(
          'paid', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status = 'paid'),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status = 'paid'), 0)
          ),
          'partial', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status = 'partial'),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status = 'partial'), 0)
          ),
          'unpaid', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status NOT IN ('paid', 'partial')),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status NOT IN ('paid', 'partial')), 0)
          )
        ) AS status_data
      FROM filtered_bills
    ),
    recent_receipts AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pay.id,
          'number', pay.payment_number,
          'date', pay.payment_date,
          'party', COALESCE(p.company_name, p.name, '—'),
          'mode', pay.payment_mode,
          'account', COALESCE(ba.name, '—'),
          'amount', pay.amount
        )
      ) AS receipts_data
      FROM (
        SELECT id, payment_number, payment_date, payment_mode, amount, bank_account_id, party_id
        FROM public.payments
        WHERE business_id = p_business_id AND payment_date BETWEEN v_from AND v_to AND (p_party_id IS NULL OR party_id = p_party_id) AND direction = 'received' AND status IN ('completed', 'success')
        ORDER BY payment_date DESC
        LIMIT 5
      ) pay
      LEFT JOIN public.parties p ON p.id = pay.party_id AND p.business_id = p_business_id
      LEFT JOIN public.bank_accounts ba ON ba.id = pay.bank_account_id AND ba.business_id = p_business_id
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(fb)) FROM filtered_bills fb), '[]'::jsonb),
      'aging', jsonb_build_object(
        '0-30', (SELECT b_0_30 FROM aging_calc),
        '31-60', (SELECT b_31_60 FROM aging_calc),
        '61-90', (SELECT b_61_90 FROM aging_calc),
        '90+', (SELECT b_90_plus FROM aging_calc)
      ),
      'summary', jsonb_build_object(
        'totalOutstanding', (SELECT total_outstanding FROM aging_calc),
        'overdueAmount', (SELECT overdue_amount FROM aging_calc),
        'totalBills', (SELECT total_bills FROM aging_calc),
        'totalReceived', (SELECT total_received FROM aging_calc),
        'cashBalance', v_cash_balance
      ),
      'topCustomers', COALESCE((SELECT jsonb_agg(to_jsonb(tc)) FROM top_cust tc), '[]'::jsonb),
      'statusSummary', (SELECT status_data FROM status_summary),
      'recentReceipts', COALESCE((SELECT receipts_data FROM recent_receipts), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 2. TAB: PAYABLES
  -- ===========================================================================
  ELSIF p_tab = 'payables' THEN
    WITH rm_rows AS (
      SELECT
        rmp.id,
        rmp.purchase_number AS number,
        rmp.invoice_date::text AS date,
        COALESCE(rmp.due_date, rmp.invoice_date)::text AS due_date,
        CASE
          WHEN EXISTS (SELECT 1 FROM public.raw_material_purchase_items i WHERE i.purchase_id = rmp.id AND i.item_type = 'accessory') THEN 'Accessories'
          WHEN EXISTS (SELECT 1 FROM public.raw_material_purchase_items i WHERE i.purchase_id = rmp.id AND i.item_type = 'others') THEN 'Others'
          ELSE 'Raw Material'
        END AS type,
        CASE WHEN rmp.gst_type = 'without_gst' THEN 'kacha' ELSE 'pakka' END AS bill_type,
        COALESCE(p.company_name, p.name, '—') AS party,
        p.id AS party_id,
        rmp.grand_total::numeric AS total,
        public.report_paid_at(p_business_id, rmp.id, 'raw_material_purchase', rmp.paid_amount, v_to) AS paid,
        GREATEST(0, rmp.grand_total - public.report_paid_at(p_business_id, rmp.id, 'raw_material_purchase', rmp.paid_amount, v_to))::numeric AS outstanding,
        GREATEST(0, (v_to - COALESCE(rmp.due_date, rmp.invoice_date)))::int AS age_days,
        CASE
          WHEN (v_to - COALESCE(rmp.due_date, rmp.invoice_date)) <= 30 THEN '0-30'
          WHEN (v_to - COALESCE(rmp.due_date, rmp.invoice_date)) <= 60 THEN '31-60'
          WHEN (v_to - COALESCE(rmp.due_date, rmp.invoice_date)) <= 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        CASE WHEN public.report_paid_at(p_business_id,rmp.id,'raw_material_purchase',rmp.paid_amount,v_to)>=rmp.grand_total THEN 'paid' WHEN public.report_paid_at(p_business_id,rmp.id,'raw_material_purchase',rmp.paid_amount,v_to)>0 THEN 'partial' ELSE 'unpaid' END AS status
      FROM public.raw_material_purchases rmp
      LEFT JOIN public.parties p ON p.id = rmp.supplier_id AND p.business_id = p_business_id
      WHERE rmp.business_id = p_business_id
        AND (rmp.grand_total - public.report_paid_at(p_business_id, rmp.id, 'raw_material_purchase', rmp.paid_amount, v_to)) > 0
        AND rmp.status <> 'cancelled'
        AND rmp.deleted_at IS NULL
        AND rmp.invoice_date <= v_to
        AND (p_party_id IS NULL OR rmp.supplier_id = p_party_id)
    ),
    pb_rows AS (
      SELECT
        pb.id,
        pb.bill_number AS number,
        pb.invoice_date::text AS date,
        COALESCE(NULLIF(to_jsonb(pb)->>'due_date', '')::date, pb.invoice_date)::text AS due_date,
        'Finished Goods' AS type,
        CASE WHEN COALESCE(to_jsonb(pb)->>'bill_type', 'pakka') = 'kacha' THEN 'kacha' ELSE 'pakka' END AS bill_type,
        COALESCE(p.company_name, p.name, '—') AS party,
        p.id AS party_id,
        pb.grand_total::numeric AS total,
        public.report_paid_at(p_business_id, pb.id, 'purchase_bill', pb.paid_amount, v_to) AS paid,
        GREATEST(0, pb.grand_total - public.report_paid_at(p_business_id, pb.id, 'purchase_bill', pb.paid_amount, v_to))::numeric AS outstanding,
        GREATEST(0, (v_to - COALESCE(NULLIF(to_jsonb(pb)->>'due_date', '')::date, pb.invoice_date)))::int AS age_days,
        CASE
          WHEN (v_to - COALESCE(NULLIF(to_jsonb(pb)->>'due_date', '')::date, pb.invoice_date)) <= 30 THEN '0-30'
          WHEN (v_to - COALESCE(NULLIF(to_jsonb(pb)->>'due_date', '')::date, pb.invoice_date)) <= 60 THEN '31-60'
          WHEN (v_to - COALESCE(NULLIF(to_jsonb(pb)->>'due_date', '')::date, pb.invoice_date)) <= 90 THEN '61-90'
          ELSE '90+'
        END AS bucket,
        CASE WHEN public.report_paid_at(p_business_id,pb.id,'purchase_bill',pb.paid_amount,v_to)>=pb.grand_total THEN 'paid' WHEN public.report_paid_at(p_business_id,pb.id,'purchase_bill',pb.paid_amount,v_to)>0 THEN 'partial' ELSE 'unpaid' END AS status
      FROM public.purchase_bills pb
      LEFT JOIN public.parties p ON p.id = pb.supplier_id AND p.business_id = p_business_id
      WHERE pb.business_id = p_business_id
        AND (pb.grand_total - public.report_paid_at(p_business_id, pb.id, 'purchase_bill', pb.paid_amount, v_to)) > 0
        AND pb.status <> 'cancelled'
        AND pb.invoice_date <= v_to
        AND (p_party_id IS NULL OR pb.supplier_id = p_party_id)
    ),
    union_payables AS (
      SELECT * FROM rm_rows
      UNION ALL
      SELECT * FROM pb_rows
    ),
    filtered_payables AS (
      SELECT * FROM union_payables
      WHERE (p_aging_bucket IS NULL OR p_aging_bucket = 'all' OR bucket = p_aging_bucket)
        AND (p_bill_type IS NULL OR p_bill_type = 'all' OR bill_type = p_bill_type)
      ORDER BY date DESC
    ),
    aging_calc AS (
      SELECT
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '0-30'), 0) AS b_0_30,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '31-60'), 0) AS b_31_60,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '61-90'), 0) AS b_61_90,
        COALESCE(SUM(outstanding) FILTER (WHERE bucket = '90+'), 0) AS b_90_plus,
        COALESCE(SUM(outstanding), 0) AS total_outstanding,
        COALESCE(SUM(outstanding) FILTER (WHERE age_days > 0), 0) AS overdue_amount,
        COUNT(*)::int AS total_bills,
        COALESCE(SUM(paid), 0) AS total_paid
      FROM filtered_payables
    ),
    top_supp AS (
      SELECT
        party AS name,
        COALESCE(SUM(total), 0) AS total,
        COALESCE(SUM(paid), 0) AS paid,
        COALESCE(SUM(outstanding), 0) AS outstanding
      FROM filtered_payables
      GROUP BY party_id, party
      ORDER BY outstanding DESC
      LIMIT 5
    ),
    status_summary AS (
      SELECT
        jsonb_build_object(
          'paid', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status = 'paid'),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status = 'paid'), 0)
          ),
          'partial', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status = 'partial'),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status = 'partial'), 0)
          ),
          'unpaid', jsonb_build_object(
            'count', COUNT(*) FILTER (WHERE status NOT IN ('paid', 'partial')),
            'amount', COALESCE(SUM(outstanding) FILTER (WHERE status NOT IN ('paid', 'partial')), 0)
          )
        ) AS status_data
      FROM filtered_payables
    ),
    recent_payments AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pay.id,
          'number', pay.payment_number,
          'date', pay.payment_date,
          'party', COALESCE(p.company_name, p.name, '—'),
          'mode', pay.payment_mode,
          'account', COALESCE(ba.name, '—'),
          'amount', pay.amount
        )
      ) AS payments_data
      FROM (
        SELECT id, payment_number, payment_date, payment_mode, amount, bank_account_id, party_id
        FROM public.payments
        WHERE business_id = p_business_id AND direction = 'paid' AND status IN ('completed', 'success')
        ORDER BY payment_date DESC
        LIMIT 5
      ) pay
      LEFT JOIN public.parties p ON p.id = pay.party_id AND p.business_id = p_business_id
      LEFT JOIN public.bank_accounts ba ON ba.id = pay.bank_account_id AND ba.business_id = p_business_id
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(fp)) FROM filtered_payables fp), '[]'::jsonb),
      'aging', jsonb_build_object(
        '0-30', (SELECT b_0_30 FROM aging_calc),
        '31-60', (SELECT b_31_60 FROM aging_calc),
        '61-90', (SELECT b_61_90 FROM aging_calc),
        '90+', (SELECT b_90_plus FROM aging_calc)
      ),
      'summary', jsonb_build_object(
        'totalOutstanding', (SELECT total_outstanding FROM aging_calc),
        'overdueAmount', (SELECT overdue_amount FROM aging_calc),
        'totalBills', (SELECT total_bills FROM aging_calc),
        'totalPaid', (SELECT total_paid FROM aging_calc),
        'cashBalance', v_cash_balance
      ),
      'topSuppliers', COALESCE((SELECT jsonb_agg(to_jsonb(ts)) FROM top_supp ts), '[]'::jsonb),
      'statusSummary', (SELECT status_data FROM status_summary),
      'recentPayments', COALESCE((SELECT payments_data FROM recent_payments), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 3. TAB: RECEIPTS
  -- ===========================================================================
  ELSIF p_tab = 'receipts' THEN
    WITH receipts_rows AS (
      SELECT
        p.id,
        p.payment_number AS number,
        p.payment_date::text AS date,
        COALESCE(pty.company_name, pty.name, '—') AS party,
        pty.id AS party_id,
        CASE WHEN p.is_advance THEN 'Advance' ELSE 'Invoice' END AS type,
        p.payment_mode AS mode,
        COALESCE(ba.name, 'Cash') AS account,
        COALESCE(ba.type, 'cash') AS account_type,
        COALESCE(ba.account_category, CASE WHEN p.payment_mode = 'cash' THEN 'kacha' ELSE 'pakka' END) AS account_category,
        COALESCE(p.reference_no, '—') AS reference,
        p.amount::numeric AS amount
      FROM public.payments p
      LEFT JOIN public.bank_accounts ba ON ba.id = p.bank_account_id AND ba.business_id = p_business_id
      LEFT JOIN public.parties pty ON pty.id = p.party_id AND pty.business_id = p_business_id
      WHERE p.business_id = p_business_id
        AND p.direction = 'received'
        AND p.status IN ('completed', 'success')
        AND p.payment_date BETWEEN v_from AND v_to
        AND (p_party_id IS NULL OR p.party_id = p_party_id)
        AND (p_account_id IS NULL OR p.bank_account_id = p_account_id)
      ORDER BY p.payment_date DESC
    ),
    modes_agg AS (
      SELECT COALESCE(jsonb_object_agg(mode, total_mode), '{}'::jsonb) AS by_mode
      FROM (SELECT mode, SUM(amount) AS total_mode FROM receipts_rows GROUP BY mode) m
    ),
    types_agg AS (
      SELECT COALESCE(jsonb_object_agg(type, total_type), '{}'::jsonb) AS by_type
      FROM (SELECT type, SUM(amount) AS total_type FROM receipts_rows GROUP BY type) t
    ),
    daily_trend AS (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', SUBSTRING(dt FROM 6), 'amount', amt)), '[]'::jsonb) AS trend
      FROM (
        SELECT date AS dt, SUM(amount) AS amt
        FROM receipts_rows
        GROUP BY date
        ORDER BY date ASC
      ) d
    ),
    top_cust AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', party,
          'amount', amt,
          'pct', CASE WHEN total_rec > 0 THEN ROUND((amt / total_rec) * 100, 2) ELSE 0 END
        )
      ), '[]'::jsonb) AS top_cust_data
      FROM (
        SELECT
          party,
          SUM(amount) AS amt,
          SUM(SUM(amount)) OVER() AS total_rec
        FROM receipts_rows
        GROUP BY party_id, party
        ORDER BY amt DESC
        LIMIT 5
      ) tc
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(rr)) FROM receipts_rows rr), '[]'::jsonb),
      'byMode', (SELECT by_mode FROM modes_agg),
      'byType', (SELECT by_type FROM types_agg),
      'dailyTrend', (SELECT trend FROM daily_trend),
      'summary', jsonb_build_object(
        'totalReceived', COALESCE((SELECT SUM(amount) FROM receipts_rows), 0),
        'advanceReceived', COALESCE((SELECT SUM(amount) FROM receipts_rows WHERE type = 'Advance'), 0),
        'invoiceReceived', COALESCE((SELECT SUM(amount) FROM receipts_rows WHERE type = 'Invoice'), 0),
        'otherReceived', 0,
        'cashBalance', v_cash_balance
      ),
      'topCustomers', (SELECT top_cust_data FROM top_cust)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 4. TAB: PAYMENTS
  -- ===========================================================================
  ELSIF p_tab = 'payments' THEN
    WITH pay_rows AS (
      SELECT
        p.id,
        p.payment_number AS number,
        p.payment_date::text AS date,
        COALESCE(pty.company_name, pty.name, '—') AS payee,
        pty.id AS party_id,
        CASE WHEN 'supplier' = ANY(pty.type) THEN 'supplier' WHEN 'worker' = ANY(pty.type) THEN 'worker' ELSE 'customer' END AS party_type,
        CASE
          WHEN p.is_advance THEN 'Advance Payment'
          WHEN 'supplier' = ANY(pty.type) THEN 'Purchase Payment'
          ELSE 'Expense Payment'
        END AS purpose_type,
        p.payment_mode AS mode,
        COALESCE(ba.name, 'Cash') AS account,
        COALESCE(ba.type, 'cash') AS account_type,
        COALESCE(p.reference_no, '—') AS reference,
        p.amount::numeric AS amount
      FROM public.payments p
      LEFT JOIN public.bank_accounts ba ON ba.id = p.bank_account_id AND ba.business_id = p_business_id
      LEFT JOIN public.parties pty ON pty.id = p.party_id AND pty.business_id = p_business_id
      WHERE p.business_id = p_business_id
        AND p.direction = 'paid'
        AND p.status IN ('completed', 'success')
        AND p.payment_date BETWEEN v_from AND v_to
        AND (p_party_id IS NULL OR p.party_id = p_party_id)
      ORDER BY p.payment_date DESC
    ),
    modes_agg AS (
      SELECT COALESCE(jsonb_object_agg(mode, total_mode), '{}'::jsonb) AS by_mode
      FROM (SELECT mode, SUM(amount) AS total_mode FROM pay_rows GROUP BY mode) m
    ),
    types_agg AS (
      SELECT COALESCE(jsonb_object_agg(purpose_type, total_type), '{}'::jsonb) AS by_type
      FROM (SELECT purpose_type, SUM(amount) AS total_type FROM pay_rows GROUP BY purpose_type) t
    ),
    daily_trend AS (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', SUBSTRING(dt FROM 6), 'amount', amt)), '[]'::jsonb) AS trend
      FROM (
        SELECT date AS dt, SUM(amount) AS amt
        FROM pay_rows
        GROUP BY date
        ORDER BY date ASC
      ) d
    ),
    top_supp AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', payee,
          'amount', amt,
          'pct', CASE WHEN total_paid > 0 THEN ROUND((amt / total_paid) * 100, 2) ELSE 0 END
        )
      ), '[]'::jsonb) AS top_supp_data
      FROM (
        SELECT
          payee,
          SUM(amount) AS amt,
          SUM(SUM(amount)) OVER() AS total_paid
        FROM pay_rows
        GROUP BY party_id, payee
        ORDER BY amt DESC
        LIMIT 5
      ) ts
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(pr)) FROM pay_rows pr), '[]'::jsonb),
      'byMode', (SELECT by_mode FROM modes_agg),
      'byType', (SELECT by_type FROM types_agg),
      'dailyTrend', (SELECT trend FROM daily_trend),
      'summary', jsonb_build_object(
        'totalPaid', COALESCE((SELECT SUM(amount) FROM pay_rows), 0),
        'supplierPayments', COALESCE((SELECT SUM(amount) FROM pay_rows WHERE party_type = 'supplier'), 0),
        'workerPayments', COALESCE((SELECT SUM(amount) FROM pay_rows WHERE purpose_type LIKE '%Worker%' OR purpose_type LIKE '%Job%'), 0),
        'otherPayments', COALESCE((SELECT SUM(amount) FROM pay_rows WHERE purpose_type = 'Expense Payment'), 0),
        'cashBalance', v_cash_balance
      ),
      'topSuppliers', (SELECT top_supp_data FROM top_supp)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 5. TAB: ACCOUNTS
  -- ===========================================================================
  ELSIF p_tab = 'accounts' THEN
    WITH acct_tx AS (
      SELECT
        p.bank_account_id,
        p.direction,
        p.amount::numeric AS amount,
        p.payment_date,
        p.payment_mode,
        p.payment_number,
        COALESCE(pty.company_name, pty.name, '—') AS party
      FROM public.payments p
      LEFT JOIN public.parties pty ON pty.id = p.party_id AND pty.business_id = p_business_id
      WHERE p.business_id = p_business_id
        AND p.status IN ('completed', 'success')
        AND p.payment_date BETWEEN v_from AND v_to
        AND (p_account_id IS NULL OR p.bank_account_id = p_account_id)
    ),
    acct_flow AS (
      SELECT
        COALESCE(bank_account_id, '00000000-0000-0000-0000-000000000000'::uuid) AS ba_id,
        COALESCE(SUM(amount) FILTER (WHERE direction = 'received'), 0) AS total_rec,
        COALESCE(SUM(amount) FILTER (WHERE direction = 'paid'), 0) AS total_paid
      FROM acct_tx
      GROUP BY bank_account_id
    ),
    account_rollback AS (
      SELECT account_id,
        COALESCE(SUM(signed_amount) FILTER (WHERE entry_date >= v_from), 0) AS since_start,
        COALESCE(SUM(signed_amount) FILTER (WHERE entry_date > v_to), 0) AS after_end
      FROM public.report_account_movements(p_business_id) GROUP BY account_id
    ),
    accounts_list AS (
      SELECT
        ba.id,
        ba.name,
        ba.type,
        ba.sub_label,
        ba.account_category,
        COALESCE(ba.current_balance, 0) - COALESCE(ar.since_start, 0) AS opening_balance,
        COALESCE(ba.current_balance, 0)::numeric AS current_balance,
        COALESCE(af.total_rec, 0)::numeric AS received,
        COALESCE(af.total_paid, 0)::numeric AS paid,
        0::numeric AS transfers,
        COALESCE(ba.current_balance, 0) - COALESCE(ar.after_end, 0) AS closing_balance
      FROM public.bank_accounts ba
      LEFT JOIN acct_flow af ON af.ba_id = ba.id
      LEFT JOIN account_rollback ar ON ar.account_id = ba.id
      WHERE ba.business_id = p_business_id
        AND ba.is_active = true
        AND ba.deleted_at IS NULL
        AND (p_account_id IS NULL OR ba.id = p_account_id)
      ORDER BY ba.type, ba.name
    ),
    tx_list AS (
      SELECT
        payment_date AS date,
        payment_number AS number,
        CASE WHEN direction = 'received' THEN 'Receipt' ELSE 'Payment' END AS type,
        party,
        payment_mode AS mode,
        CASE WHEN direction = 'paid' THEN amount ELSE 0 END AS debit,
        CASE WHEN direction = 'received' THEN amount ELSE 0 END AS credit,
        amount
      FROM acct_tx
      ORDER BY payment_date DESC
      -- Full transaction history is required for export; the UI paginates.
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'accounts', COALESCE((SELECT jsonb_agg(to_jsonb(al)) FROM accounts_list al), '[]'::jsonb),
      'txRows', COALESCE((SELECT jsonb_agg(to_jsonb(tl)) FROM tx_list tl), '[]'::jsonb),
      'summary', jsonb_build_object(
        'totalCash', COALESCE((SELECT SUM(closing_balance) FROM accounts_list WHERE type = 'cash'), 0),
        'totalBank', COALESCE((SELECT SUM(closing_balance) FROM accounts_list WHERE type = 'bank'), 0),
        'totalUPI', COALESCE((SELECT SUM(closing_balance) FROM accounts_list WHERE type = 'upi'), 0),
        'totalBalance', COALESCE((SELECT SUM(closing_balance) FROM accounts_list), 0),
        'netTransfers', 0
      ),
      'accountOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'label', name || ' (' || UPPER(type) || ')', 'type', type))
        FROM accounts_list
      ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 6. TAB: CHEQUES
  -- ===========================================================================
  ELSIF p_tab = 'cheques' THEN
    WITH chq_data AS (
      SELECT
        c.id,
        c.cheque_number AS number,
        c.cheque_date::text AS date,
        c.cheque_date::text AS cheque_date,
        c.direction,
        COALESCE(p.company_name, p.name, '—') AS party,
        c.bank_name AS bank,
        c.account_no AS account,
        c.amount::numeric AS amount,
        c.status,
        (c.cheque_date - v_today)::int AS days_left,
        c.deposited_date::text AS deposited_date,
        c.cleared_date::text AS cleared_date,
        COALESCE(ba.name, '—') AS received_account
      FROM public.cheques c
      LEFT JOIN public.parties p ON p.id = c.party_id AND p.business_id = p_business_id
      LEFT JOIN public.bank_accounts ba ON ba.id = c.received_account_id AND ba.business_id = p_business_id
      WHERE c.business_id = p_business_id
        AND (p_party_id IS NULL OR c.party_id = p_party_id)
        AND c.cheque_date BETWEEN v_from AND v_to
      ORDER BY c.cheque_date DESC
    ),
    rec_chq AS (
      SELECT * FROM chq_data WHERE direction = 'received'
    ),
    iss_chq AS (
      SELECT * FROM chq_data WHERE direction = 'issued'
    ),
    status_rec AS (
      SELECT COALESCE(jsonb_object_agg(status, amt), '{}'::jsonb) AS by_status
      FROM (SELECT status, SUM(amount) AS amt FROM rec_chq GROUP BY status) s
    ),
    status_iss AS (
      SELECT COALESCE(jsonb_object_agg(status, amt), '{}'::jsonb) AS by_status
      FROM (SELECT status, SUM(amount) AS amt FROM iss_chq GROUP BY status) s
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'received', COALESCE((SELECT jsonb_agg(to_jsonb(rc)) FROM rec_chq rc), '[]'::jsonb),
      'issued', COALESCE((SELECT jsonb_agg(to_jsonb(ic)) FROM iss_chq ic), '[]'::jsonb),
      'summary', jsonb_build_object(
        'totalReceived', COALESCE((SELECT SUM(amount) FROM rec_chq), 0),
        'totalIssued', COALESCE((SELECT SUM(amount) FROM iss_chq), 0),
        'pdcReceived', COALESCE((SELECT SUM(amount) FROM rec_chq WHERE status = 'pending'), 0),
        'pdcIssued', COALESCE((SELECT SUM(amount) FROM iss_chq WHERE status = 'pending'), 0),
        'bounced', COALESCE((SELECT SUM(amount) FROM chq_data WHERE status = 'bounced'), 0),
        'cleared', COALESCE((SELECT SUM(amount) FROM chq_data WHERE status = 'cleared'), 0)
      ),
      'byStatusReceived', (SELECT by_status FROM status_rec),
      'byStatusIssued', (SELECT by_status FROM status_iss)
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 7. TAB: ADVANCES
  -- ===========================================================================
  ELSIF p_tab = 'advances' THEN
    WITH adv_rows AS (
      SELECT
        ap.id,
        COALESCE(p.payment_number, '—') AS advance_number,
        COALESCE(p.payment_date::text, SUBSTRING(ap.created_at::text, 1, 10)) AS date,
        COALESCE(pty.company_name, pty.name, '—') AS party,
        CASE WHEN p.direction = 'received' THEN 'customer' ELSE 'supplier' END AS party_type,
        'Advance' AS type,
        COALESCE(p.payment_mode, '—') AS mode,
        COALESCE(ba.name, 'Cash') AS account,
        ap.advance_amount::numeric AS amount,
        ap.settled_amount::numeric AS adjusted,
        ap.remaining_amount::numeric AS balance,
        CASE
          WHEN ap.is_settled THEN 'Adjusted'
          WHEN ap.settled_amount > 0 THEN 'Partial'
          ELSE 'Unadjusted'
        END AS status
      FROM public.advance_payments ap
      LEFT JOIN public.payments p ON p.id = ap.payment_id
      LEFT JOIN public.bank_accounts ba ON ba.id = p.bank_account_id AND ba.business_id = p_business_id
      LEFT JOIN public.parties pty ON pty.id = ap.party_id AND pty.business_id = p_business_id
      WHERE ap.business_id = p_business_id
        AND p.status IN ('completed', 'success')
        AND p.payment_date <= v_to
        AND (p_party_id IS NULL OR ap.party_id = p_party_id)
      ORDER BY ap.created_at DESC
    ),
    cust_adv AS (SELECT * FROM adv_rows WHERE party_type = 'customer'),
    supp_adv AS (SELECT * FROM adv_rows WHERE party_type = 'supplier')
    SELECT jsonb_build_object(
      'tab', p_tab,
      'customerAdvances', COALESCE((SELECT jsonb_agg(to_jsonb(ca)) FROM cust_adv ca), '[]'::jsonb),
      'supplierAdvances', COALESCE((SELECT jsonb_agg(to_jsonb(sa)) FROM supp_adv sa), '[]'::jsonb),
      'customerByStatus', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM (SELECT status AS name, SUM(amount) AS value FROM cust_adv GROUP BY status) g), '[]'::jsonb),
      'supplierByStatus', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM (SELECT status AS name, SUM(amount) AS value FROM supp_adv GROUP BY status) g), '[]'::jsonb),
      'summary', jsonb_build_object(
        'customerAdvances', COALESCE((SELECT SUM(amount) FROM cust_adv), 0),
        'supplierAdvances', COALESCE((SELECT SUM(amount) FROM supp_adv), 0),
        'totalAdvances', COALESCE((SELECT SUM(amount) FROM adv_rows), 0),
        'adjustedThisPeriod', COALESCE((
          SELECT SUM(adjusted) FROM adv_rows
          WHERE date::date BETWEEN v_from AND v_to
        ), 0),
        'outstandingAdvances', COALESCE((SELECT SUM(balance) FROM adv_rows), 0)
      )
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 8. TAB: TRANSFERS
  -- ===========================================================================
  ELSIF p_tab = 'transfers' THEN
    WITH transfer_rows AS (
      SELECT
        p.id,
        p.payment_number AS number,
        p.payment_date::text AS date,
        p.direction,
        p.payment_mode AS mode,
        CASE WHEN p.direction = 'paid' THEN COALESCE(ba.name, '—') ELSE 'Party' END AS from_account,
        CASE WHEN p.direction = 'received' THEN COALESCE(ba.name, '—') ELSE 'Party' END AS to_account,
        COALESCE(pty.company_name, pty.name, '—') AS party,
        COALESCE(p.reference_no, '—') AS reference,
        COALESCE(p.remarks, '—') AS remarks,
        p.amount::numeric AS amount,
        'Completed' AS status
      FROM public.payments p
      LEFT JOIN public.bank_accounts ba ON ba.id = p.bank_account_id AND ba.business_id = p_business_id
      LEFT JOIN public.parties pty ON pty.id = p.party_id AND pty.business_id = p_business_id
      WHERE p.business_id = p_business_id
        AND p.status IN ('completed', 'success')
        AND p.payment_mode IN ('bank_transfer', 'neft', 'rtgs', 'cheque', 'upi')
        AND (p_direction IS NULL OR p.direction=p_direction)
        AND (p_party_id IS NULL OR p.party_id=p_party_id)
        AND (p_account_id IS NULL OR p.bank_account_id=p_account_id)
        AND (p_account_category IS NULL OR p_account_category='all' OR ba.account_category=p_account_category OR ba.account_category='both')
        AND p.payment_date BETWEEN v_from AND v_to
      ORDER BY p.payment_date DESC
    ),
    mode_agg AS (
      SELECT COALESCE(jsonb_object_agg(mode, amt), '{}'::jsonb) AS by_mode
      FROM (SELECT mode, SUM(amount) AS amt FROM transfer_rows GROUP BY mode) m
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(tr)) FROM transfer_rows tr), '[]'::jsonb),
      'byMode', (SELECT by_mode FROM mode_agg),
      'summary', jsonb_build_object(
        'totalTransfers', COALESCE((SELECT SUM(amount) FROM transfer_rows), 0),
        'netCashFlow', COALESCE((SELECT SUM(CASE WHEN direction='received' THEN amount ELSE -amount END) FROM transfer_rows),0),
        'totalRows', COALESCE((SELECT COUNT(*)::int FROM transfer_rows), 0)
      )
    ) INTO v_result;

    RETURN v_result;

  -- ===========================================================================
  -- 9. FALLBACK / LEGACY: combined, upi, bank, cash
  -- ===========================================================================
  ELSE
    WITH base_payments AS (
      SELECT
        p.id,
        p.payment_number AS number,
        p.payment_date::text AS date,
        p.direction,
        p.payment_mode AS mode,
        COALESCE(ba.name, CASE WHEN p.payment_mode = 'cash' THEN 'Cash Register' ELSE 'Bank Account' END) AS account_name,
        COALESCE(ba.account_category, CASE WHEN p.payment_mode = 'cash' THEN 'kacha' ELSE 'pakka' END) AS account_category,
        COALESCE(pty.company_name, pty.name, '—') AS party,
        p.amount::numeric AS amount,
        CASE WHEN p.direction = 'paid' THEN p.amount ELSE 0 END AS debit,
        CASE WHEN p.direction = 'received' THEN p.amount ELSE 0 END AS credit,
        CASE WHEN p.is_advance THEN 'Advance' WHEN p.direction = 'received' THEN 'Receipt' ELSE 'Payment' END AS type,
        p.status,
        COALESCE(ba.name, 'Cash') AS account,
        COALESCE(p.reference_no, '—') AS reference,
        COALESCE(p.remarks, '—') AS remarks
      FROM public.payments p
      LEFT JOIN public.bank_accounts ba ON ba.id = p.bank_account_id AND ba.business_id = p_business_id
      LEFT JOIN public.parties pty ON pty.id = p.party_id AND pty.business_id = p_business_id
      WHERE p.business_id = p_business_id
        AND p.status IN ('completed', 'success')
        AND p.payment_date BETWEEN v_from AND v_to
        AND (
          p_tab IN ('combined', 'all_transactions')
          OR (p_tab = 'upi' AND p.payment_mode IN ('upi', 'gpay', 'phonepe', 'paytm', 'qr'))
          OR (p_tab = 'bank' AND p.payment_mode IN ('bank_transfer', 'neft', 'rtgs', 'cheque', 'bank', 'net_banking', 'card', 'online', 'pdc', 'imps'))
          OR (p_tab = 'cash' AND p.payment_mode IN ('cash', 'cash_payment'))
        )
        AND (p_direction IS NULL OR p.direction = p_direction)
        AND (p_party_id IS NULL OR p.party_id = p_party_id)
      ORDER BY p.payment_date DESC
    ),
    filtered_payments AS (
      SELECT * FROM base_payments
      WHERE (p_account_category IS NULL OR p_account_category = 'all' OR account_category = p_account_category OR account_category = 'both')
    ),
    modes_agg AS (
      SELECT COALESCE(jsonb_object_agg(mode, amt), '{}'::jsonb) AS by_mode
      FROM (SELECT mode, SUM(amount) AS amt FROM filtered_payments GROUP BY mode) m
    ),
    monthly_trend AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'month', TO_CHAR(TO_DATE(mth || '-01', 'YYYY-MM-DD'), 'Mon "YY'),
          'received', rec,
          'paid', pd
        )
      ), '[]'::jsonb) AS trend
      FROM (
        SELECT
          SUBSTRING(date FROM 1 FOR 7) AS mth,
          COALESCE(SUM(amount) FILTER (WHERE direction = 'received'), 0) AS rec,
          COALESCE(SUM(amount) FILTER (WHERE direction = 'paid'), 0) AS pd
        FROM filtered_payments
        GROUP BY SUBSTRING(date FROM 1 FOR 7)
        ORDER BY mth ASC
      ) mt
    )
    SELECT jsonb_build_object(
      'tab', p_tab,
      'from', v_from::text,
      'to', v_to::text,
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(fp)) FROM filtered_payments fp), '[]'::jsonb),
      'summary', jsonb_build_object(
        'totalReceipts', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'received') FROM filtered_payments), 0),
        'totalPayments', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'paid') FROM filtered_payments), 0),
        'totalAdvances', COALESCE((SELECT SUM(amount) FILTER (WHERE type = 'Advance') FROM filtered_payments), 0),
        'totalCheques', COALESCE((SELECT SUM(amount) FILTER (WHERE mode = 'cheque') FROM filtered_payments), 0),
        'netCashFlow', COALESCE((SELECT SUM(credit - debit) FROM filtered_payments), 0),
        'closingBalance', v_cash_balance,
        'totalIn', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'received') FROM filtered_payments), 0),
        'totalOut', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'paid') FROM filtered_payments), 0),
        'net', COALESCE((SELECT SUM(CASE WHEN direction = 'received' THEN amount ELSE -amount END) FROM filtered_payments), 0),
        'totalInPakka', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'received' AND account_category IN ('pakka', 'both')) FROM filtered_payments), 0),
        'totalInKacha', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'received' AND account_category = 'kacha') FROM filtered_payments), 0),
        'totalOutPakka', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'paid' AND account_category IN ('pakka', 'both')) FROM filtered_payments), 0),
        'totalOutKacha', COALESCE((SELECT SUM(amount) FILTER (WHERE direction = 'paid' AND account_category = 'kacha') FROM filtered_payments), 0),
        'totalTransactions', (SELECT COUNT(*)::int FROM filtered_payments)
      ),
      'byMode', (SELECT by_mode FROM modes_agg),
      'byType', COALESCE((SELECT jsonb_object_agg(type, jsonb_build_object('count', n, 'amount', amount)) FROM (SELECT type, COUNT(*) n, SUM(amount) amount FROM filtered_payments GROUP BY type) t), '{}'::jsonb),
      'topParties', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT party AS name, SUM(amount) AS amount FROM filtered_payments GROUP BY party ORDER BY amount DESC LIMIT 5) t), '[]'::jsonb),
      'monthlyTrend', (SELECT trend FROM monthly_trend)
    ) INTO v_result;

    RETURN v_result;
  END IF;
END;
$$;
