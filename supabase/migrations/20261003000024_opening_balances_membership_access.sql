-- Aligns reviewed opening balance access with the multi-company membership model.
-- The first version checked legacy users.business_id and auth_business_id(), which can
-- block valid selected-company access when a user belongs to multiple companies.
CREATE OR REPLACE FUNCTION public.auth_has_business_access(b_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = b_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.report_financial_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id = p_business_id
      AND cm.status = 'active'
      AND cm.role IN ('owner', 'admin', 'accountant')
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.business_id = p_business_id
      AND u.role IN ('owner', 'admin', 'accountant')
      AND COALESCE(NULLIF(to_jsonb(u)->>'is_active', '')::boolean, true)
      AND COALESCE(to_jsonb(u)->>'deleted_at', '') = ''
  );
$$;

DROP POLICY IF EXISTS opening_reader ON public.report_opening_balances;
CREATE POLICY opening_reader ON public.report_opening_balances FOR SELECT TO authenticated
  USING (public.auth_has_business_access(business_id) AND public.report_financial_member(business_id));

DROP POLICY IF EXISTS opening_audit_reader ON public.report_opening_balance_audit;
CREATE POLICY opening_audit_reader ON public.report_opening_balance_audit FOR SELECT TO authenticated
  USING (public.auth_has_business_access(business_id) AND public.report_financial_member(business_id));

DROP FUNCTION IF EXISTS public.write_report_opening_balance(uuid,uuid,integer,text,jsonb,text);
CREATE OR REPLACE FUNCTION public.write_report_opening_balance(p_business_id uuid,p_id uuid,p_version integer,p_action text,p_draft jsonb,p_review_note text)
RETURNS public.report_opening_balances LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid:=auth.uid(); doc public.report_opening_balances; line jsonb; deb numeric:=0; cred numeric:=0;
BEGIN
 IF actor IS NULL OR NOT public.auth_has_business_access(p_business_id) OR NOT public.report_financial_member(p_business_id) THEN RAISE EXCEPTION 'Financial company access required' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('save','submit','approve','reject') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO doc FROM public.report_opening_balances WHERE id=p_id AND business_id=p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found' USING ERRCODE='P0002'; END IF;
  IF doc.version<>p_version THEN RAISE EXCEPTION 'Entry changed' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='save' THEN
  IF p_draft IS NULL OR jsonb_typeof(p_draft->'lines')<>'array' OR jsonb_array_length(p_draft->'lines')=0 OR jsonb_array_length(p_draft->'lines')>100 THEN RAISE EXCEPTION 'Invalid draft' USING ERRCODE='22023'; END IF;
  FOR line IN SELECT * FROM jsonb_array_elements(p_draft->'lines') LOOP
   IF (line->>'kind') NOT IN ('cash','bank','receivables','raw_inventory','finished_inventory','wip','fixed_assets','other_assets','payables','worker_payables','expense_payables','loans','other_liabilities','equity') OR line->>'kind' IS NULL OR length(COALESCE(line->>'label','')) NOT BETWEEN 1 AND 120 OR length(COALESCE(line->>'reference',''))>500 OR length(COALESCE(line->>'unit',''))>30 OR (line->>'debit') IS NULL OR (line->>'credit') IS NULL OR (line->>'debit')::numeric NOT BETWEEN 0 AND 999999999999 OR (line->>'credit')::numeric NOT BETWEEN 0 AND 999999999999 OR ((line->>'debit')::numeric>0 AND (line->>'credit')::numeric>0) OR ((line->>'quantity') IS NOT NULL AND (line->>'quantity')::numeric NOT BETWEEN 0 AND 999999999999) THEN RAISE EXCEPTION 'Invalid opening line' USING ERRCODE='22023'; END IF;
   deb:=deb+COALESCE(NULLIF(line->>'debit','')::numeric,0); cred:=cred+COALESCE(NULLIF(line->>'credit','')::numeric,0);
   IF COALESCE(NULLIF(line->>'debit','')::numeric,0)<0 OR COALESCE(NULLIF(line->>'credit','')::numeric,0)<0 OR (COALESCE(NULLIF(line->>'debit','')::numeric,0)>0 AND COALESCE(NULLIF(line->>'credit','')::numeric,0)>0) THEN RAISE EXCEPTION 'Invalid amount' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF round(deb,2)<>round(cred,2) OR deb<=0 THEN RAISE EXCEPTION 'Unbalanced opening position' USING ERRCODE='22023'; END IF;
  IF doc.id IS NULL THEN
   INSERT INTO public.report_opening_balances(business_id,as_of,title,notes,lines,prepared_by,debit_total,credit_total) VALUES(p_business_id,(p_draft->>'as_of')::date,p_draft->>'title',COALESCE(p_draft->>'notes',''),p_draft->'lines',actor,deb,cred) RETURNING * INTO doc;
  ELSE
   IF doc.prepared_by<>actor OR doc.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Only preparer can edit draft' USING ERRCODE='42501'; END IF;
   UPDATE public.report_opening_balances SET as_of=(p_draft->>'as_of')::date,title=p_draft->>'title',notes=COALESCE(p_draft->>'notes',''),lines=p_draft->'lines',debit_total=deb,credit_total=cred,status='draft',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
  END IF;
 ELSIF p_action='submit' THEN
  IF doc.prepared_by<>actor OR doc.status<>'draft' THEN RAISE EXCEPTION 'Only preparer can submit draft' USING ERRCODE='42501'; END IF;
  UPDATE public.report_opening_balances SET status='submitted',version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
 ELSIF p_action IN ('approve','reject') THEN
  IF doc.prepared_by=actor OR doc.status<>'submitted' THEN RAISE EXCEPTION 'Independent review required' USING ERRCODE='42501'; END IF;
  IF COALESCE(length(trim(p_review_note)),0)<10 THEN RAISE EXCEPTION 'Review explanation required' USING ERRCODE='22023'; END IF;
  IF p_action='approve' AND COALESCE((p_draft->>'complete_position')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Complete position confirmation required' USING ERRCODE='22023'; END IF;
  UPDATE public.report_opening_balances SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=actor,reviewed_at=now(),review_note=p_review_note,version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
 END IF;
 INSERT INTO public.report_opening_balance_audit(entry_id,business_id,actor_id,action,version,note) VALUES(doc.id,p_business_id,actor,p_action,doc.version,p_review_note);
 RETURN doc;
END;
$$;

DROP FUNCTION IF EXISTS public.revise_report_opening_balance(uuid,uuid,integer);
CREATE OR REPLACE FUNCTION public.revise_report_opening_balance(p_business_id uuid,p_id uuid,p_version integer)
RETURNS public.report_opening_balances LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid:=auth.uid(); prior public.report_opening_balances; correction public.report_opening_balances;
BEGIN
  IF actor IS NULL OR NOT public.auth_has_business_access(p_business_id) OR NOT public.report_financial_member(p_business_id) THEN RAISE EXCEPTION 'Financial company access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO prior FROM public.report_opening_balances
  WHERE id=p_id AND business_id=p_business_id AND status='approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found' USING ERRCODE='P0002'; END IF;
  IF prior.version<>p_version THEN RAISE EXCEPTION 'Entry changed' USING ERRCODE='40001'; END IF;
  INSERT INTO public.report_opening_balances
    (business_id,as_of,title,notes,lines,prepared_by,debit_total,credit_total,supersedes_id)
  VALUES
    (p_business_id,prior.as_of,prior.title || ' correction',prior.notes,prior.lines,actor,prior.debit_total,prior.credit_total,prior.id)
  RETURNING * INTO correction;
  INSERT INTO public.report_opening_balance_audit(entry_id,business_id,actor_id,action,version,note)
  VALUES(correction.id,p_business_id,actor,'revise',correction.version,'Correction draft created from approved position ' || prior.id::text);
  RETURN correction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_financial_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_report_opening_balance(uuid,uuid,integer,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revise_report_opening_balance(uuid,uuid,integer) TO authenticated;
