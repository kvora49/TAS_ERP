-- Sales-linked delivery documents snapshot the invoiced goods; they never post stock twice.
CREATE TABLE public.sales_delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  bill_id uuid NOT NULL REFERENCES public.sale_bills(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  UNIQUE (business_id, bill_id)
);

CREATE FUNCTION public.sales_delivery_challan_permission(p_business_id uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE member_role text; permitted boolean;
BEGIN
  IF auth.uid() IS NULL OR p_action NOT IN ('can_view','can_add','can_export') THEN RETURN false; END IF;
  SELECT role INTO member_role FROM company_members WHERE company_id=p_business_id AND user_id=auth.uid() AND status='active';
  IF member_role IS NULL THEN RETURN false; END IF;
  IF member_role='owner' THEN RETURN true; END IF;
  SELECT can_view AND CASE p_action WHEN 'can_view' THEN can_view WHEN 'can_add' THEN can_add ELSE can_export END
  INTO permitted FROM role_permissions WHERE business_id=p_business_id AND role=member_role AND module='Sales & Billing';
  RETURN COALESCE(permitted,false);
END $$;
REVOKE ALL ON FUNCTION public.sales_delivery_challan_permission(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_delivery_challan_permission(uuid,text) TO authenticated,service_role;

ALTER TABLE public.sales_delivery_challans ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_delivery_read ON public.sales_delivery_challans FOR SELECT TO authenticated
USING ((business_id=auth_business_id() OR auth_has_business_access(business_id)) AND sales_delivery_challan_permission(business_id,'can_view'));
REVOKE ALL ON public.sales_delivery_challans FROM anon,authenticated;
REVOKE ALL ON public.sales_delivery_challans FROM service_role;
GRANT SELECT ON public.sales_delivery_challans TO authenticated;
GRANT SELECT,INSERT ON public.sales_delivery_challans TO service_role;

-- The API constructs the snapshot from the invoice after checking the trusted membership role.
-- This guard also enforces tenant consistency and prevents duplicate full-invoice dispatches.
CREATE FUNCTION public.check_sales_delivery_challan() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM sale_bills WHERE id=NEW.bill_id AND business_id=NEW.business_id AND deleted_at IS NULL AND status='active' AND updated_at IS NOT DISTINCT FROM NEW.source_updated_at FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active invoice in the same company is required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_delivery_invoice_guard BEFORE INSERT ON public.sales_delivery_challans
FOR EACH ROW EXECUTE FUNCTION public.check_sales_delivery_challan();
