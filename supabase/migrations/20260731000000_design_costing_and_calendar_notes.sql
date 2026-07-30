-- Migration: 20260731000000_design_costing_and_calendar_notes.sql
-- Create design_costings table for Design Costing calculations
CREATE TABLE IF NOT EXISTS design_costings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  fabric_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { fabric_name, consumption, rate, unit, total }
  trims_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { trim_name, quantity, rate, total }
  process_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { process_name, worker_type, rate_per_piece, total }
  overheads JSONB NOT NULL DEFAULT '{}'::jsonb, -- { wastage_percent, freight_per_piece, overhead_percent, profit_margin_percent }
  total_fabric_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_trims_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_process_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_overheads_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost_per_piece NUMERIC(12,2) NOT NULL DEFAULT 0,
  suggested_sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE design_costings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_costings' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON design_costings
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_design_costings_business ON design_costings(business_id);
CREATE INDEX IF NOT EXISTS idx_design_costings_design ON design_costings(design_id);

-- Create calendar_notes table for Date-wise Calendar Notes & Reminders
CREATE TABLE IF NOT EXISTS calendar_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  has_reminder BOOLEAN NOT NULL DEFAULT false,
  reminder_time TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'production', 'payment', 'order', 'inventory', 'followup')),
  design_id UUID REFERENCES designs(id) ON DELETE SET NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  color_code TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_notes' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON calendar_notes
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_notes_business ON calendar_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_date ON calendar_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_design ON calendar_notes(design_id);
