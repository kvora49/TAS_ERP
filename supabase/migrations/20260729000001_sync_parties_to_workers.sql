-- Migration: 20260729000001_sync_parties_to_workers.sql
-- Synchronize parties of type 'worker' / 'job_worker' into workers table with collision-free worker_id codes
-- to prevent foreign key constraint violations on stage_entries (stage_entries_worker_id_fkey).

-- 1. Sync existing worker/job_worker parties into workers table
INSERT INTO workers (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
SELECT 
  p.id,
  p.business_id,
  p.name,
  COALESCE(NULLIF(p.code, ''), 'WRK') || '_' || SUBSTRING(p.id::text, 1, 6) AS worker_id,
  CASE 
    WHEN 'job_worker' = ANY(p.type) THEN 'job_worker'
    WHEN 'worker' = ANY(p.type) THEN 'permanent'
    ELSE 'job_worker'
  END AS type,
  p.phone,
  p.billing_address_line1 AS address,
  p.remarks,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(p.created_at, NOW()) AS created_at,
  COALESCE(p.updated_at, NOW()) AS updated_at
FROM parties p
WHERE ('worker' = ANY(p.type) OR 'job_worker' = ANY(p.type))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Create collision-proof auto-sync trigger on parties table
CREATE OR REPLACE FUNCTION sync_party_to_worker()
RETURNS TRIGGER AS $$
BEGIN
  IF ('worker' = ANY(NEW.type) OR 'job_worker' = ANY(NEW.type)) THEN
    INSERT INTO workers (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.business_id,
      NEW.name,
      COALESCE(NULLIF(NEW.code, ''), 'WRK') || '_' || SUBSTRING(NEW.id::text, 1, 6),
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

DROP TRIGGER IF EXISTS tr_sync_party_to_worker ON parties;
CREATE TRIGGER tr_sync_party_to_worker
  AFTER INSERT OR UPDATE ON parties
  FOR EACH ROW
  EXECUTE FUNCTION sync_party_to_worker();
