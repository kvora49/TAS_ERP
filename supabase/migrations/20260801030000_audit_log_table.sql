-- Create audit_log table for system activity tracking
-- Tracks create/update/delete actions across all key modules

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_business_created ON audit_log (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_table ON audit_log (business_id, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (business_id, user_id);

-- Enable Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON audit_log
      FOR ALL USING (
        business_id = (
          SELECT business_id FROM users WHERE id = auth.uid() LIMIT 1
        )
      );
  END IF;
END
$$;

-- Retention: auto-delete entries older than 180 days
-- This is implemented as a scheduled Supabase Edge Function / cron job
-- For now, the UI shows a banner: "Audit logs are retained for 180 days"
