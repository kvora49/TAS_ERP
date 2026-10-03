DROP FUNCTION IF EXISTS public.fn_report_analysis(uuid,text,text,text,uuid);
-- =============================================================================
-- Migration: 20260928000002_rpc_fn_report_analysis.sql
-- Description: PostgreSQL RPC function for /api/reports/analysis.
-- Replaces 18 sequential/parallel DB queries and ~350 lines of in-memory JS reductions,
-- comparisons, and array reductions with a single database-level CTE calculation.
-- STABLE read-only aggregation reduces JavaScript CPU and data transfer; benchmark latency separately.
-- =============================================================================

-- Replaces route-level raw-row fetch/group/sum/reduce work with PostgreSQL aggregation
-- to reduce application CPU and transferred intermediate rows for edge/serverless compatibility.
-- Read-only STABLE SECURITY INVOKER preserves caller RLS.
CREATE OR REPLACE FUNCTION public.fn_report_analysis(
  p_business_id uuid,
  p_from text DEFAULT NULL,
  p_to text DEFAULT NULL,
  p_bill_type text DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_compare text DEFAULT 'prev_period'
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
  v_cmp_from date;
  v_cmp_to date;
  v_duration int;
  v_today date := CURRENT_DATE;

  -- Aggregated variables
  v_sales_total numeric := 0;
  v_sales_cmp_total numeric := 0;
  v_sales_return_total numeric := 0;
  v_net_sales numeric := 0;
  v_net_sales_cmp numeric := 0;
  v_sales_growth numeric := 0;
  v_sales_bills_count int := 0;

  v_rm_total numeric := 0;
  v_fg_total numeric := 0;
  v_purchases_total numeric := 0;
  v_purchases_cmp_total numeric := 0;
  v_purchase_return_total numeric := 0;
  v_net_purchases numeric := 0;
  v_purchases_growth numeric := 0;
  v_purchases_bills_count int := 0;

  v_expenses_total numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin numeric := 0;
  v_net_profit numeric := 0;
  v_net_margin numeric := 0;

  v_collections_total numeric := 0;
  v_collections_cmp_total numeric := 0;
  v_collections_growth numeric := 0;

  v_payments_out_total numeric := 0;
  v_payments_cmp_out_total numeric := 0;
  v_payments_growth numeric := 0;

  v_inventory_value numeric := 0;
  v_inventory_qty numeric := 0;

  v_total_lots int := 0;
  v_completed_lots int := 0;
  v_wip_lots int := 0;
  v_total_qty_in numeric := 0;
  v_total_qty_out numeric := 0;
  v_total_wastage numeric := 0;
  v_efficiency numeric := 0;
  v_rework_qty numeric := 0;
  v_damage_qty numeric := 0;
  v_production_cost numeric := 0;

  v_total_receivables numeric := 0;
  v_overdue_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_overdue_payables numeric := 0;

  v_cash_balance numeric := 0;
  v_opening_balance numeric := 0;

  -- Complex JSON containers
  v_sales_by_category jsonb := '[]'::jsonb;
  v_sales_by_bill_type jsonb := '[]'::jsonb;
  v_purchase_by_type jsonb := '[]'::jsonb;
  v_stage_efficiency jsonb := '[]'::jsonb;
  v_top_customers jsonb := '[]'::jsonb;
  v_top_suppliers jsonb := '[]'::jsonb;
  v_monthly_trend jsonb := '[]'::jsonb;
  v_alerts jsonb := '[]'::jsonb;

  v_result jsonb;
  v_cmp_returns numeric := 0;
  v_pl jsonb;
  v_prior_pl jsonb;
  v_receivables jsonb;
  v_payables jsonb;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
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

  v_duration := (v_to - v_from);
  v_cmp_to := v_from - 1;
  v_cmp_from := v_cmp_to - v_duration;
  IF p_compare = 'prev_fy' THEN
    v_cmp_from := (v_from - interval '1 year')::date;
    v_cmp_to := (v_to - interval '1 year')::date;
  ELSIF p_compare = 'prev_month' THEN
    v_cmp_from := (v_from - interval '1 month')::date;
    v_cmp_to := (v_to - interval '1 month')::date;
  ELSIF p_compare = 'prev_quarter' THEN
    v_cmp_from := (v_from - interval '3 months')::date;
    v_cmp_to := (v_to - interval '3 months')::date;
  END IF;

  -- 2. Sales Metrics (Current & Comparison Period)
  SELECT
    COALESCE(SUM(grand_total), 0),
    COUNT(*)::int
  INTO v_sales_total, v_sales_bills_count
  FROM public.sale_bills
  WHERE business_id = p_business_id
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR COALESCE(to_jsonb(sale_bills)->>'bill_type', 'pakka') = p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sale_bills.id AND d.brand_id = p_brand_id))
    AND status = 'active'
    AND deleted_at IS NULL
    AND bill_date BETWEEN v_from AND v_to;

  SELECT COALESCE(SUM(grand_total), 0)
  INTO v_sales_cmp_total
  FROM public.sale_bills
  WHERE business_id = p_business_id
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR COALESCE(to_jsonb(sale_bills)->>'bill_type', 'pakka') = p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sale_bills.id AND d.brand_id = p_brand_id))
    AND status = 'active'
    AND deleted_at IS NULL
    AND bill_date BETWEEN v_cmp_from AND v_cmp_to;

  SELECT COALESCE(SUM(grand_total), 0)
  INTO v_sales_return_total
  FROM public.sales_returns
  WHERE business_id = p_business_id
    AND status = 'approved'
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR EXISTS (SELECT 1 FROM public.sale_bills b WHERE b.id = sales_returns.original_bill_id AND b.business_id = p_business_id AND b.bill_type = p_bill_type))
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items i JOIN public.designs d ON d.id = i.design_id AND d.business_id = p_business_id WHERE i.bill_id = sales_returns.original_bill_id AND d.brand_id = p_brand_id))
    AND return_date BETWEEN v_from AND v_to;

  v_net_sales := v_sales_total - v_sales_return_total;
  SELECT COALESCE(SUM(grand_total), 0) INTO v_cmp_returns FROM public.sales_returns
    WHERE business_id = p_business_id AND status = 'approved' AND (p_bill_type IS NULL OR p_bill_type = 'all' OR EXISTS (SELECT 1 FROM public.sale_bills b WHERE b.id = sales_returns.original_bill_id AND b.business_id = p_business_id AND b.bill_type = p_bill_type)) AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items i JOIN public.designs d ON d.id = i.design_id AND d.business_id = p_business_id WHERE i.bill_id = sales_returns.original_bill_id AND d.brand_id = p_brand_id)) AND return_date BETWEEN v_cmp_from AND v_cmp_to;
  v_net_sales_cmp := v_sales_cmp_total - v_cmp_returns;
  IF v_net_sales_cmp > 0 THEN
    v_sales_growth := ((v_net_sales - v_net_sales_cmp) / v_net_sales_cmp) * 100;
  ELSE
    v_sales_growth := NULL;
  END IF;

  -- Sales categories & bill types
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', category, 'value', amount)), '[]'::jsonb)
  INTO v_sales_by_category FROM (
    SELECT COALESCE(COALESCE(to_jsonb(i)->>'item_type', 'finished_goods'), 'finished_goods') category, SUM(i.amount) amount
    FROM public.sale_bill_items i JOIN public.sale_bills b ON b.id = i.bill_id AND b.business_id = p_business_id
    LEFT JOIN public.designs d ON d.id = i.design_id AND d.business_id = p_business_id
    WHERE b.business_id = p_business_id AND b.status = 'active' AND b.deleted_at IS NULL
      AND b.bill_date BETWEEN v_from AND v_to
      AND (p_bill_type IS NULL OR p_bill_type = 'all' OR b.bill_type = p_bill_type)
      AND (p_brand_id IS NULL OR d.brand_id = p_brand_id)
    GROUP BY COALESCE(COALESCE(to_jsonb(i)->>'item_type', 'finished_goods'), 'finished_goods')
  ) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', item_name, 'value', amt)), '[]'::jsonb)
  INTO v_sales_by_bill_type
  FROM (
    SELECT
      CASE WHEN bill_type = 'pakka' THEN 'Pakka (GST)' ELSE 'Kaccha (Non-GST)' END AS item_name,
      SUM(grand_total) AS amt
    FROM public.sale_bills
    WHERE business_id = p_business_id
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR COALESCE(to_jsonb(sale_bills)->>'bill_type', 'pakka') = p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sale_bills.id AND d.brand_id = p_brand_id))
      AND status = 'active'
      AND deleted_at IS NULL
      AND bill_date BETWEEN v_from AND v_to
    GROUP BY (CASE WHEN bill_type = 'pakka' THEN 'Pakka (GST)' ELSE 'Kaccha (Non-GST)' END)
    HAVING SUM(grand_total) > 0
  ) sbt;

  -- 3. Purchases Metrics (RM + FG)
  SELECT
    COALESCE(SUM(grand_total), 0),
    COUNT(*)::int
  INTO v_rm_total, v_purchases_bills_count
  FROM public.raw_material_purchases
  WHERE business_id = p_business_id
    AND status != 'cancelled'
    AND deleted_at IS NULL
    AND invoice_date BETWEEN v_from AND v_to;

  SELECT
    COALESCE(SUM(grand_total), 0),
    COUNT(*)::int
  INTO v_fg_total, v_purchases_bills_count
  FROM public.purchase_bills
  WHERE business_id = p_business_id
    AND status != 'cancelled'
    AND invoice_date BETWEEN v_from AND v_to;

  v_purchases_total := v_rm_total + v_fg_total;

  SELECT COALESCE(SUM(grand_total), 0)
  INTO v_purchase_return_total
  FROM public.purchase_returns
  WHERE business_id = p_business_id
    AND status != 'cancelled'
    AND return_date BETWEEN v_from AND v_to;

  v_net_purchases := v_purchases_total - v_purchase_return_total;

  SELECT COALESCE(SUM(grand_total), 0)
  INTO v_purchases_cmp_total
  FROM (
    SELECT grand_total FROM public.raw_material_purchases
    WHERE business_id = p_business_id AND status != 'cancelled' AND deleted_at IS NULL AND invoice_date BETWEEN v_cmp_from AND v_cmp_to
    UNION ALL
    SELECT grand_total FROM public.purchase_bills
    WHERE business_id = p_business_id AND status != 'cancelled' AND invoice_date BETWEEN v_cmp_from AND v_cmp_to
  ) cmp_p;

  SELECT COALESCE(SUM(grand_total),0) INTO v_cmp_returns FROM public.purchase_returns WHERE business_id = p_business_id AND status = 'completed' AND deleted_at IS NULL AND return_date BETWEEN v_cmp_from AND v_cmp_to;
  v_purchases_cmp_total := v_purchases_cmp_total - v_cmp_returns;
  IF v_purchases_cmp_total > 0 THEN
    v_purchases_growth := ((v_net_purchases - v_purchases_cmp_total) / v_purchases_cmp_total) * 100;
  ELSE
    v_purchases_growth := NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', category, 'value', amount)), '[]'::jsonb)
  INTO v_purchase_by_type FROM (
    SELECT COALESCE(COALESCE(to_jsonb(i)->>'item_type', 'finished_goods'), 'fabric') category, SUM(i.amount) amount
    FROM public.raw_material_purchase_items i JOIN public.raw_material_purchases p ON p.id = i.purchase_id AND p.business_id = p_business_id
    WHERE p.business_id = p_business_id AND p.status <> 'cancelled' AND p.deleted_at IS NULL
      AND p.invoice_date BETWEEN v_from AND v_to GROUP BY COALESCE(COALESCE(to_jsonb(i)->>'item_type', 'finished_goods'), 'fabric')
    UNION ALL SELECT 'Finished Goods', v_fg_total
  ) c;

  -- 4. Financial Profit / Margin / Expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expenses_total
  FROM public.expenses
  WHERE business_id = p_business_id
    AND expense_date BETWEEN v_from AND v_to;

  v_gross_profit := v_net_sales - v_net_purchases;
  IF v_net_sales > 0 THEN
    v_gross_margin := (v_gross_profit / v_net_sales) * 100;
  ELSE
    v_gross_margin := 0;
  END IF;

  v_net_profit := v_gross_profit - v_expenses_total;
  IF v_net_sales > 0 THEN
    v_net_margin := (v_net_profit / v_net_sales) * 100;
  ELSE
    v_net_margin := 0;
  END IF;

  -- 5. Collections & Outflows
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'received'), 0),
    COALESCE(SUM(amount) FILTER (WHERE direction = 'paid'), 0)
  INTO v_collections_total, v_payments_out_total
  FROM public.payments
  WHERE business_id = p_business_id
    AND status IN ('completed', 'success')
    AND payment_date BETWEEN v_from AND v_to;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'received'), 0),
    COALESCE(SUM(amount) FILTER (WHERE direction = 'paid'), 0)
  INTO v_collections_cmp_total, v_payments_cmp_out_total
  FROM public.payments
  WHERE business_id = p_business_id
    AND status IN ('completed', 'success')
    AND payment_date BETWEEN v_cmp_from AND v_cmp_to;

  IF v_collections_cmp_total > 0 THEN
    v_collections_growth := ((v_collections_total - v_collections_cmp_total) / v_collections_cmp_total) * 100;
  ELSE
    v_collections_growth := NULL;
  END IF;

  IF v_payments_cmp_out_total > 0 THEN
    v_payments_growth := ((v_payments_out_total - v_payments_cmp_out_total) / v_payments_cmp_out_total) * 100;
  ELSE
    v_payments_growth := NULL;
  END IF;

  -- 6. Inventory Valuation
  SELECT
    COALESCE(SUM(total_value), 0),
    COALESCE(SUM(total_quantity), 0)
  INTO v_inventory_value, v_inventory_qty
  FROM public.finished_stock
  WHERE business_id = p_business_id
    AND deleted_at IS NULL
    AND total_quantity > 0;

  -- 7. Production Analytics
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'completed')::int,
    COUNT(*) FILTER (WHERE status = 'in_progress')::int
  INTO v_total_lots, v_completed_lots, v_wip_lots
  FROM public.production_lots
  WHERE business_id = p_business_id
    AND lot_date BETWEEN v_from AND v_to;

  SELECT
    COALESCE(SUM(qty_in), 0),
    COALESCE(SUM(qty_out), 0),
    COALESCE(SUM(wastage_qty), 0),
    COALESCE(SUM(COALESCE(total_job_work_amount, 0) + COALESCE(total_labor_cost, 0)), 0)
  INTO v_total_qty_in, v_total_qty_out, v_total_wastage, v_production_cost
  FROM public.stage_entries
  WHERE business_id = p_business_id
    AND entry_date BETWEEN v_from AND v_to;

  IF v_total_qty_in > 0 THEN
    v_efficiency := ROUND(((v_total_qty_out / v_total_qty_in) * 100)::numeric, 1);
  ELSE
    v_efficiency := 0;
  END IF;

  SELECT
    COALESCE(SUM(quantity) FILTER (WHERE sent_for_rework = true), 0),
    COALESCE(SUM(quantity) FILTER (WHERE sent_for_rework != true), 0)
  INTO v_rework_qty, v_damage_qty
  FROM public.lot_defects
  WHERE business_id = p_business_id
    AND defect_date BETWEEN v_from AND v_to;

  -- Stage efficiency breakdown
  SELECT COALESCE(jsonb_agg(to_jsonb(stg)), '[]'::jsonb)
  INTO v_stage_efficiency
  FROM (
    SELECT
      COALESCE(lps.stage_name, 'Unknown') AS name,
      CASE WHEN SUM(se.qty_in) > 0 THEN ROUND((SUM(se.qty_out) / SUM(se.qty_in)) * 100) ELSE 0 END AS efficiency
    FROM public.stage_entries se
    LEFT JOIN public.lot_production_stages lps ON lps.id = se.lot_stage_id AND lps.business_id = p_business_id
    WHERE se.business_id = p_business_id
      AND se.entry_date BETWEEN v_from AND v_to
    GROUP BY lps.stage_name
    ORDER BY lps.stage_name ASC
  ) stg;

  -- 8. Receivables & Payables
  SELECT
    COALESCE(SUM(grand_total - paid_amount), 0),
    COALESCE(SUM(grand_total - paid_amount) FILTER (WHERE COALESCE(due_date, bill_date) < v_to), 0)
  INTO v_total_receivables, v_overdue_receivables
  FROM public.sale_bills
  WHERE business_id = p_business_id
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR COALESCE(to_jsonb(sale_bills)->>'bill_type', 'pakka') = p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sale_bills.id AND d.brand_id = p_brand_id))
    AND status = 'active'
    AND deleted_at IS NULL
    AND payment_status != 'paid';

  SELECT
    COALESCE(SUM(outstanding), 0),
    COALESCE(SUM(outstanding) FILTER (WHERE due_date < v_to), 0)
  INTO v_total_payables, v_overdue_payables
  FROM (
    SELECT grand_total - COALESCE(paid_amount, 0) AS outstanding, COALESCE(due_date, invoice_date) AS due_date FROM public.raw_material_purchases
    WHERE business_id = p_business_id AND status != 'cancelled' AND payment_status != 'paid'
    UNION ALL
    SELECT grand_total - COALESCE(paid_amount, 0) AS outstanding, COALESCE(NULLIF(to_jsonb(purchase_bills)->>'due_date', '')::date, invoice_date) AS due_date FROM public.purchase_bills
    WHERE business_id = p_business_id AND status != 'cancelled' AND payment_status != 'paid'
  ) p_pay;

  -- Historical closing dues use the same paid-at-cutoff definition as the detailed registers.
  SELECT COALESCE(SUM(GREATEST(0, grand_total - public.report_paid_at(p_business_id,id,'sale_bill',paid_amount,v_to))),0),
    COALESCE(SUM(GREATEST(0, grand_total - public.report_paid_at(p_business_id,id,'sale_bill',paid_amount,v_to))) FILTER (WHERE COALESCE(due_date,bill_date) < v_to),0)
  INTO v_total_receivables,v_overdue_receivables FROM public.sale_bills b WHERE business_id=p_business_id AND status='active' AND deleted_at IS NULL AND bill_date<=v_to
    AND (p_bill_type IS NULL OR p_bill_type='all' OR b.bill_type=p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items i JOIN public.designs d ON d.id=i.design_id AND d.business_id = p_business_id WHERE i.bill_id=b.id AND d.brand_id=p_brand_id));
  v_payables := public.fn_report_payments(p_business_id,'payables',v_from::text,v_to::text,p_bill_type);
  v_total_payables := COALESCE((v_payables->'summary'->>'totalOutstanding')::numeric,0);
  v_overdue_payables := COALESCE((v_payables->'summary'->>'overdueAmount')::numeric,0);

  -- 9. Cash & Bank Balances
  SELECT COALESCE(SUM(current_balance), 0)
  INTO v_cash_balance
  FROM public.bank_accounts
  WHERE business_id = p_business_id AND is_active = true AND deleted_at IS NULL;

  v_opening_balance := v_cash_balance - v_collections_total + v_payments_out_total;

  SELECT COALESCE(SUM(a.current_balance - COALESCE(m.after_to,0)),0), COALESCE(SUM(a.current_balance-COALESCE(m.since_from,0)),0)
  INTO v_cash_balance,v_opening_balance FROM public.bank_accounts a
  LEFT JOIN LATERAL (SELECT SUM(signed_amount) FILTER (WHERE entry_date>v_to) after_to,SUM(signed_amount) FILTER (WHERE entry_date>=v_from) since_from FROM public.report_account_movements(p_business_id) WHERE account_id=a.id) m ON true
  WHERE a.business_id=p_business_id AND a.deleted_at IS NULL;
  SELECT COALESCE(SUM(signed_amount) FILTER (WHERE signed_amount>0),0),-COALESCE(SUM(signed_amount) FILTER (WHERE signed_amount<0),0)
  INTO v_cash_in,v_cash_out FROM public.report_account_movements(p_business_id) WHERE entry_date BETWEEN v_from AND v_to;

  -- 10. Top Customers
  SELECT COALESCE(jsonb_agg(to_jsonb(tc)), '[]'::jsonb)
  INTO v_top_customers
  FROM (
    SELECT
      p.id,
      COALESCE(p.company_name, p.name) AS name,
      SUM(sb.grand_total) AS sales,
      SUM(CASE WHEN sb.payment_status != 'paid' THEN (sb.grand_total - sb.paid_amount) ELSE 0 END) AS outstanding
    FROM public.sale_bills sb
    JOIN public.parties p ON p.id = sb.party_id AND p.business_id = p_business_id
    WHERE sb.business_id = p_business_id
      AND (p_bill_type IS NULL OR p_bill_type = 'all' OR sb.bill_type = p_bill_type)
      AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sb.id AND d.brand_id = p_brand_id))
      AND sb.status = 'active'
      AND sb.deleted_at IS NULL
      AND sb.bill_date BETWEEN v_from AND v_to
    GROUP BY p.id, p.company_name, p.name
    ORDER BY sales DESC
    LIMIT 5
  ) tc;

  -- 11. Top Suppliers
  WITH all_purchases AS (
    SELECT supplier_id AS party_id, grand_total, paid_amount, payment_status FROM public.raw_material_purchases
    WHERE business_id = p_business_id AND status != 'cancelled' AND invoice_date BETWEEN v_from AND v_to
    UNION ALL
    SELECT supplier_id AS party_id, grand_total, paid_amount, payment_status FROM public.purchase_bills
    WHERE business_id = p_business_id AND status != 'cancelled' AND invoice_date BETWEEN v_from AND v_to
  ),
  supp_ranked AS (
    SELECT
      p.id,
      COALESCE(p.company_name, p.name) AS name,
      SUM(ap.grand_total) AS purchases,
      SUM(CASE WHEN ap.payment_status != 'paid' THEN (ap.grand_total - COALESCE(ap.paid_amount, 0)) ELSE 0 END) AS outstanding
    FROM all_purchases ap
    JOIN public.parties p ON p.id = ap.party_id AND p.business_id = p_business_id
    GROUP BY p.id, p.company_name, p.name
    ORDER BY purchases DESC
    LIMIT 5
  ),
  supp_totals AS (
    SELECT COALESCE(SUM(purchases), 0) AS total_top_purchases FROM supp_ranked
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'name', sr.name,
      'purchases', sr.purchases,
      'outstanding', sr.outstanding,
      'share', CASE WHEN st.total_top_purchases > 0 THEN ROUND((sr.purchases / st.total_top_purchases) * 100, 2) ELSE 0 END
    )
  ), '[]'::jsonb)
  INTO v_top_suppliers
  FROM supp_ranked sr, supp_totals st;

  -- 12. Monthly Trend (Sales vs Purchases)
  WITH monthly_sales AS (
    SELECT TO_CHAR(bill_date, 'YYYY-MM') AS mth, SUM(grand_total) AS sales
    FROM public.sale_bills
    WHERE business_id = p_business_id
    AND (p_bill_type IS NULL OR p_bill_type = 'all' OR COALESCE(to_jsonb(sale_bills)->>'bill_type', 'pakka') = p_bill_type)
    AND (p_brand_id IS NULL OR EXISTS (SELECT 1 FROM public.sale_bill_items bi JOIN public.designs d ON d.id = bi.design_id AND d.business_id = p_business_id WHERE bi.bill_id = sale_bills.id AND d.brand_id = p_brand_id)) AND status = 'active' AND deleted_at IS NULL
    AND bill_date BETWEEN v_from AND v_to
    GROUP BY TO_CHAR(bill_date, 'YYYY-MM')
  ),
  monthly_purchases AS (
    SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS mth, SUM(grand_total) AS purchases
    FROM (
      SELECT invoice_date, grand_total FROM public.raw_material_purchases WHERE business_id = p_business_id AND status != 'cancelled' AND invoice_date BETWEEN v_from AND v_to
      UNION ALL
      SELECT invoice_date, grand_total FROM public.purchase_bills WHERE business_id = p_business_id AND status != 'cancelled' AND invoice_date BETWEEN v_from AND v_to
    ) ap
    GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
  ),
  distinct_months AS (
    SELECT mth FROM monthly_sales UNION SELECT mth FROM monthly_purchases
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', TO_CHAR(TO_DATE(dm.mth || '-01', 'YYYY-MM-DD'), 'Mon "YY'),
      'sales', COALESCE(ms.sales, 0),
      'purchases', COALESCE(mp.purchases, 0)
    )
    ORDER BY dm.mth ASC
  ), '[]'::jsonb)
  INTO v_monthly_trend
  FROM distinct_months dm
  LEFT JOIN monthly_sales ms ON ms.mth = dm.mth
  LEFT JOIN monthly_purchases mp ON mp.mth = dm.mth;

  -- 13. Management Attention Alerts
  SELECT jsonb_agg(alert_item)
  INTO v_alerts
  FROM (
    SELECT jsonb_build_object(
      'type', 'success',
      'message', 'Net Sales increased by ' || ROUND(v_sales_growth, 1)::text || '% compared to previous period.',
      'link', '/reports/sales'
    ) AS alert_item
    WHERE p_compare <> 'none' AND v_net_sales > v_net_sales_cmp AND v_net_sales_cmp > 0
    UNION ALL
    SELECT jsonb_build_object('type', 'warning', 'message', 'Overdue receivables: ' || ROUND(v_overdue_receivables, 2)::text, 'link', '/reports/payments') WHERE v_overdue_receivables > 0
    UNION ALL
    SELECT jsonb_build_object('type', 'warning', 'message', 'Overdue payables: ' || ROUND(v_overdue_payables, 2)::text, 'link', '/reports/payments') WHERE v_overdue_payables > 0
  ) a;

  -- 14. Final JSON assembly matching frontend shape exactly
  -- Financial totals share the P&L definition rather than sales minus purchases.
  v_pl := public.fn_report_financial_pl(p_business_id, v_from::text, v_to::text, p_bill_type);
  v_prior_pl := public.fn_report_financial_pl(p_business_id,v_cmp_from::text,v_cmp_to::text,p_bill_type);
  v_gross_profit := (v_pl->>'gross_profit')::numeric;
  v_net_profit := (v_pl->>'net_profit')::numeric;
  v_gross_margin := (v_pl->>'gross_margin_pct')::numeric;
  v_net_margin := (v_pl->>'net_margin_pct')::numeric;
  IF p_compare = 'none' THEN
    v_sales_growth := NULL; v_purchases_growth := NULL; v_collections_growth := NULL; v_payments_growth := NULL;
  END IF;
  v_result := jsonb_build_object(
    'period', jsonb_build_object('from', v_from::text, 'to', v_to::text, 'cmpFrom', v_cmp_from::text, 'cmpTo', v_cmp_to::text),
    'comparison', CASE WHEN p_compare = 'none' THEN NULL ELSE jsonb_build_object('sales',v_net_sales_cmp,'purchases',v_purchases_cmp_total,'collections',v_collections_cmp_total,'payments',v_payments_cmp_out_total,'grossProfit',v_prior_pl->'gross_profit','netProfit',v_prior_pl->'net_profit','grossMargin',v_prior_pl->'gross_margin_pct','netMargin',v_prior_pl->'net_margin_pct') END,
    'metadata', jsonb_build_object('inventoryBasis','Current snapshot','financialScope','Company-wide P&L with selected bill type; brand cannot attribute shared costs','purchaseScope','Company-wide purchases; raw materials have no brand attribution','cashBasis','Account-assigned posted movements; unassigned records require reconciliation'),
    'sales', jsonb_build_object(
      'total', v_sales_total,
      'netSales', v_net_sales,
      'salesReturnTotal', v_sales_return_total,
      'returnPct', CASE WHEN v_sales_total > 0 THEN (v_sales_return_total / v_sales_total) * 100 ELSE 0 END,
      'growth', v_sales_growth,
      'byCategory', v_sales_by_category,
      'byBillType', v_sales_by_bill_type,
      'totalBills', v_sales_bills_count
    ),
    'purchases', jsonb_build_object(
      'total', v_purchases_total,
      'netPurchases', v_net_purchases,
      'purchaseReturnTotal', v_purchase_return_total,
      'returnPct', CASE WHEN v_purchases_total > 0 THEN (v_purchase_return_total / v_purchases_total) * 100 ELSE 0 END,
      'growth', v_purchases_growth,
      'byType', v_purchase_by_type,
      'totalBills', v_purchases_bills_count
    ),
    'financial', jsonb_build_object(
      'grossProfit', v_gross_profit,
      'grossMargin', v_gross_margin,
      'netProfit', v_net_profit,
      'netMargin', v_net_margin,
      'expenses', v_expenses_total
    ),
    'collections', jsonb_build_object('total', v_collections_total, 'growth', v_collections_growth),
    'paymentsOut', jsonb_build_object('total', v_payments_out_total, 'growth', v_payments_growth),
    'inventory', jsonb_build_object(
      'totalValue', v_inventory_value,
      'totalQty', v_inventory_qty,
      'health', jsonb_build_object(
        'fastMoving', NULL,
        'slowMoving', NULL,
        'nonMoving', NULL,
        'overdue90', NULL
      ),
      'byCategory', jsonb_build_object('Finished Goods', v_inventory_value)
    ),
    'production', jsonb_build_object(
      'totalLots', v_total_lots,
      'completedLots', v_completed_lots,
      'wipLots', v_wip_lots,
      'totalQtyIn', v_total_qty_in,
      'totalQtyOut', v_total_qty_out,
      'efficiency', v_efficiency,
      'reworkQty', v_rework_qty,
      'damageQty', v_damage_qty,
      'wastageQty', v_total_wastage,
      'stageEfficiency', v_stage_efficiency,
      'productionCost', v_production_cost
    ),
    'outstanding', jsonb_build_object(
      'receivables', v_total_receivables,
      'payables', v_total_payables,
      'overdueReceivables', v_overdue_receivables,
      'overduePayables', v_overdue_payables
    ),
    'cashFlow', jsonb_build_object(
      'openingBalance', v_opening_balance,
      'inflows', v_cash_in,
      'outflows', v_cash_out,
      'netCashFlow', v_cash_in - v_cash_out,
      'closingBalance', v_cash_balance
    ),
    'topCustomers', v_top_customers,
    'topSuppliers', v_top_suppliers,
    'monthlyTrend', v_monthly_trend,
    'alerts', COALESCE(v_alerts, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
