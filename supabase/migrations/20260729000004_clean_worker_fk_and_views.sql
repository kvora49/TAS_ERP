-- Migration: 20260729000004_clean_worker_fk_and_views.sql
-- Automate workers_deprecated table sync via PostgreSQL Triggers for seamless execution.

CREATE OR REPLACE FUNCTION tr_sync_workers_deprecated()
RETURNS TRIGGER AS $$
BEGIN
  IF ('worker' = ANY(NEW.type) OR 'job_worker' = ANY(NEW.type)) THEN
    INSERT INTO workers_deprecated (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.business_id,
      NEW.name,
      COALESCE(NULLIF(NEW.code, ''), 'JW') || '_dep',
      CASE 
        WHEN 'job_worker' = ANY(NEW.type) THEN 'job_worker'
        WHEN 'worker' = ANY(NEW.type) THEN 'permanent'
        ELSE 'job_worker'
      END,
      NEW.phone,
      NEW.billing_address_line1,
      NEW.remarks,
      COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, NOW()),
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_workers_deprecated ON parties;
CREATE TRIGGER tr_sync_workers_deprecated
  AFTER INSERT OR UPDATE ON parties
  FOR EACH ROW
  EXECUTE FUNCTION tr_sync_workers_deprecated();
