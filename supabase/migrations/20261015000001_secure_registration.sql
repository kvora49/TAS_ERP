CREATE OR REPLACE FUNCTION public.fn_complete_registration(p_business_name text, p_full_name text, p_email text, p_phone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_business_id uuid; v_existing_company uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized registration' USING ERRCODE = '42501'; END IF;
  IF p_business_name IS NULL OR length(btrim(p_business_name)) < 2 THEN RAISE EXCEPTION 'Business name is required' USING ERRCODE = '22023'; END IF;
  SELECT company_id INTO v_existing_company FROM public.company_members WHERE user_id = v_user_id AND status = 'active' ORDER BY created_at LIMIT 1;
  IF v_existing_company IS NOT NULL THEN RETURN v_existing_company; END IF;
  INSERT INTO public.businesses (name, email, phone, enable_gst, enable_batch_tracking, allow_negative_stock, low_stock_alerts)
  VALUES (btrim(p_business_name), lower(btrim(p_email)), NULLIF(btrim(p_phone), ''), true, true, false, true) RETURNING id INTO v_business_id;
  INSERT INTO public.users (id, business_id, full_name, email, role, phone, is_active)
  VALUES (v_user_id, v_business_id, btrim(p_full_name), lower(btrim(p_email)), 'owner', NULLIF(btrim(p_phone), ''), true)
  ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id, full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = 'owner', phone = EXCLUDED.phone, is_active = true;
  INSERT INTO public.company_members (user_id, company_id, role, status) VALUES (v_user_id, v_business_id, 'owner', 'active');
  RETURN v_business_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_complete_registration(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_complete_registration(text, text, text, text) TO authenticated;
