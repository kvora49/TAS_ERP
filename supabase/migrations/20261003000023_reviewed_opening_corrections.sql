-- Creates a controlled replacement draft for an approved dated position. The
-- original remains auditable and is superseded atomically only when the new
-- position completes the existing independent-review approval workflow.
ALTER TABLE public.report_opening_balances
  DROP CONSTRAINT report_opening_balances_status_check,
  ADD CONSTRAINT report_opening_balances_status_check
    CHECK (status IN ('draft','submitted','approved','rejected','superseded')),
  ADD COLUMN supersedes_id uuid REFERENCES public.report_opening_balances(id),
  ADD COLUMN superseded_by_id uuid REFERENCES public.report_opening_balances(id);

CREATE UNIQUE INDEX report_opening_one_live_correction
  ON public.report_opening_balances(supersedes_id)
  WHERE supersedes_id IS NOT NULL AND status IN ('draft','submitted');

CREATE FUNCTION public.guard_report_opening_correction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior public.report_opening_balances;
BEGIN
  IF NEW.supersedes_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO prior FROM public.report_opening_balances
    WHERE id=NEW.supersedes_id AND business_id=NEW.business_id FOR UPDATE;
  IF NOT FOUND OR prior.as_of<>NEW.as_of OR prior.status NOT IN ('approved','superseded') THEN
    RAISE EXCEPTION 'Correction must retain the approved source date' USING ERRCODE='22023';
  END IF;
  IF NEW.status='approved' AND OLD.status='submitted' THEN
    IF prior.status<>'approved' THEN
      RAISE EXCEPTION 'Approved source was already replaced' USING ERRCODE='40001';
    END IF;
    UPDATE public.report_opening_balances
      SET status='superseded',superseded_by_id=NEW.id,version=version+1,updated_at=now()
      WHERE id=prior.id;
    INSERT INTO public.report_opening_balance_audit(entry_id,business_id,actor_id,action,version,note)
      VALUES(prior.id,prior.business_id,auth.uid(),'supersede',prior.version+1,
        'Replaced by independently reviewed correction '||NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_report_opening_correction
BEFORE UPDATE ON public.report_opening_balances
FOR EACH ROW EXECUTE FUNCTION public.guard_report_opening_correction();

CREATE FUNCTION public.revise_report_opening_balance(p_business_id uuid,p_id uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); prior public.report_opening_balances; correction public.report_opening_balances;
BEGIN
  IF actor IS NULL OR p_business_id IS DISTINCT FROM public.auth_business_id()
    OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=actor AND u.business_id=p_business_id AND u.role IN ('owner','admin','accountant'))
  THEN RAISE EXCEPTION 'Financial company access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO prior FROM public.report_opening_balances
    WHERE id=p_id AND business_id=p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found' USING ERRCODE='P0002'; END IF;
  IF prior.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Entry changed' USING ERRCODE='40001'; END IF;
  IF prior.status<>'approved' THEN RAISE EXCEPTION 'Only an approved position can be corrected' USING ERRCODE='22023'; END IF;
  INSERT INTO public.report_opening_balances
    (business_id,as_of,title,notes,lines,debit_total,credit_total,status,prepared_by,supersedes_id)
  VALUES
    (prior.business_id,prior.as_of,'Correction: '||prior.title,prior.notes,prior.lines,
     prior.debit_total,prior.credit_total,'draft',actor,prior.id)
  RETURNING * INTO correction;
  INSERT INTO public.report_opening_balance_audit(entry_id,business_id,actor_id,action,version,note)
    VALUES(correction.id,p_business_id,actor,'revise',correction.version,'Correction draft created from approved entry '||prior.id::text);
  RETURN to_jsonb(correction);
END;
$$;

REVOKE ALL ON FUNCTION public.revise_report_opening_balance(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_report_opening_balance(uuid,uuid,integer) TO authenticated;
