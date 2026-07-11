-- Migration: 20260711000014_lot_stage_workers.sql
-- Create lot_stage_workers table

CREATE TABLE IF NOT EXISTS lot_stage_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_stage_id UUID NOT NULL REFERENCES lot_production_stages(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, lot_stage_id, worker_id)
);

-- Enable RLS
ALTER TABLE lot_stage_workers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_stage_workers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_stage_workers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_lot_stage_workers_business ON lot_stage_workers(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_stage_workers_stage ON lot_stage_workers(lot_stage_id);
CREATE INDEX IF NOT EXISTS idx_lot_stage_workers_worker ON lot_stage_workers(worker_id);
