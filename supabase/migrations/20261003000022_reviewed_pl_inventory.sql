-- Replaces JS inventory/WIP valuation reductions with SQL SUM/CTEs for reduced
-- edge/serverless CPU. Approved exact opening AND closing positions are required;
-- company-wide inventory cannot be attributed to a selected bill-type cohort.
ALTER FUNCTION public.fn_report_financial_pl(uuid,text,text,text) RENAME TO report_financial_pl_projection;
CREATE FUNCTION public.fn_report_financial_pl(p_business_id uuid,p_from text DEFAULT NULL,p_to text DEFAULT NULL,p_bill_type text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb; start_date date; end_date date; o jsonb; c jsonb; delta_raw numeric; delta_fg numeric; delta_wip numeric; delta numeric; revenue numeric; gross numeric; net numeric;
BEGIN
 result:=public.report_financial_pl_projection(p_business_id,p_from,p_to,p_bill_type);
 start_date:=(result->>'from')::date;end_date:=(result->>'to')::date;
 IF start_date IS NULL OR end_date IS NULL THEN start_date:=NULLIF(p_from,'')::date;end_date:=NULLIF(p_to,'')::date; END IF;
 WITH stocks AS (
  SELECT as_of,COALESCE(SUM((v->>'debit')::numeric-(v->>'credit')::numeric) FILTER(WHERE v->>'kind'='raw_inventory'),0) raw,
   COALESCE(SUM((v->>'debit')::numeric-(v->>'credit')::numeric) FILTER(WHERE v->>'kind'='finished_inventory'),0) finished,
   COALESCE(SUM((v->>'debit')::numeric-(v->>'credit')::numeric) FILTER(WHERE v->>'kind'='wip'),0) wip
  FROM public.report_opening_balances a CROSS JOIN LATERAL jsonb_array_elements(a.lines) v
  WHERE a.business_id=p_business_id AND a.status='approved' AND a.as_of IN (start_date-1,end_date) GROUP BY as_of
 ) SELECT (SELECT to_jsonb(stocks) FROM stocks WHERE as_of=start_date-1),(SELECT to_jsonb(stocks) FROM stocks WHERE as_of=end_date) INTO o,c;
 IF o IS NULL OR c IS NULL OR (p_bill_type IS NOT NULL AND p_bill_type<>'all') THEN
  RETURN result||jsonb_build_object('metadata',COALESCE(result->'metadata','{}'::jsonb)||jsonb_build_object('reviewedInventoryApplied',false,'stockBasis','Stock ledger. Exact approved company-wide opening and closing positions are missing or incompatible with the bill-type filter.'));
 END IF;
 delta_raw:=(o->>'raw')::numeric-(c->>'raw')::numeric-COALESCE((result#>>'{cogs,opening_stock,raw_material}')::numeric,0)+COALESCE((result#>>'{cogs,closing_stock,raw_material}')::numeric,0);
 delta_fg:=(o->>'finished')::numeric-(c->>'finished')::numeric-COALESCE((result#>>'{cogs,opening_stock,finished_goods}')::numeric,0)+COALESCE((result#>>'{cogs,closing_stock,finished_goods}')::numeric,0);
 delta_wip:=(o->>'wip')::numeric-(c->>'wip')::numeric;delta:=delta_raw+delta_fg+delta_wip;
 revenue:=(result#>>'{revenue,total}')::numeric;gross:=(result->>'gross_profit')::numeric-delta;net:=(result->>'net_profit')::numeric-delta;
 RETURN result||jsonb_build_object(
  'cogs',(result->'cogs')||jsonb_build_object('raw_material',(result#>>'{cogs,raw_material}')::numeric+delta_raw,'finished_goods',(result#>>'{cogs,finished_goods}')::numeric+delta_fg,'wip_change',delta_wip,'total',(result#>>'{cogs,total}')::numeric+delta,
   'opening_stock',jsonb_build_object('raw_material',(o->>'raw')::numeric,'finished_goods',(o->>'finished')::numeric,'wip',(o->>'wip')::numeric,'total',(o->>'raw')::numeric+(o->>'finished')::numeric+(o->>'wip')::numeric),
   'closing_stock',jsonb_build_object('raw_material',(c->>'raw')::numeric,'finished_goods',(c->>'finished')::numeric,'wip',(c->>'wip')::numeric,'total',(c->>'raw')::numeric+(c->>'finished')::numeric+(c->>'wip')::numeric)),
  'gross_profit',gross,'gross_margin_pct',CASE WHEN revenue<>0 THEN round(gross/revenue*100,2) ELSE NULL END,
  'operating_profit',(result->>'operating_profit')::numeric-delta,'net_profit',net,'net_margin_pct',CASE WHEN revenue<>0 THEN round(net/revenue*100,2) ELSE NULL END,
  'metadata',(result->'metadata')||jsonb_build_object('reviewedInventoryApplied',true,'stockBasis','Approved exact-date opening and closing inventory/WIP values, including the recorded WIP change. No carrying forward of positions.','note','Inventory/WIP valuations use approved company-wide source positions at both boundaries. Recorded revenue, purchases, returns, labour and other expenses retain their existing recognition basis; remaining tax/capitalization policy requires accounting review.','openingSource',o->>'as_of','closingSource',c->>'as_of'));
END;
$$;
