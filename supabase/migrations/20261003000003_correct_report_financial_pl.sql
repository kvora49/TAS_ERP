-- =============================================================================
-- Migration: 20260928000003_rpc_fn_report_financial_pl.sql
-- Description: PostgreSQL RPC function for /api/reports/financial/pl.
-- Replaces 10 parallel table queries and ~350 lines of in-memory JavaScript
-- item portioning, return ratios, COGS calculation, and drilldown generation
-- with a single database-level execution.
-- STABLE uses one statement snapshot; it does not cache results across requests.
-- =============================================================================

-- Replaces route-level raw-row fetch/group/sum/reduce work with PostgreSQL aggregation
-- to reduce application CPU and transferred intermediate rows for edge/serverless compatibility.
-- Read-only STABLE SECURITY INVOKER preserves caller RLS.
CREATE OR REPLACE FUNCTION public.fn_report_financial_pl(
  p_business_id uuid,
  p_from text DEFAULT NULL,
  p_to text DEFAULT NULL,
  p_bill_type text DEFAULT NULL
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

  -- Revenue totals
  v_gross_revenue numeric := 0;
  v_returns_total numeric := 0;
  v_return_ratio numeric := 0;
  v_rev_fg numeric := 0;
  v_rev_fabric numeric := 0;
  v_rev_accessory numeric := 0;
  v_rev_others numeric := 0;
  v_total_revenue numeric := 0;

  -- Purchases totals
  v_purch_fabric numeric := 0;
  v_purch_fg numeric := 0;
  v_purch_accessory numeric := 0;
  v_purch_others numeric := 0;
  v_purch_grand_total numeric := 0;
  v_rcm_purchases numeric := 0;
  v_normal_purchases numeric := 0;

  -- Closing Stock
  v_closing_rm numeric := 0;
  v_closing_fg numeric := 0;
  v_closing_stock numeric := 0;

  -- COGS
  v_cogs_rm numeric := 0;
  v_cogs_fg numeric := 0;
  v_cogs_accessory numeric := 0;
  v_job_work_expense numeric := 0;
  v_total_cogs numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin_pct numeric;

  -- Operating Expenses
  v_total_operating_expenses numeric := 0;
  v_total_salary numeric := 0;
  v_total_operating numeric := 0;
  v_operating_profit numeric := 0;
  v_expense_ratio_pct numeric;

  -- Misc Income & Other Expenses
  v_total_misc_income numeric := 0;
  v_total_writeoffs numeric := 0;
  v_net_profit numeric := 0;
  v_net_margin_pct numeric;

  -- JSON Arrays
  v_sales_drill jsonb := '[]'::jsonb;
  v_returns_drill jsonb := '[]'::jsonb;
  v_purchases_drill jsonb := '[]'::jsonb;
  v_job_work_drill jsonb := '[]'::jsonb;
  v_expense_drill jsonb := '[]'::jsonb;
  v_salary_drill jsonb := '[]'::jsonb;
  v_misc_income_drill jsonb := '[]'::jsonb;
  v_writeoffs_drill jsonb := '[]'::jsonb;
  v_exp_breakdown jsonb := '{}'::jsonb;
  v_misc_breakdown jsonb := '{}'::jsonb;

  v_result jsonb;
  v_opening_rm numeric := 0;
  v_opening_fg numeric := 0;
BEGIN
  -- 1. Date resolution
  IF p_to IS NOT NULL AND p_to <> '' THEN
    v_to := p_to::date;
  ELSE
    v_to := v_today;
  END IF;

  IF p_from IS NOT NULL AND p_from <> '' THEN
    v_from := p_from::date;
  ELSE
    IF EXTRACT(MONTH FROM v_today) >= 4 THEN
      v_from := make_date(EXTRACT(YEAR FROM v_today)::int, 4, 1);
    ELSE
      v_from := make_date(EXTRACT(YEAR FROM v_today)::int - 1, 4, 1);
    END IF;
  END IF;

  -- 2. Sales Returns
  SELECT COALESCE(SUM(grand_total), 0)
  INTO v_returns_total
  FROM public.sales_returns
  WHERE business_id = p_business_id
    AND status != 'cancelled'
    AND return_date BETWEEN v_from AND v_to;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'doc_number', sr.return_number,
      'date', sr.return_date,
      'party_name', COALESCE(p.company_name, p.name, 'Customer'),
      'description', 'Sales Return Inward',
      'amount', sr.grand_total,
      'badge', 'Return',
      'badge_color', 'rose',
      'view_url', '/sales/returns/' || sr.id
    )
  ), '[]'::jsonb)
  INTO v_returns_drill
  FROM public.sales_returns sr
  LEFT JOIN public.parties p ON p.id = sr.party_id AND p.business_id = p_business_id
  WHERE sr.business_id = p_business_id
    AND sr.status != 'cancelled'
    AND sr.return_date BETWEEN v_from AND v_to;

  -- 3. Sale Bills & Portioning
  WITH bills_base AS (
    SELECT
      sb.id,
      sb.bill_number,
      sb.bill_date,
      sb.bill_type,
      sb.grand_total::numeric AS grand_total,
      COALESCE(p.company_name, p.name, 'Customer') AS party_name
    FROM public.sale_bills sb
    LEFT JOIN public.parties p ON p.id = sb.party_id AND p.business_id = p_business_id
    WHERE sb.business_id = p_business_id
      AND sb.status = 'active'
      AND sb.deleted_at IS NULL
      AND sb.bill_date BETWEEN v_from AND v_to
      AND (p_bill_type IS NULL OR p_bill_type = 'all' OR sb.bill_type = p_bill_type)
  ),
  items_with_ratio AS (
    SELECT
      bb.id,
      bb.bill_number,
      bb.bill_date,
      bb.bill_type,
      bb.party_name,
      bb.grand_total,
      COALESCE(COALESCE(to_jsonb(sbi)->>'item_type', 'finished_goods'), 'finished_goods') AS item_type,
      COALESCE(sbi.quantity, 1) AS quantity,
      COALESCE(sbi.rate, 0) AS rate,
      CASE
        WHEN sbi_sum.total_items_amt > 0 THEN (sbi.amount / sbi_sum.total_items_amt) * bb.grand_total
        ELSE bb.grand_total
      END AS portion_amt
    FROM bills_base bb
    LEFT JOIN (
      SELECT bill_id, SUM(amount) AS total_items_amt
      FROM public.sale_bill_items
      GROUP BY bill_id
    ) sbi_sum ON sbi_sum.bill_id = bb.id
    LEFT JOIN public.sale_bill_items sbi ON sbi.bill_id = bb.id
  )
  SELECT
    (SELECT COALESCE(SUM(grand_total), 0) FROM bills_base),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'finished_goods'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'fabric'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'accessory'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type NOT IN ('finished_goods', 'fabric', 'accessory')), 0)
  INTO v_gross_revenue, v_rev_fg, v_rev_fabric, v_rev_accessory, v_rev_others
  FROM (
    SELECT DISTINCT id, grand_total FROM bills_base
  ) b_unique
  LEFT JOIN LATERAL (
    SELECT
      portion_amt,
      item_type
    FROM items_with_ratio iwr
    WHERE iwr.id = b_unique.id
  ) lat ON true;

  -- Handle case where bills had no items (default to finished_goods)
  IF (v_rev_fg + v_rev_fabric + v_rev_accessory + v_rev_others) = 0 AND v_gross_revenue > 0 THEN
    v_rev_fg := v_gross_revenue;
  END IF;

  -- Apply return ratio to revenue buckets
  IF v_gross_revenue > 0 THEN
    v_return_ratio := v_returns_total / v_gross_revenue;
  ELSE
    v_return_ratio := 0;
  END IF;

  v_rev_fg := GREATEST(0, v_rev_fg * (1 - v_return_ratio));
  v_rev_fabric := GREATEST(0, v_rev_fabric * (1 - v_return_ratio));
  v_rev_accessory := GREATEST(0, v_rev_accessory * (1 - v_return_ratio));
  v_rev_others := GREATEST(0, v_rev_others * (1 - v_return_ratio));
  v_total_revenue := v_rev_fg + v_rev_fabric + v_rev_accessory + v_rev_others;

  -- Sales drilldown records
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sb.id || '-' || COALESCE(COALESCE(to_jsonb(sbi)->>'item_type', 'finished_goods'), 'fg'),
      'doc_number', sb.bill_number,
      'date', sb.bill_date,
      'party_name', COALESCE(p.company_name, p.name, 'Customer'),
      'category', CASE
        WHEN COALESCE(to_jsonb(sbi)->>'item_type', 'finished_goods') = 'fabric' THEN 'Raw Material / Fabric'
        WHEN COALESCE(to_jsonb(sbi)->>'item_type', 'finished_goods') = 'accessory' THEN 'Accessories & Trims'
        WHEN COALESCE(to_jsonb(sbi)->>'item_type', 'finished_goods') = 'others' THEN 'Others'
        ELSE 'Finished Goods'
      END,
      'description', COALESCE(sbi.quantity::text || ' pcs/mtrs @ ₹' || sbi.rate::text, '1 pcs @ ₹' || sb.grand_total::text),
      'amount', ROUND(COALESCE(sbi.amount, sb.grand_total), 2),
      'badge', sb.bill_type,
      'badge_color', CASE WHEN sb.bill_type = 'pakka' THEN 'blue' ELSE 'amber' END,
      'view_url', '/sales/bills/' || sb.id
    )
  ), '[]'::jsonb)
  INTO v_sales_drill
  FROM public.sale_bills sb
  LEFT JOIN public.parties p ON p.id = sb.party_id AND p.business_id = p_business_id
  LEFT JOIN public.sale_bill_items sbi ON sbi.bill_id = sb.id
  WHERE sb.business_id = p_business_id
    AND sb.status = 'active'
    AND sb.deleted_at IS NULL
    AND sb.bill_date BETWEEN v_from AND v_to
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR sb.bill_type = p_bill_type);

  -- 4. Purchases Calculation & Portioning
  WITH purch_base AS (
    SELECT
      rmp.id,
      rmp.purchase_number,
      rmp.invoice_date,
      rmp.gst_type,
      rmp.grand_total::numeric AS grand_total,
      COALESCE(p.company_name, p.name, 'Supplier') AS supplier_name
    FROM public.raw_material_purchases rmp
    LEFT JOIN public.parties p ON p.id = rmp.supplier_id AND p.business_id = p_business_id
    WHERE rmp.business_id = p_business_id
      AND rmp.status != 'cancelled'
      AND rmp.deleted_at IS NULL
      AND rmp.invoice_date BETWEEN v_from AND v_to
      AND (
        p_bill_type IS NULL
        OR (p_bill_type = 'pakka' AND rmp.gst_type != 'without_gst')
        OR (p_bill_type = 'kacha' AND rmp.gst_type = 'without_gst')
      )
  ),
  purch_items AS (
    SELECT
      pb.id,
      pb.purchase_number,
      pb.invoice_date,
      pb.gst_type,
      pb.supplier_name,
      pb.grand_total,
      COALESCE(rmpi.item_type, 'fabric') AS item_type,
      rmpi.other_category,
      COALESCE(rmpi.quantity, 1) AS quantity,
      COALESCE(rmpi.rate, 0) AS rate,
      CASE
        WHEN pi_sum.total_items_amt > 0 THEN (rmpi.amount / pi_sum.total_items_amt) * pb.grand_total
        ELSE pb.grand_total
      END AS portion_amt
    FROM purch_base pb
    LEFT JOIN (
      SELECT purchase_id, SUM(amount) AS total_items_amt
      FROM public.raw_material_purchase_items
      GROUP BY purchase_id
    ) pi_sum ON pi_sum.purchase_id = pb.id
    LEFT JOIN public.raw_material_purchase_items rmpi ON rmpi.purchase_id = pb.id
  )
  SELECT
    (SELECT COALESCE(SUM(grand_total), 0) FROM purch_base),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'fabric'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'finished_goods'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type = 'accessory'), 0),
    COALESCE(SUM(portion_amt) FILTER (WHERE item_type NOT IN ('fabric', 'finished_goods', 'accessory') AND other_category != 'capital_asset'), 0),
    (SELECT COALESCE(SUM(grand_total) FILTER (WHERE gst_type = 'reverse_charge'), 0) FROM purch_base),
    (SELECT COALESCE(SUM(grand_total) FILTER (WHERE gst_type != 'reverse_charge'), 0) FROM purch_base)
  INTO v_purch_grand_total, v_purch_fabric, v_purch_fg, v_purch_accessory, v_purch_others, v_rcm_purchases, v_normal_purchases
  FROM (
    SELECT DISTINCT id, grand_total, gst_type FROM purch_base
  ) pb_uniq
  LEFT JOIN LATERAL (
    SELECT portion_amt, item_type, other_category FROM purch_items pi WHERE pi.id = pb_uniq.id
  ) lat_pi ON true;

  IF (v_purch_fabric + v_purch_fg + v_purch_accessory + v_purch_others) = 0 THEN
    v_purch_fabric := v_purch_grand_total;
  END IF;

  -- Purchases drilldown records
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', rmp.id || '-' || COALESCE(rmpi.item_type, 'rm'),
      'doc_number', rmp.purchase_number,
      'date', rmp.invoice_date,
      'party_name', COALESCE(p.company_name, p.name, 'Supplier'),
      'category', CASE
        WHEN rmpi.item_type = 'finished_goods' THEN 'Finished Goods'
        WHEN rmpi.item_type = 'accessory' THEN 'Accessories'
        WHEN rmpi.item_type = 'others' THEN 'Others'
        ELSE 'Raw Material'
      END,
      'description', COALESCE(rmpi.quantity::text || ' @ ₹' || rmpi.rate::text, '1 @ ₹' || rmp.grand_total::text),
      'amount', ROUND(COALESCE(rmpi.amount, rmp.grand_total), 2),
      'badge', rmp.gst_type,
      'badge_color', CASE WHEN rmp.gst_type = 'reverse_charge' THEN 'amber' ELSE 'slate' END,
      'view_url', '/raw-materials/purchases/' || rmp.id
    )
  ), '[]'::jsonb)
  INTO v_purchases_drill
  FROM public.raw_material_purchases rmp
  LEFT JOIN public.parties p ON p.id = rmp.supplier_id AND p.business_id = p_business_id
  LEFT JOIN public.raw_material_purchase_items rmpi ON rmpi.purchase_id = rmp.id
  WHERE rmp.business_id = p_business_id
    AND rmp.status != 'cancelled'
    AND rmp.deleted_at IS NULL
    AND rmp.invoice_date BETWEEN v_from AND v_to;

  -- Opening inventory is the value before the period. Ledger dates are posting dates.
  SELECT COALESCE(SUM(value_delta) FILTER (WHERE item_type = 'raw_material'), 0),
         COALESCE(SUM(value_delta) FILTER (WHERE item_type = 'finished_good'), 0)
  INTO v_opening_rm, v_opening_fg FROM public.stock_ledger
  WHERE business_id = p_business_id AND created_at < v_from::timestamp;
  -- 5. Closing Stock
  SELECT COALESCE(SUM(value_delta), 0) INTO v_closing_rm FROM public.stock_ledger
  WHERE business_id = p_business_id AND item_type = 'raw_material' AND created_at < (v_to + 1)::timestamp;

  SELECT COALESCE(SUM(value_delta), 0) INTO v_closing_fg FROM public.stock_ledger
  WHERE business_id = p_business_id AND item_type = 'finished_good' AND created_at < (v_to + 1)::timestamp;

  v_closing_stock := v_closing_rm + v_closing_fg;

  -- 6. Job Work Expenses
  SELECT COALESCE(SUM(total_job_work_amount), 0)
  INTO v_job_work_expense
  FROM public.stage_entries
  WHERE business_id = p_business_id
    AND entry_date BETWEEN v_from AND v_to;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'doc_number', 'JW-' || UPPER(SUBSTRING(se.id::text, 1, 8)),
      'date', se.entry_date,
      'party_name', COALESCE(w.name, 'Job Worker'),
      'description', 'Production Lot #' || COALESCE(SUBSTRING(se.lot_id::text, 1, 8), '—'),
      'amount', COALESCE(se.total_job_work_amount, 0),
      'badge', 'Job Work',
      'badge_color', 'violet',
      'view_url', CASE WHEN se.lot_id IS NOT NULL THEN '/production/lots/' || se.lot_id ELSE '/production' END
    )
  ), '[]'::jsonb)
  INTO v_job_work_drill
  FROM public.stage_entries se
  LEFT JOIN public.workers w ON w.id = se.worker_id AND w.business_id = p_business_id
  WHERE se.business_id = p_business_id
    AND se.entry_date BETWEEN v_from AND v_to;

  -- 7. COGS & Gross Profit
  v_cogs_rm := GREATEST(0, v_opening_rm + v_purch_fabric - v_closing_rm);
  v_cogs_fg := GREATEST(0, v_opening_fg + v_purch_fg - v_closing_fg);
  v_cogs_accessory := v_purch_accessory;
  v_total_cogs := v_cogs_rm + v_cogs_fg + v_cogs_accessory + v_job_work_expense;
  v_gross_profit := v_total_revenue - v_total_cogs;

  IF v_total_revenue > 0 THEN
    v_gross_margin_pct := ROUND(((v_gross_profit / v_total_revenue) * 100)::numeric, 2);
  ELSE
    v_gross_margin_pct := NULL;
  END IF;

  -- 8. Operating Expenses (Expenses + Salary)
  SELECT
    COALESCE(jsonb_object_agg(cat_name, cat_total), '{}'::jsonb),
    COALESCE(SUM(cat_total), 0)
  INTO v_exp_breakdown, v_total_operating_expenses
  FROM (
    SELECT
      COALESCE(et.name, 'General Expense') AS cat_name,
      SUM(e.amount) AS cat_total
    FROM public.expenses e
    LEFT JOIN public.expense_types et ON et.id = e.expense_type_id AND et.business_id = p_business_id
    WHERE e.business_id = p_business_id
      AND e.expense_date BETWEEN v_from AND v_to
    GROUP BY et.name
  ) exp_agg;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'doc_number', COALESCE(e.expense_number, 'EXP-' || SUBSTRING(e.id::text, 1, 6)),
      'date', e.expense_date,
      'party_name', COALESCE(e.vendor_name, et.name, 'General Expense'),
      'category', COALESCE(et.name, 'General Expense'),
      'description', 'Expense: ' || COALESCE(et.name, 'General Expense'),
      'amount', e.amount,
      'badge', COALESCE(et.name, 'General Expense'),
      'badge_color', 'amber',
      'view_url', '/expenses'
    )
  ), '[]'::jsonb)
  INTO v_expense_drill
  FROM public.expenses e
  LEFT JOIN public.expense_types et ON et.id = e.expense_type_id AND et.business_id = p_business_id
  WHERE e.business_id = p_business_id
    AND e.expense_date BETWEEN v_from AND v_to;

  SELECT COALESCE(SUM(net_salary), 0)
  INTO v_total_salary
  FROM public.salary_entries
  WHERE business_id = p_business_id
    AND payment_date BETWEEN v_from AND v_to;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'doc_number', 'SAL-' || se.salary_month::text || '/' || se.salary_year::text,
      'date', se.payment_date,
      'party_name', COALESCE(p.name, p.company_name, 'Staff'),
      'description', 'Monthly Salary payout for ' || se.salary_month::text || '/' || se.salary_year::text,
      'amount', se.net_salary,
      'badge', 'Salary',
      'badge_color', 'emerald',
      'view_url', '/payroll'
    )
  ), '[]'::jsonb)
  INTO v_salary_drill
  FROM public.salary_entries se
  LEFT JOIN public.parties p ON p.id = se.worker_id AND p.business_id = p_business_id
  WHERE se.business_id = p_business_id
    AND se.payment_date BETWEEN v_from AND v_to;

  v_total_operating := v_total_operating_expenses + v_total_salary;
  v_operating_profit := v_gross_profit - v_total_operating;

  IF v_total_revenue > 0 THEN
    v_expense_ratio_pct := ROUND(((v_total_operating / v_total_revenue) * 100)::numeric, 2);
  ELSE
    v_expense_ratio_pct := NULL;
  END IF;

  -- 9. Misc Income
  SELECT
    COALESCE(jsonb_object_agg(inc_type, inc_total), '{}'::jsonb),
    COALESCE(SUM(inc_total), 0)
  INTO v_misc_breakdown, v_total_misc_income
  FROM (
    SELECT
      COALESCE(income_type, 'Other Income') AS inc_type,
      SUM(amount) AS inc_total
    FROM public.misc_income
    WHERE business_id = p_business_id
      AND income_date BETWEEN v_from AND v_to
    GROUP BY income_type
  ) mi_agg;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'doc_number', COALESCE(mi.income_number, 'INC-' || SUBSTRING(mi.id::text, 1, 6)),
      'date', mi.income_date,
      'party_name', COALESCE(mi.income_type, 'Other Income'),
      'description', COALESCE(mi.notes, 'Miscellaneous Income'),
      'amount', mi.amount,
      'badge', COALESCE(mi.income_type, 'Other Income'),
      'badge_color', 'blue',
      'view_url', '/banking'
    )
  ), '[]'::jsonb)
  INTO v_misc_income_drill
  FROM public.misc_income mi
  WHERE mi.business_id = p_business_id
    AND mi.income_date BETWEEN v_from AND v_to;

  -- 10. Writeoffs
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_writeoffs
  FROM public.write_offs
  WHERE business_id = p_business_id
    AND reversed_at IS NULL AND bill_type = 'sale_bill' AND written_off_at >= v_from::timestamp AND written_off_at < (v_to + 1)::timestamp;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', wo.id,
      'doc_number', 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8)),
      'date', wo.written_off_at,
      'party_name', 'Bad Debt Write-off',
      'description', COALESCE(wo.remarks, 'Invoice Bad Debt Written Off'),
      'amount', wo.amount,
      'badge', 'Write-off',
      'badge_color', 'rose',
      'view_url', '/sales/bills'
    )
  ), '[]'::jsonb)
  INTO v_writeoffs_drill
  FROM public.write_offs wo
  WHERE wo.business_id = p_business_id
    AND wo.reversed_at IS NULL AND wo.bill_type = 'sale_bill' AND wo.written_off_at >= v_from::timestamp AND wo.written_off_at < (v_to + 1)::timestamp;

  -- 11. Net Profit & Margins
  v_net_profit := v_operating_profit + v_total_misc_income - v_total_writeoffs;

  IF v_total_revenue > 0 THEN
    v_net_margin_pct := ROUND(((v_net_profit / v_total_revenue) * 100)::numeric, 2);
  ELSE
    v_net_margin_pct := NULL;
  END IF;

  -- 12. Final Response JSON
  v_result := jsonb_build_object(
    'from', v_from::text,
    'to', v_to::text,
    'bill_type', COALESCE(p_bill_type, 'all'),
    'revenue', jsonb_build_object(
      'finished_goods', ROUND(v_rev_fg, 2),
      'raw_material', ROUND(v_rev_fabric, 2),
      'accessories', ROUND(v_rev_accessory, 2),
      'others', ROUND(v_rev_others, 2),
      'gross_revenue', ROUND(v_gross_revenue, 2),
      'returns', ROUND(v_returns_total, 2),
      'total', ROUND(v_total_revenue, 2),
      'drill_records', v_sales_drill,
      'returns_drill_records', v_returns_drill
    ),
    'misc_income', jsonb_build_object(
      'breakdown', v_misc_breakdown,
      'total', ROUND(v_total_misc_income, 2),
      'drill_records', v_misc_income_drill
    ),
    'total_income', ROUND(v_total_revenue + v_total_misc_income, 2),
    'cogs', jsonb_build_object(
      'raw_material', ROUND(v_cogs_rm, 2),
      'finished_goods', ROUND(v_cogs_fg, 2),
      'accessories', ROUND(v_cogs_accessory, 2),
      'manufactured', 0,
      'job_work', ROUND(v_job_work_expense, 2),
      'total', ROUND(v_total_cogs, 2),
      'purchases_in_period', jsonb_build_object(
        'fabric', ROUND(v_purch_fabric, 2),
        'finished_goods', ROUND(v_purch_fg, 2),
        'accessories', ROUND(v_purch_accessory, 2),
        'others', ROUND(v_purch_others, 2),
        'rcm', ROUND(v_rcm_purchases, 2),
        'normal', ROUND(v_normal_purchases, 2)
      ),
      'opening_stock', jsonb_build_object('raw_material', v_opening_rm, 'finished_goods', v_opening_fg, 'total', v_opening_rm + v_opening_fg),
      'closing_stock', jsonb_build_object(
        'raw_material', ROUND(v_closing_rm, 2),
        'finished_goods', ROUND(v_closing_fg, 2),
        'total', ROUND(v_closing_stock, 2)
      ),
      'purchases_drill_records', v_purchases_drill,
      'job_work_drill_records', v_job_work_drill
    ),
    'gross_profit', ROUND(v_gross_profit, 2),
    'gross_margin_pct', v_gross_margin_pct,
    'operating_expenses', jsonb_build_object(
      'breakdown', v_exp_breakdown,
      'expenses_total', ROUND(v_total_operating_expenses, 2),
      'salary', ROUND(v_total_salary, 2),
      'total', ROUND(v_total_operating, 2),
      'drill_records', v_expense_drill,
      'salary_drill_records', v_salary_drill
    ),
    'expense_ratio_pct', v_expense_ratio_pct,
    'operating_profit', ROUND(v_operating_profit, 2),
    'other_expenses', jsonb_build_object(
      'bad_debts', ROUND(v_total_writeoffs, 2),
      'total', ROUND(v_total_writeoffs, 2),
      'drill_records', v_writeoffs_drill
    ),
    'net_profit', ROUND(v_net_profit, 2),
    'net_margin_pct', v_net_margin_pct
  );

  RETURN v_result;
END;
$$;
