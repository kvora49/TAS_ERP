-- Dated opening positions are source records, not inferred plugs to balance books.
CREATE TABLE public.report_opening_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 as_of date NOT NULL, title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
 notes text NOT NULL DEFAULT '', lines jsonb NOT NULL CHECK (jsonb_typeof(lines)='array' AND jsonb_array_length(lines) BETWEEN 1 AND 100 AND octet_length(lines::text)<=131072),
 debit_total numeric NOT NULL DEFAULT 0,credit_total numeric NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
 prepared_by uuid NOT NULL REFERENCES public.users(id), reviewed_by uuid REFERENCES public.users(id),
 review_note text, reviewed_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_by<>prepared_by AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX report_opening_approved_date ON public.report_opening_balances(business_id,as_of) WHERE status='approved';
CREATE INDEX report_opening_company_date ON public.report_opening_balances(business_id,as_of DESC);
CREATE TABLE public.report_opening_balance_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_id uuid NOT NULL REFERENCES public.report_opening_balances(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.users(id), action text NOT NULL, version integer NOT NULL,
 note text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.report_opening_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_opening_balance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY opening_reader ON public.report_opening_balances FOR SELECT TO authenticated
 USING (business_id=public.auth_business_id() AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.business_id=report_opening_balances.business_id AND u.role IN ('owner','admin','accountant')));
CREATE POLICY opening_audit_reader ON public.report_opening_balance_audit FOR SELECT TO authenticated
 USING (business_id=public.auth_business_id() AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.business_id=report_opening_balance_audit.business_id AND u.role IN ('owner','admin','accountant')));
GRANT SELECT ON public.report_opening_balances,public.report_opening_balance_audit TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.report_opening_balances,public.report_opening_balance_audit FROM authenticated;

-- Atomic workflow writes intentionally use VOLATILE. Definer access is restricted
-- to the authenticated company and financial roles, with row locks and versions.
CREATE FUNCTION public.write_report_opening_balance(p_business_id uuid,p_id uuid,p_version integer,p_action text,p_draft jsonb,p_review_note text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); doc public.report_opening_balances; line jsonb; deb numeric:=0; cred numeric:=0;
BEGIN
 IF actor IS NULL OR p_business_id IS DISTINCT FROM public.auth_business_id() OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=actor AND u.business_id=p_business_id AND u.role IN ('owner','admin','accountant')) THEN RAISE EXCEPTION 'Financial company access required' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('save','submit','approve','reject') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO doc FROM public.report_opening_balances WHERE id=p_id AND business_id=p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found' USING ERRCODE='P0002'; END IF;
  IF doc.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Entry changed; reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='save' THEN
  IF p_draft IS NULL OR jsonb_typeof(p_draft->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_draft->'lines') NOT BETWEEN 1 AND 100 OR length(p_draft->>'title') NOT BETWEEN 1 AND 120 OR length(COALESCE(p_draft->>'notes',''))>4000 THEN RAISE EXCEPTION 'Invalid draft' USING ERRCODE='22023'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_draft->'lines') LOOP
   IF (line->>'kind') NOT IN ('cash','bank','receivables','raw_inventory','finished_inventory','wip','fixed_assets','other_assets','payables','worker_payables','expense_payables','loans','other_liabilities','equity') OR line->>'kind' IS NULL OR length(COALESCE(line->>'label','')) NOT BETWEEN 1 AND 120 OR length(COALESCE(line->>'reference',''))>500 OR length(COALESCE(line->>'unit',''))>30 OR (line->>'debit') IS NULL OR (line->>'credit') IS NULL OR (line->>'debit')::numeric NOT BETWEEN 0 AND 999999999999 OR (line->>'credit')::numeric NOT BETWEEN 0 AND 999999999999 OR ((line->>'debit')::numeric>0 AND (line->>'credit')::numeric>0) OR ((line->>'quantity') IS NOT NULL AND (line->>'quantity')::numeric NOT BETWEEN 0 AND 999999999999) THEN RAISE EXCEPTION 'Invalid opening line' USING ERRCODE='22023'; END IF;
   deb:=deb+(line->>'debit')::numeric;cred:=cred+(line->>'credit')::numeric;
  END LOOP;
  IF p_id IS NULL THEN
   INSERT INTO public.report_opening_balances(business_id,as_of,title,notes,lines,prepared_by,debit_total,credit_total) VALUES(p_business_id,(p_draft->>'as_of')::date,p_draft->>'title',COALESCE(p_draft->>'notes',''),p_draft->'lines',actor,deb,cred) RETURNING * INTO doc;
  ELSE
   IF doc.prepared_by<>actor OR doc.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Only the preparer can edit an unsubmitted draft' USING ERRCODE='42501'; END IF;
   UPDATE public.report_opening_balances SET as_of=(p_draft->>'as_of')::date,title=p_draft->>'title',notes=COALESCE(p_draft->>'notes',''),lines=p_draft->'lines',debit_total=deb,credit_total=cred,status='draft',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
  END IF;
 ELSIF p_action='submit' THEN
  IF doc.id IS NULL OR doc.prepared_by<>actor OR doc.status<>'draft' THEN RAISE EXCEPTION 'Only the preparer can submit a draft' USING ERRCODE='42501'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(doc.lines) LOOP
   IF length(trim(COALESCE(line->>'reference','')))=0 THEN RAISE EXCEPTION 'Every line needs a source reference' USING ERRCODE='22023'; END IF;
   IF line->>'kind' IN ('raw_inventory','finished_inventory','wip') AND ((line->>'debit')::numeric>0 OR (line->>'credit')::numeric>0) AND ((line->>'quantity') IS NULL OR length(trim(COALESCE(line->>'unit','')))=0) THEN RAISE EXCEPTION 'Stock and WIP lines need recorded quantity and unit' USING ERRCODE='22023'; END IF;
   deb:=deb+(line->>'debit')::numeric;cred:=cred+(line->>'credit')::numeric;
  END LOOP;
  IF deb<=0 OR abs(deb-cred)>0.01 THEN RAISE EXCEPTION 'Debits and credits must balance before review' USING ERRCODE='22023'; END IF;
  UPDATE public.report_opening_balances SET status='submitted',version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
 ELSE
  IF doc.id IS NULL OR doc.status<>'submitted' OR doc.prepared_by=actor THEN RAISE EXCEPTION 'A different financial user must review a submitted entry' USING ERRCODE='42501'; END IF;
  IF p_action='approve' AND (p_draft->>'complete_position') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm complete company-wide position' USING ERRCODE='22023'; END IF;
  IF length(trim(COALESCE(p_review_note,''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Review explanation is required' USING ERRCODE='22023'; END IF;
  UPDATE public.report_opening_balances SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=actor,reviewed_at=now(),review_note=p_review_note,version=version+1,updated_at=now() WHERE id=doc.id RETURNING * INTO doc;
 END IF;
 INSERT INTO public.report_opening_balance_audit(entry_id,business_id,actor_id,action,version,note) VALUES(doc.id,p_business_id,actor,p_action,doc.version,p_review_note);
 RETURN to_jsonb(doc);
END;
$$;
REVOKE ALL ON FUNCTION public.write_report_opening_balance(uuid,uuid,integer,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_report_opening_balance(uuid,uuid,integer,text,jsonb,text) TO authenticated;
