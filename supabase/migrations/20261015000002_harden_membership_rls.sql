DROP POLICY IF EXISTS "members_insert_policy" ON public.company_members;
CREATE POLICY "members_insert_by_company_admin" ON public.company_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_create_company_for_current_user(
  p_name text, p_address text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL, p_gstin text DEFAULT NULL, p_pan text DEFAULT NULL,
  p_website text DEFAULT NULL, p_logo_url text DEFAULT NULL, p_currency text DEFAULT 'INR'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized company creation' USING ERRCODE = '42501'; END IF;
  IF p_name IS NULL OR length(btrim(p_name)) < 2 THEN RAISE EXCEPTION 'Company name is required' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.businesses (name, address, phone, email, gstin, pan, website, logo_url, currency, enable_gst, enable_batch_tracking, allow_negative_stock, low_stock_alerts)
  VALUES (btrim(p_name), NULLIF(btrim(p_address), ''), NULLIF(btrim(p_phone), ''), NULLIF(lower(btrim(p_email)), ''), NULLIF(upper(btrim(p_gstin)), ''), NULLIF(upper(btrim(p_pan)), ''), NULLIF(btrim(p_website), ''), NULLIF(btrim(p_logo_url), ''), COALESCE(NULLIF(btrim(p_currency), ''), 'INR'), true, true, false, true)
  RETURNING id INTO v_company_id;
  INSERT INTO public.company_members (user_id, company_id, role, status) VALUES (v_user_id, v_company_id, 'owner', 'active');
  UPDATE public.users SET business_id = v_company_id, role = COALESCE(role, 'owner') WHERE id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile is missing' USING ERRCODE = '23503'; END IF;
  RETURN v_company_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_create_company_for_current_user(text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_create_company_for_current_user(text,text,text,text,text,text,text,text,text) TO authenticated;
