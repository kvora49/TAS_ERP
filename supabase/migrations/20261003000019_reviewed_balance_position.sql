-- Replaces client-side account-kind grouping of approved dated positions with
-- SQL SUM/CTEs for edge/serverless CPU reduction. Only exact-date approvals are
-- used: opening WIP/depreciation are never carried forward as current facts.
ALTER FUNCTION public.fn_report_financial_balance(uuid,text) RENAME TO report_financial_balance_projection;
CREATE FUNCTION public.fn_report_financial_balance(p_business_id uuid,p_to text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE cutoff date:=COALESCE(NULLIF(p_to,'')::date,CURRENT_DATE); position public.report_opening_balances;
 result jsonb; vals jsonb; ca numeric; nc numeric; cl numeric; nl numeric; eq numeric; ast numeric; lia numeric;
BEGIN
 SELECT * INTO position FROM public.report_opening_balances WHERE business_id=p_business_id AND as_of=cutoff AND status='approved';
 IF NOT FOUND THEN
  result:=public.report_financial_balance_projection(p_business_id,p_to);
  RETURN result||jsonb_build_object('metadata',COALESCE(result->'metadata','{}'::jsonb)||jsonb_build_object('reviewedPositionAvailable',false,'openingEntryUrl','/reports/opening-balances'));
 END IF;
 SELECT jsonb_object_agg(kind,amount) INTO vals FROM (
  SELECT value->>'kind' kind,SUM((value->>'debit')::numeric-(value->>'credit')::numeric) amount
  FROM jsonb_array_elements(position.lines) GROUP BY value->>'kind'
 ) grouped;
 ca:=COALESCE((vals->>'cash')::numeric,0)+COALESCE((vals->>'bank')::numeric,0)+COALESCE((vals->>'receivables')::numeric,0)+COALESCE((vals->>'raw_inventory')::numeric,0)+COALESCE((vals->>'finished_inventory')::numeric,0)+COALESCE((vals->>'wip')::numeric,0);
 nc:=COALESCE((vals->>'fixed_assets')::numeric,0)+COALESCE((vals->>'other_assets')::numeric,0);
 cl:=-(COALESCE((vals->>'payables')::numeric,0)+COALESCE((vals->>'worker_payables')::numeric,0)+COALESCE((vals->>'expense_payables')::numeric,0)+COALESCE((vals->>'other_liabilities')::numeric,0));
 nl:=-COALESCE((vals->>'loans')::numeric,0);eq:=-COALESCE((vals->>'equity')::numeric,0);ast:=ca+nc;lia:=cl+nl;
 result:=jsonb_build_object('as_on',cutoff,'assets',jsonb_build_object('current',jsonb_build_object('cash_in_hand',COALESCE((vals->>'cash')::numeric,0),'bank_accounts',COALESCE((vals->>'bank')::numeric,0),'trade_receivables',COALESCE((vals->>'receivables')::numeric,0),'inventory',jsonb_build_object('raw_material',COALESCE((vals->>'raw_inventory')::numeric,0),'finished_goods',COALESCE((vals->>'finished_inventory')::numeric,0),'total',COALESCE((vals->>'raw_inventory')::numeric,0)+COALESCE((vals->>'finished_inventory')::numeric,0)),'wip',COALESCE((vals->>'wip')::numeric,0),'total',ca),'non_current',jsonb_build_object('total',nc),'total',ast),
 'liabilities',jsonb_build_object('current',jsonb_build_object('trade_payables',-COALESCE((vals->>'payables')::numeric,0),'rm_payables',0,'fg_payables',0,'worker_payables',-COALESCE((vals->>'worker_payables')::numeric,0),'outstanding_expenses',-COALESCE((vals->>'expense_payables')::numeric,0),'other_liabilities',-COALESCE((vals->>'other_liabilities')::numeric,0),'total',cl),'non_current',jsonb_build_object('total',nl),'total',lia),
 'net_position',ast-lia,'working_capital',ca-cl,'equity',eq,'is_balanced',abs(ast-lia-eq)<=0.01,'difference',round(ast-lia-eq,2),
 'metadata',jsonb_build_object('reviewedPositionAvailable',true,'balanceCheckAvailable',true,'equityAvailable',true,'nonCurrentAvailable',true,'inventoryBasis','Approved exact-date opening position','sourceEntryId',position.id,'sourceTitle',position.title,'preparedBy',position.prepared_by,'reviewedBy',position.reviewed_by,'reviewedAt',position.reviewed_at,'reviewNote',position.review_note,'openingEntryUrl','/reports/opening-balances'),
 'drill_records',jsonb_build_object('inventory_rm','[]'::jsonb,'inventory_fg','[]'::jsonb,'receivables','[]'::jsonb,'payables','[]'::jsonb,'worker_payables','[]'::jsonb,'expenses_unpaid','[]'::jsonb,'bank_accounts','[]'::jsonb,'approved_opening',position.lines));
 RETURN result;
END;
$$;
