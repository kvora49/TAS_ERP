-- Migration: Stock Integrity Infrastructure
-- Creates stock_integrity_logs table for watchdog audit trail
-- Adds godown_id to production_lots for correct finished stock godown tracking

-- 1. stock_integrity_logs table
CREATE TABLE IF NOT EXISTS public.stock_integrity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope TEXT NOT NULL CHECK (scope IN ('full', 'design')),
  target_design_id UUID REFERENCES public.designs(id) ON DELETE SET NULL,
  discrepancies_found INTEGER NOT NULL DEFAULT 0,
  discrepancies_fixed INTEGER NOT NULL DEFAULT 0,
  discrepancies_unresolved INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by business and recent runs
CREATE INDEX IF NOT EXISTS idx_stock_integrity_logs_business_run
  ON public.stock_integrity_logs (business_id, run_at DESC);

-- RLS: businesses can only access their own integrity logs
ALTER TABLE public.stock_integrity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_integrity_logs' AND policyname = 'stock_integrity_logs_policy'
  ) THEN
    CREATE POLICY "stock_integrity_logs_policy" ON public.stock_integrity_logs
      FOR ALL USING (public.auth_has_business_access(business_id))
      WITH CHECK (public.auth_has_business_access(business_id));
  END IF;
END $$;

-- 2. Add godown_id to production_lots if not already present
--    This allows reconciliation to know exactly which godown a completed lot
--    was placed into (set during move-to-stock).
ALTER TABLE public.production_lots
  ADD COLUMN IF NOT EXISTS godown_id UUID REFERENCES public.godowns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_lots_godown
  ON public.production_lots (business_id, godown_id)
  WHERE godown_id IS NOT NULL;
