-- ============================================================
-- Migration: 20260806000000_calendar_planner_full.sql
-- Calendar & Planner Module — Full Schema
-- Replaces the basic calendar_notes table with a rich,
-- multi-type, ERP-integrated calendar system.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Migrate existing calendar_notes data (preserve history)
-- ──────────────────────────────────────────────────────────
-- We'll migrate after creating new tables below.

-- ──────────────────────────────────────────────────────────
-- 2. calendar_entries — core table for all entry types
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_entries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_type        TEXT        NOT NULL CHECK (entry_type IN ('note','reminder','task','journal','event')),
  title             TEXT        NOT NULL,
  content           TEXT,                          -- rich text HTML
  entry_date        DATE        NOT NULL,
  entry_time        TIME,                          -- NULL = all-day
  end_date          DATE,
  end_time          TIME,
  is_all_day        BOOLEAN     NOT NULL DEFAULT true,
  priority          TEXT        NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','cancelled','overdue')),
  category          TEXT        NOT NULL DEFAULT 'general'
                    CHECK (category IN (
                      'production','purchase','sales','accounts','payments',
                      'stock','hr','personal','factory','meeting',
                      'maintenance','transport','general'
                    )),
  color_code        TEXT,
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  is_pinned         BOOLEAN     NOT NULL DEFAULT false,
  -- ERP integration linkage
  erp_module        TEXT,                          -- 'sales' | 'purchase' | 'production' | 'accounts' | 'stock' | 'hr'
  erp_entity_id     UUID,                          -- FK to ERP record (sale_bill, lot, purchase_bill, etc.)
  erp_entity_type   TEXT,                          -- 'sale_bill' | 'purchase_bill' | 'production_lot' | 'payment'
  erp_entity_label  TEXT,                          -- display text e.g. 'Invoice #INV-001'
  -- People
  person_responsible UUID       REFERENCES users(id) ON DELETE SET NULL,
  -- Audit fields
  created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_entries' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON calendar_entries
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_calendar_entries_business_date
  ON calendar_entries(business_id, entry_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_entries_business_type
  ON calendar_entries(business_id, entry_type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_entries_business_status
  ON calendar_entries(business_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_entries_date_status
  ON calendar_entries(business_id, entry_date, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_entries_erp
  ON calendar_entries(business_id, erp_entity_id) WHERE erp_entity_id IS NOT NULL;

-- GIN index for tag search
CREATE INDEX IF NOT EXISTS idx_calendar_entries_tags
  ON calendar_entries USING GIN(tags) WHERE deleted_at IS NULL;

-- Full-text search index on title + content
CREATE INDEX IF NOT EXISTS idx_calendar_entries_search
  ON calendar_entries USING GIN(
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))
  ) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────
-- 3. calendar_reminders — reminder scheduling
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_id              UUID        NOT NULL REFERENCES calendar_entries(id) ON DELETE CASCADE,
  remind_at             TIMESTAMPTZ NOT NULL,       -- exact UTC time to fire
  notify_before_minutes INTEGER     NOT NULL DEFAULT 0,
  repeat_type           TEXT        NOT NULL DEFAULT 'never'
                        CHECK (repeat_type IN ('never','daily','weekly','monthly','yearly','custom')),
  repeat_interval       INTEGER,                    -- custom: every N days
  repeat_end_date       DATE,
  -- Firing state
  is_fired              BOOLEAN     NOT NULL DEFAULT false,
  fired_at              TIMESTAMPTZ,
  -- Acknowledgement
  is_acknowledged       BOOLEAN     NOT NULL DEFAULT false,
  acknowledged_at       TIMESTAMPTZ,
  -- Next occurrence (computed on fire for repeating reminders)
  next_remind_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_reminders' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON calendar_reminders
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Critical index for cron job — finds unfired reminders due soon
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_cron
  ON calendar_reminders(remind_at, is_fired) WHERE is_fired = false;

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_entry
  ON calendar_reminders(entry_id);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_business
  ON calendar_reminders(business_id, remind_at);

-- ──────────────────────────────────────────────────────────
-- 4. calendar_tasks — checklist items for task entries
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_id        UUID        NOT NULL REFERENCES calendar_entries(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  is_completed    BOOLEAN     NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  parent_task_id  UUID        REFERENCES calendar_tasks(id) ON DELETE CASCADE,  -- subtasks
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_tasks' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON calendar_tasks
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_entry
  ON calendar_tasks(entry_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_business
  ON calendar_tasks(business_id);

-- ──────────────────────────────────────────────────────────
-- 5. calendar_attachments — file attachments per entry
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_attachments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_id      UUID        NOT NULL REFERENCES calendar_entries(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  file_type     TEXT        NOT NULL
                CHECK (file_type IN ('image','pdf','excel','word','audio','other')),
  file_size     INTEGER,                              -- bytes
  storage_path  TEXT        NOT NULL,                 -- Supabase Storage path
  public_url    TEXT,
  uploaded_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calendar_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_attachments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON calendar_attachments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_attachments_entry
  ON calendar_attachments(entry_id);

CREATE INDEX IF NOT EXISTS idx_calendar_attachments_business
  ON calendar_attachments(business_id);

-- ──────────────────────────────────────────────────────────
-- 6. calendar_templates — reusable entry templates
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  template_type TEXT        NOT NULL
                CHECK (template_type IN ('note','task','reminder','event')),
  content       TEXT,                                 -- rich text HTML for notes
  task_items    JSONB       NOT NULL DEFAULT '[]',    -- [{title, sort_order}]
  category      TEXT        NOT NULL DEFAULT 'general',
  priority      TEXT        NOT NULL DEFAULT 'medium',
  color_code    TEXT,
  is_system     BOOLEAN     NOT NULL DEFAULT false,   -- built-in system templates
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

ALTER TABLE calendar_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_templates' AND policyname = 'tenant_isolation'
  ) THEN
    -- Users can see their business templates AND system templates
    CREATE POLICY "tenant_isolation" ON calendar_templates
      FOR ALL USING (
        business_id = (SELECT business_id FROM users WHERE id = auth.uid())
        OR is_system = true
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_templates_business
  ON calendar_templates(business_id) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────
-- 7. Migrate existing calendar_notes → calendar_entries
-- ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_notes') THEN
    INSERT INTO calendar_entries (
      id, business_id, entry_type, title, content,
      entry_date, is_all_day, priority, status, category,
      color_code, is_pinned, created_by, created_at, updated_at, deleted_at
    )
    SELECT
      id,
      business_id,
      CASE WHEN has_reminder THEN 'reminder' ELSE 'note' END AS entry_type,
      title,
      content,
      note_date AS entry_date,
      true AS is_all_day,
      priority,
      CASE WHEN is_completed THEN 'completed' ELSE 'pending' END AS status,
      category,
      color_code,
      is_pinned,
      created_by,
      created_at,
      updated_at,
      deleted_at
    FROM calendar_notes
    WHERE NOT EXISTS (
      SELECT 1 FROM calendar_entries ce WHERE ce.id = calendar_notes.id
    );

    -- Migrate reminder times for entries that had reminders
    INSERT INTO calendar_reminders (business_id, entry_id, remind_at, notify_before_minutes)
    SELECT
      ce.business_id,
      ce.id,
      cn.reminder_time,
      0
    FROM calendar_notes cn
    JOIN calendar_entries ce ON ce.id = cn.id
    WHERE cn.has_reminder = true
      AND cn.reminder_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM calendar_reminders cr WHERE cr.entry_id = cn.id
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 8. Seed system templates
-- ──────────────────────────────────────────────────────────
-- These are visible to ALL businesses (is_system = true)
-- We use a placeholder UUID for business_id since system templates
-- are accessible to everyone via the policy
DO $$
DECLARE
  sys_biz_id UUID;
BEGIN
  -- Get the first business to satisfy FK constraint
  SELECT id INTO sys_biz_id FROM businesses LIMIT 1;
  IF sys_biz_id IS NULL THEN
    RETURN; -- No businesses yet, skip seeding
  END IF;

  -- Daily Factory Checklist
  INSERT INTO calendar_templates (business_id, name, description, template_type, category, priority, is_system, task_items)
  SELECT
    sys_biz_id,
    'Daily Factory Checklist',
    'Standard daily production floor checklist',
    'task',
    'production',
    'medium',
    true,
    '[
      {"title": "Check fabric quality", "sort_order": 0},
      {"title": "Issue purchase order if needed", "sort_order": 1},
      {"title": "Confirm dyeing / processing schedule", "sort_order": 2},
      {"title": "Update stock records", "sort_order": 3},
      {"title": "Generate sales invoices", "sort_order": 4},
      {"title": "Confirm dispatch", "sort_order": 5},
      {"title": "Check worker attendance", "sort_order": 6},
      {"title": "Review daily production output", "sort_order": 7}
    ]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM calendar_templates WHERE name = 'Daily Factory Checklist' AND is_system = true
  );

  -- GST Filing Reminder
  INSERT INTO calendar_templates (business_id, name, description, template_type, category, priority, is_system, content)
  SELECT
    sys_biz_id,
    'GST Filing Reminder',
    'Monthly GST return filing reminder',
    'reminder',
    'accounts',
    'urgent',
    true,
    'GST Return filing due. Ensure all invoices are updated, ITC is reconciled, and GSTR-1/3B is filed before the deadline.'
  WHERE NOT EXISTS (
    SELECT 1 FROM calendar_templates WHERE name = 'GST Filing Reminder' AND is_system = true
  );

  -- Production Planning Note
  INSERT INTO calendar_templates (business_id, name, description, template_type, category, priority, is_system, content)
  SELECT
    sys_biz_id,
    'Production Planning Note',
    'Template for production planning meetings',
    'note',
    'production',
    'high',
    true,
    '<h3>Production Planning</h3><ul><li>Target output for the day/week</li><li>Fabric availability check</li><li>Worker allocation</li><li>Machine status</li><li>Pending orders to complete</li></ul>'
  WHERE NOT EXISTS (
    SELECT 1 FROM calendar_templates WHERE name = 'Production Planning Note' AND is_system = true
  );

  -- Supplier Follow-up Checklist
  INSERT INTO calendar_templates (business_id, name, description, template_type, category, priority, is_system, task_items)
  SELECT
    sys_biz_id,
    'Supplier Follow-up Checklist',
    'Standard supplier follow-up tasks',
    'task',
    'purchase',
    'high',
    true,
    '[
      {"title": "Call supplier to confirm dispatch", "sort_order": 0},
      {"title": "Verify material quality on arrival", "sort_order": 1},
      {"title": "Check invoice and update purchase records", "sort_order": 2},
      {"title": "Arrange payment as per terms", "sort_order": 3},
      {"title": "Update stock after receipt", "sort_order": 4}
    ]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM calendar_templates WHERE name = 'Supplier Follow-up Checklist' AND is_system = true
  );
END $$;

-- ──────────────────────────────────────────────────────────
-- 9. Helper function: auto-mark overdue entries
-- ──────────────────────────────────────────────────────────
-- Called by cron to move pending entries past their date to 'overdue'
CREATE OR REPLACE FUNCTION mark_overdue_calendar_entries()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE calendar_entries
  SET
    status = 'overdue',
    updated_at = NOW()
  WHERE
    status = 'pending'
    AND entry_date < CURRENT_DATE
    AND entry_type IN ('reminder', 'task', 'event')
    AND deleted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 10. Performance view: calendar_month_summary
-- ──────────────────────────────────────────────────────────
-- Used by the month-summary API endpoint
CREATE OR REPLACE VIEW calendar_month_summary AS
SELECT
  business_id,
  entry_date,
  COUNT(*) FILTER (WHERE entry_type = 'note'     AND deleted_at IS NULL) AS notes_count,
  COUNT(*) FILTER (WHERE entry_type = 'reminder' AND deleted_at IS NULL) AS reminders_count,
  COUNT(*) FILTER (WHERE entry_type = 'task'     AND deleted_at IS NULL) AS tasks_count,
  COUNT(*) FILTER (WHERE entry_type = 'event'    AND deleted_at IS NULL) AS events_count,
  COUNT(*) FILTER (WHERE entry_type = 'journal'  AND deleted_at IS NULL) AS journals_count,
  COUNT(*) FILTER (WHERE status = 'completed'    AND deleted_at IS NULL) AS completed_count,
  COUNT(*) FILTER (WHERE status = 'overdue'      AND deleted_at IS NULL) AS overdue_count,
  COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND deleted_at IS NULL) AS pending_count
FROM calendar_entries
GROUP BY business_id, entry_date;
