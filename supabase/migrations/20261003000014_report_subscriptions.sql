-- Private scheduled executive exports. Delivery is an authenticated in-app inbox,
-- not email or a public link. Financial snapshots remain owner/admin only.
CREATE TABLE public.report_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 cadence text NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
 enabled boolean NOT NULL DEFAULT true,
 next_run_at timestamptz NOT NULL,
 lease_until timestamptz,
 lease_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (business_id,user_id,cadence)
);
CREATE TABLE public.report_subscription_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subscription_id uuid NOT NULL REFERENCES public.report_subscriptions(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 scheduled_for timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK (status IN ('ready','failed')),
 from_date date, to_date date,
 payload jsonb,
 error text,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 UNIQUE(subscription_id,scheduled_for),
 CHECK (payload IS NULL OR octet_length(payload::text)<=2097152)
);
CREATE INDEX report_subscriptions_due ON public.report_subscriptions(next_run_at) WHERE enabled;
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_subscription_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_subscription_owner ON public.report_subscriptions FOR ALL TO authenticated
 USING (business_id=public.auth_business_id() AND user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.business_id=report_subscriptions.business_id AND u.role IN ('owner','admin')))
 WITH CHECK (business_id=public.auth_business_id() AND user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.business_id=report_subscriptions.business_id AND u.role IN ('owner','admin')));
CREATE POLICY report_run_reader ON public.report_subscription_runs FOR SELECT TO authenticated
 USING (business_id=public.auth_business_id() AND user_id=auth.uid() AND expires_at>now() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.business_id=report_subscription_runs.business_id AND u.role IN ('owner','admin')));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.report_subscriptions TO authenticated;
GRANT SELECT ON public.report_subscription_runs TO authenticated;
GRANT ALL ON public.report_subscriptions,public.report_subscription_runs TO service_role;

-- Claims are writes, so VOLATILE is intentional; it does not change the six STABLE report RPCs.
CREATE FUNCTION public.claim_report_subscriptions() RETURNS SETOF public.report_subscriptions
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$
 WITH due AS (SELECT id FROM public.report_subscriptions WHERE enabled AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 10)
 UPDATE public.report_subscriptions s SET lease_until=now()+interval '10 minutes',lease_id=gen_random_uuid() FROM due WHERE s.id=due.id RETURNING s.*;
$$;
REVOKE ALL ON FUNCTION public.claim_report_subscriptions() FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_subscriptions() TO service_role;
