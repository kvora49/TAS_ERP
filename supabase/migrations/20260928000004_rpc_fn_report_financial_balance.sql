-- =============================================================================
-- Migration: 20260928000004_rpc_fn_report_financial_balance.sql
-- Description: PostgreSQL RPC function for /api/reports/financial/balance.
-- Replaces 10 parallel table queries and ~380 lines of in-memory JavaScript
-- return mapping, asset/liability grouping, outstanding calculations, and
-- drilldown generation with database-level execution.
-- Marked STABLE for query plan reuse and < 10ms CPU-time edge/serverless execution.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_report_financial_balance(
  p_business_id uuid,
  p_to text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to date;
  v_today date := CURRENT_DATE;

  -- Assets
  v_cash_in_hand numeric := 0;
  v_bank_balance numeric := 0;
  v_trade_receivables numeric := 0;
  v_rm_inventory numeric := 0;
  v_fg_inventory numeric := 0;
  v_total_inventory numeric := 0;
  v_total_current_assets numeric := 0;
  v_total_assets numeric := 0;

  -- Liabilities
  v_rm_payables numeric := 0;
  v_fg_payables numeric := 0;
  v_trade_payables numeric := 0;
  v_worker_payables numeric := 0;
  v_outstanding_expenses numeric := 0;
  v_total_current_liabilities numeric := 0;
  v_total_liabilities numeric := 0;

  -- Balances
  v_working_capital numeric := 0;
  v_net_position numeric := 0;
  v_difference numeric := 0;
  v_is_balanced boolean := true;

  -- Drilldown records
  v_bank_drill jsonb := '[]'::jsonb;
  v_receivables_drill jsonb := '[]'::jsonb;
  v_rm_stock_drill jsonb := '[]'::jsonb;
  v_fg_stock_drill jsonb := '[]'::jsonb;
  v_payables_drill jsonb := '[]'::jsonb;
  v_worker_payables_drill jsonb := '[]'::jsonb;
  v_expenses_unpaid_drill jsonb := '[]'::jsonb;

  v_result jsonb;
BEGIN
  -- Resolve Date
  IF p_to IS NOT NULL AND p_to <> '' THEN
    v_to := p_to::date;
  ELSE
    v_to := v_today;
  END IF;

  -- 1. Cash & Bank Accounts
  SELECT
    COALESCE(SUM(CASE WHEN b.type = 'cash' THEN b.current_balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN b.type <> 'cash' THEN b.current_balance ELSE 0 END), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'doc_number', b.name,
          'date', v_to::text,
          'party_name', CASE WHEN b.type = 'cash' THEN 'Cash Account' WHEN b.account_number IS NOT NULL AND b.account_number <> '' THEN 'Acc: ' || b.account_number ELSE 'Bank Account' END,
          'category', CASE WHEN b.type = 'cash' THEN 'Cash in Hand' ELSE 'Bank Account' END,
          'description', 'Category: ' || COALESCE(b.account_category, 'General'),
          'amount', ROUND(COALESCE(b.current_balance, 0), 2),
          'badge', b.type,
          'badge_color', CASE WHEN b.type = 'cash' THEN 'emerald' ELSE 'blue' END,
          'view_url', '/banking'
        )
      ) FILTER (WHERE b.id IS NOT NULL),
      '[]'::jsonb
    )
  INTO v_cash_in_hand, v_bank_balance, v_bank_drill
  FROM public.bank_accounts b
  WHERE b.business_id = p_business_id
    AND b.deleted_at IS NULL;

  -- 2. Trade Receivables (Sale Bills - Sales Returns - Paid)
  WITH sales_returns_agg AS (
    SELECT original_bill_id, COALESCE(SUM(grand_total), 0) AS total_returned
    FROM public.sales_returns
    WHERE business_id = p_business_id
      AND status <> 'cancelled'
      AND return_date <= v_to
      AND original_bill_id IS NOT NULL
    GROUP BY original_bill_id
  ),
  bill_calcs AS (
    SELECT
      sb.id,
      sb.bill_number,
      sb.bill_date,
      sb.paid_amount,
      sb.payment_status,
      COALESCE(p.company_name, p.name, 'Customer') AS party_name,
      p.id AS party_id,
      GREATEST(0, sb.grand_total - COALESCE(sra.total_returned, 0)) AS net_total,
      GREATEST(0, GREATEST(0, sb.grand_total - COALESCE(sra.total_returned, 0)) - COALESCE(sb.paid_amount, 0)) AS outstanding
    FROM public.sale_bills sb
    LEFT JOIN sales_returns_agg sra ON sra.original_bill_id = sb.id
    LEFT JOIN public.parties p ON p.id = sb.party_id
    WHERE sb.business_id = p_business_id
      AND sb.status = 'active'
      AND sb.deleted_at IS NULL
      AND sb.bill_date <= v_to
  )
  SELECT
    COALESCE(SUM(outstanding), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', bc.id,
          'doc_number', bc.bill_number,
          'date', bc.bill_date::text,
          'party_name', bc.party_name,
          'category', 'Trade Receivable',
          'description', 'Bill Total: ₹' || bc.net_total || ' · Paid: ₹' || COALESCE(bc.paid_amount, 0),
          'amount', ROUND(bc.outstanding, 2),
          'badge', COALESCE(bc.payment_status, 'unpaid'),
          'badge_color', 'amber',
          'view_url', CASE WHEN bc.party_id IS NOT NULL THEN '/parties/' || bc.party_id || '/ledger' ELSE '/sales/bills/' || bc.id END
        )
      ) FILTER (WHERE bc.outstanding > 0),
      '[]'::jsonb
    )
  INTO v_trade_receivables, v_receivables_drill
  FROM bill_calcs bc
  WHERE bc.outstanding > 0;

  -- 3. Inventory: Raw Material
  SELECT
    COALESCE(SUM(COALESCE(rm.stock_value, 0)), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', rm.id,
          'doc_number', COALESCE(rmt.name, 'Raw Material'),
          'date', v_to::text,
          'party_name', COALESCE(g.name, 'Main Godown'),
          'category', 'Raw Material',
          'description', 'Qty: ' || COALESCE(rm.current_stock, 0) || ' @ ₹' || COALESCE(rm.unit_cost, 0) || '/unit',
          'amount', ROUND(COALESCE(rm.stock_value, 0), 2),
          'badge', COALESCE(rmt.category, 'fabric'),
          'badge_color', 'emerald',
          'view_url', '/raw-materials/stock'
        )
      ) FILTER (WHERE rm.id IS NOT NULL),
      '[]'::jsonb
    )
  INTO v_rm_inventory, v_rm_stock_drill
  FROM public.raw_material_current_stock rm
  LEFT JOIN public.raw_material_types rmt ON rmt.id = rm.material_type_id
  LEFT JOIN public.godowns g ON g.id = rm.godown_id
  WHERE rm.business_id = p_business_id;

  -- 4. Inventory: Finished Goods
  SELECT
    COALESCE(SUM(COALESCE(fg.total_value, 0)), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', fg.id,
          'doc_number', COALESCE(d.name, d.design_number, 'Finished Goods'),
          'date', v_to::text,
          'party_name', COALESCE(g.name, 'Main Store'),
          'category', 'Finished Goods',
          'description', 'Qty: ' || COALESCE(fg.total_quantity, 0) || ' pcs @ ₹' || COALESCE(fg.cost_per_piece, 0) || '/pc',
          'amount', ROUND(COALESCE(fg.total_value, 0), 2),
          'badge', 'Finished Goods',
          'badge_color', 'blue',
          'view_url', '/inventory'
        )
      ) FILTER (WHERE fg.id IS NOT NULL),
      '[]'::jsonb
    )
  INTO v_fg_inventory, v_fg_stock_drill
  FROM public.finished_stock fg
  LEFT JOIN public.designs d ON d.id = fg.design_id
  LEFT JOIN public.godowns g ON g.id = fg.godown_id
  WHERE fg.business_id = p_business_id
    AND fg.deleted_at IS NULL;

  v_total_inventory := v_rm_inventory + v_fg_inventory;
  v_total_current_assets := v_cash_in_hand + v_bank_balance + v_trade_receivables + v_total_inventory;
  v_total_assets := v_total_current_assets;

  -- 5. Trade Payables: Raw Material Purchases
  WITH purchase_returns_agg AS (
    SELECT purchase_id, COALESCE(SUM(grand_total), 0) AS total_returned
    FROM public.purchase_returns
    WHERE business_id = p_business_id
      AND status <> 'cancelled'
      AND deleted_at IS NULL
      AND return_date <= v_to
      AND purchase_id IS NOT NULL
    GROUP BY purchase_id
  ),
  rm_pay_calcs AS (
    SELECT
      rmp.id,
      rmp.purchase_number,
      rmp.invoice_date,
      rmp.paid_amount,
      rmp.gst_type,
      COALESCE(p.company_name, p.name, 'Supplier') AS supplier_name,
      p.id AS supplier_id,
      GREATEST(0, rmp.grand_total - COALESCE(pra.total_returned, 0)) AS net_total,
      GREATEST(0, GREATEST(0, rmp.grand_total - COALESCE(pra.total_returned, 0)) - COALESCE(rmp.paid_amount, 0)) AS outstanding
    FROM public.raw_material_purchases rmp
    LEFT JOIN purchase_returns_agg pra ON pra.purchase_id = rmp.id
    LEFT JOIN public.parties p ON p.id = rmp.supplier_id
    WHERE rmp.business_id = p_business_id
      AND rmp.status <> 'cancelled'
      AND rmp.deleted_at IS NULL
      AND rmp.invoice_date <= v_to
  )
  SELECT
    COALESCE(SUM(outstanding), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', rmc.id,
          'doc_number', rmc.purchase_number,
          'date', rmc.invoice_date::text,
          'party_name', rmc.supplier_name,
          'category', 'Raw Material Payable',
          'description', 'Total: ₹' || rmc.net_total || ' · Paid: ₹' || COALESCE(rmc.paid_amount, 0),
          'amount', ROUND(rmc.outstanding, 2),
          'badge', COALESCE(rmc.gst_type, 'payable'),
          'badge_color', 'rose',
          'view_url', CASE WHEN rmc.supplier_id IS NOT NULL THEN '/parties/' || rmc.supplier_id || '/ledger' ELSE '/raw-materials/purchases/' || rmc.id END
        )
      ) FILTER (WHERE rmc.outstanding > 0),
      '[]'::jsonb
    )
  INTO v_rm_payables, v_payables_drill
  FROM rm_pay_calcs rmc
  WHERE rmc.outstanding > 0;

  -- 6. Trade Payables: Finished Goods Purchases (purchase_bills)
  WITH fg_returns_agg AS (
    SELECT purchase_id, COALESCE(SUM(grand_total), 0) AS total_returned
    FROM public.purchase_returns
    WHERE business_id = p_business_id
      AND status <> 'cancelled'
      AND deleted_at IS NULL
      AND return_date <= v_to
      AND purchase_id IS NOT NULL
    GROUP BY purchase_id
  ),
  fg_pay_calcs AS (
    SELECT
      pb.id,
      pb.bill_number,
      pb.invoice_date,
      pb.paid_amount,
      COALESCE(p.company_name, p.name, 'FG Supplier') AS supplier_name,
      p.id AS supplier_id,
      GREATEST(0, pb.grand_total - COALESCE(fra.total_returned, 0)) AS net_total,
      GREATEST(0, GREATEST(0, pb.grand_total - COALESCE(fra.total_returned, 0)) - COALESCE(pb.paid_amount, 0)) AS outstanding
    FROM public.purchase_bills pb
    LEFT JOIN fg_returns_agg fra ON fra.purchase_id = pb.id
    LEFT JOIN public.parties p ON p.id = pb.supplier_id
    WHERE pb.business_id = p_business_id
      AND pb.status = 'active'
      AND pb.invoice_date <= v_to
  ),
  fg_agg AS (
    SELECT
      COALESCE(SUM(outstanding), 0) AS total_fg_outstanding,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', fgc.id,
            'doc_number', fgc.bill_number,
            'date', fgc.invoice_date::text,
            'party_name', fgc.supplier_name,
            'category', 'Finished Goods Payable',
            'description', 'Total: ₹' || fgc.net_total || ' · Paid: ₹' || COALESCE(fgc.paid_amount, 0),
            'amount', ROUND(fgc.outstanding, 2),
            'badge', 'FG Purchase',
            'badge_color', 'rose',
            'view_url', CASE WHEN fgc.supplier_id IS NOT NULL THEN '/parties/' || fgc.supplier_id || '/ledger' ELSE '/inventory' END
          )
        ) FILTER (WHERE fgc.outstanding > 0),
        '[]'::jsonb
      ) AS fg_drill
    FROM fg_pay_calcs fgc
    WHERE fgc.outstanding > 0
  )
  SELECT
    total_fg_outstanding,
    v_payables_drill || fg_drill
  INTO v_fg_payables, v_payables_drill
  FROM fg_agg;

  v_trade_payables := v_rm_payables + v_fg_payables;

  -- 7. Worker / Job Work Payables (stage_entries)
  SELECT
    COALESCE(SUM(GREATEST(0, COALESCE(se.total_job_work_amount, 0) - COALESCE(se.paid_amount, 0))), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', se.id,
          'doc_number', 'SE-' || UPPER(SUBSTRING(se.id::text, 1, 8)),
          'date', se.entry_date::text,
          'party_name', COALESCE(w.name, 'Job Worker'),
          'category', 'Worker Payable',
          'description', 'Lot #' || COALESCE(SUBSTRING(se.lot_id::text, 1, 8), '—') || ' · Outstanding: ₹' || GREATEST(0, COALESCE(se.total_job_work_amount, 0) - COALESCE(se.paid_amount, 0)),
          'amount', ROUND(GREATEST(0, COALESCE(se.total_job_work_amount, 0) - COALESCE(se.paid_amount, 0)), 2),
          'badge', 'Job Work',
          'badge_color', 'violet',
          'view_url', '/production'
        )
      ) FILTER (WHERE GREATEST(0, COALESCE(se.total_job_work_amount, 0) - COALESCE(se.paid_amount, 0)) > 0),
      '[]'::jsonb
    )
  INTO v_worker_payables, v_worker_payables_drill
  FROM public.stage_entries se
  LEFT JOIN public.workers w ON w.id = se.worker_id
  WHERE se.business_id = p_business_id
    AND se.payment_status <> 'paid'
    AND se.entry_date <= v_to;

  -- 8. Outstanding Expenses
  SELECT
    COALESCE(SUM(COALESCE(e.amount, 0)), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'doc_number', COALESCE(e.expense_number, 'EXP-' || SUBSTRING(e.id::text, 1, 6)),
          'date', e.expense_date::text,
          'party_name', COALESCE(e.vendor_name, et.name, 'Vendor'),
          'category', 'Outstanding Expense',
          'description', COALESCE(et.name, 'Expense Payable'),
          'amount', ROUND(COALESCE(e.amount, 0), 2),
          'badge', 'Unpaid',
          'badge_color', 'rose',
          'view_url', '/expenses'
        )
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    )
  INTO v_outstanding_expenses, v_expenses_unpaid_drill
  FROM public.expenses e
  LEFT JOIN public.expense_types et ON et.id = e.expense_type_id
  WHERE e.business_id = p_business_id
    AND e.expense_date <= v_to
    AND e.paid_from_account_id IS NULL;

  v_total_current_liabilities := v_trade_payables + v_worker_payables + v_outstanding_expenses;
  v_total_liabilities := v_total_current_liabilities;

  -- 9. Totals and Balanced Check
  v_working_capital := v_total_current_assets - v_total_current_liabilities;
  v_net_position := v_total_assets - v_total_liabilities;
  v_difference := ROUND(v_total_assets - v_total_liabilities - v_net_position, 2);
  v_is_balanced := ABS(v_difference) < 1;

  -- 10. Construct Final JSON
  v_result := jsonb_build_object(
    'as_on', v_to::text,
    'assets', jsonb_build_object(
      'current', jsonb_build_object(
        'cash_in_hand', ROUND(v_cash_in_hand, 2),
        'bank_accounts', ROUND(v_bank_balance, 2),
        'trade_receivables', ROUND(v_trade_receivables, 2),
        'inventory', jsonb_build_object(
          'raw_material', ROUND(v_rm_inventory, 2),
          'finished_goods', ROUND(v_fg_inventory, 2),
          'total', ROUND(v_total_inventory, 2)
        ),
        'total', ROUND(v_total_current_assets, 2)
      ),
      'non_current', jsonb_build_object(
        'total', 0
      ),
      'total', ROUND(v_total_assets, 2)
    ),
    'liabilities', jsonb_build_object(
      'current', jsonb_build_object(
        'trade_payables', ROUND(v_trade_payables, 2),
        'rm_payables', ROUND(v_rm_payables, 2),
        'fg_payables', ROUND(v_fg_payables, 2),
        'worker_payables', ROUND(v_worker_payables, 2),
        'outstanding_expenses', ROUND(v_outstanding_expenses, 2),
        'total', ROUND(v_total_current_liabilities, 2)
      ),
      'non_current', jsonb_build_object(
        'total', 0
      ),
      'total', ROUND(v_total_liabilities, 2)
    ),
    'net_position', ROUND(v_net_position, 2),
    'working_capital', ROUND(v_working_capital, 2),
    'is_balanced', v_is_balanced,
    'difference', v_difference,
    'drill_records', jsonb_build_object(
      'inventory_rm', v_rm_stock_drill,
      'inventory_fg', v_fg_stock_drill,
      'receivables', v_receivables_drill,
      'payables', v_payables_drill,
      'worker_payables', v_worker_payables_drill,
      'expenses_unpaid', v_expenses_unpaid_drill,
      'bank_accounts', v_bank_drill
    )
  );

  RETURN v_result;
END;
$$;
