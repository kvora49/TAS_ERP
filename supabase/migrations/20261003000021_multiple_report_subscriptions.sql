ALTER TABLE public.report_subscriptions
 ADD COLUMN report_key text NOT NULL DEFAULT 'analysis' CHECK (report_key IN ('analysis','payments','pl','balance','ledger','stock')),
 ADD COLUMN params jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(params)='object' AND octet_length(params::text)<=2048);
ALTER TABLE public.report_subscriptions DROP CONSTRAINT report_subscriptions_business_id_user_id_cadence_key;
ALTER TABLE public.report_subscriptions ADD CONSTRAINT report_subscription_scope UNIQUE(business_id,user_id,cadence,report_key);
ALTER TABLE public.report_subscription_runs
 ADD COLUMN report_key text NOT NULL DEFAULT 'analysis' CHECK (report_key IN ('analysis','payments','pl','balance','ledger','stock'));
-- Trusted jobs recheck company/recipient financial access before each snapshot.
GRANT SELECT ON public.report_opening_balances TO service_role;
