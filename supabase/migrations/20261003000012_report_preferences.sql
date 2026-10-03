-- Private report workspaces sync saved filters, favourites and history across PWA devices.
CREATE TABLE IF NOT EXISTS public.report_preferences (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 preferences jsonb NOT NULL DEFAULT '{"views":[],"recent":[]}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (business_id,user_id),
 CHECK (octet_length(preferences::text) <= 32768)
);
ALTER TABLE public.report_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_preferences_owner ON public.report_preferences FOR ALL TO authenticated
 USING (business_id=public.auth_business_id() AND user_id=auth.uid())
 WITH CHECK (business_id=public.auth_business_id() AND user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.report_preferences TO authenticated;
