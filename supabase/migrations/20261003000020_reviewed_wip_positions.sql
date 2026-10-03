-- Aggregates accountant-reviewed WIP counts/values in SQL, avoiding application
-- SUM/reduce work on edge/serverless CPUs. Uses exact dates and recorded units.
CREATE FUNCTION public.fn_report_wip_positions(p_business_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH approved AS (
 SELECT as_of,lines,id FROM public.report_opening_balances WHERE business_id=p_business_id AND status='approved' AND as_of IN (p_from-1,p_to)
), wip AS (
 SELECT as_of,COALESCE((v->>'quantity')::numeric,0) quantity,
 CASE WHEN lower(trim(v->>'unit')) IN ('pcs','piece','pieces') THEN 'pcs' ELSE lower(trim(v->>'unit')) END unit,
 (v->>'debit')::numeric-(v->>'credit')::numeric amount
 FROM approved CROSS JOIN LATERAL jsonb_array_elements(lines) v WHERE v->>'kind'='wip'
), positions AS (
 SELECT a.as_of,COALESCE(SUM(w.amount),0) value,
 CASE WHEN COUNT(w.*)=0 THEN 0 WHEN COUNT(*) FILTER(WHERE w.unit IS DISTINCT FROM 'pcs')=0 THEN SUM(w.quantity) ELSE NULL END pieces
 FROM approved a LEFT JOIN wip w ON w.as_of=a.as_of GROUP BY a.as_of
)
SELECT jsonb_build_object('opening_wip',(SELECT pieces FROM positions WHERE as_of=p_from-1),
 'closing_wip',(SELECT pieces FROM positions WHERE as_of=p_to),
 'opening_value',(SELECT value FROM positions WHERE as_of=p_from-1),'closing_value',(SELECT value FROM positions WHERE as_of=p_to),
 'opening_date',p_from-1,'closing_date',p_to,
 'basis','Approved exact-date company-wide physical WIP counts; quantities shown in pieces only when all recorded units are pieces. Activity rows are a period cohort, not a certified stock-flow reconciliation.');
$$;
REVOKE ALL ON FUNCTION public.fn_report_wip_positions(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_report_wip_positions(uuid,date,date) TO authenticated,service_role;
