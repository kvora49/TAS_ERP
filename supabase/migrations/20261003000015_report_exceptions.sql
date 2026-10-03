-- Summarizes report completeness exceptions in PostgreSQL instead of fetching and
-- reducing raw sources on edge/serverless CPUs. Counts cover the full scope;
-- drill rows are bounded and explicitly report their truncation.
CREATE FUNCTION public.fn_report_exceptions(p_business_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH overdue AS (
 SELECT b.id,b.bill_number document,b.due_date date,
 GREATEST(0,b.grand_total-public.report_paid_at(p_business_id,b.id,'sale_bill',b.paid_amount,p_to)) amount,
 '/reports/sales?from='||p_from||'&to='||p_to||'&party_id='||b.party_id href,
 'overdue_receivable' kind,'Invoice due before cutoff' reason,'cutoff' basis
 FROM public.sale_bills b WHERE b.business_id=p_business_id AND b.status='active' AND b.deleted_at IS NULL
 AND b.bill_date<=p_to AND b.due_date<p_to
), source_exceptions AS (
 SELECT * FROM overdue WHERE amount>0
 UNION ALL
 SELECT i.id,b.bill_number,b.bill_date,i.amount,
 '/sales/bills/'||b.id,'missing_sale_cost','Item cost is missing or non-positive','period'
 FROM public.sale_bill_items i JOIN public.sale_bills b ON b.id=i.bill_id AND b.business_id=p_business_id
 WHERE i.business_id=p_business_id AND b.status='active' AND b.deleted_at IS NULL AND b.bill_date BETWEEN p_from AND p_to
 AND (i.cost_per_piece IS NULL OR i.cost_per_piece<=0) AND i.quantity>0
 UNION ALL
 SELECT s.id,COALESCE(d.design_number,'Stock item'),CURRENT_DATE,s.total_quantity,
 '/reports/inventory?tab=valuation','missing_stock_cost','Positive current stock has no positive recorded unit cost','current_snapshot'
 FROM public.finished_stock s LEFT JOIN public.designs d ON d.id=s.design_id AND d.business_id=p_business_id
 WHERE s.business_id=p_business_id AND s.deleted_at IS NULL AND s.total_quantity>0 AND (s.cost_per_piece IS NULL OR s.cost_per_piece<=0)
 UNION ALL
 SELECT s.id,COALESCE(d.design_number,'Stock item'),CURRENT_DATE,s.total_quantity,
 '/reports/inventory?tab=valuation','negative_stock','Current finished stock is negative','current_snapshot'
 FROM public.finished_stock s LEFT JOIN public.designs d ON d.id=s.design_id AND d.business_id=p_business_id
 WHERE s.business_id=p_business_id AND s.deleted_at IS NULL AND s.total_quantity<0
 UNION ALL
 SELECT b.id,b.bill_number,b.invoice_date,b.grand_total,
 '/reports/purchases?tab=finished&from='||p_from||'&to='||p_to,'unclassified_purchase','Finished-goods invoice tax classification is not recorded','period'
 FROM public.purchase_bills b WHERE b.business_id=p_business_id AND b.status<>'cancelled' AND b.invoice_date BETWEEN p_from AND p_to AND b.bill_type IS NULL
 UNION ALL
 SELECT l.id,l.lot_number,l.target_due_date,l.total_quantity,
 '/production/lots/'||l.id,'late_lot','Current active lot is past its recorded target date','current_snapshot'
 FROM public.production_lots l WHERE l.business_id=p_business_id AND l.deleted_at IS NULL AND l.status IN ('in_progress','on_hold') AND l.target_due_date<CURRENT_DATE
), counts AS (
 SELECT kind,COUNT(*) count FROM source_exceptions GROUP BY kind
), page AS (
 SELECT * FROM source_exceptions ORDER BY kind,date,id LIMIT 100
)
SELECT jsonb_build_object('counts',COALESCE((SELECT jsonb_object_agg(kind,count) FROM counts),'{}'::jsonb),
 'rows',COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page),'[]'::jsonb),
 'total', (SELECT COUNT(*) FROM source_exceptions),'limit',100,
 'truncated',(SELECT COUNT(*)>100 FROM source_exceptions),
 'basis','Company-wide exceptions. Period source costs/classification, receivables at cutoff, and explicitly marked current stock/lot snapshots. Amount means invoice value for financial sources and quantity for stock/lots; values are not summed across types.');
$$;
REVOKE ALL ON FUNCTION public.fn_report_exceptions(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_report_exceptions(uuid,date,date) TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS report_subscription_runs_expiry ON public.report_subscription_runs(expires_at);
