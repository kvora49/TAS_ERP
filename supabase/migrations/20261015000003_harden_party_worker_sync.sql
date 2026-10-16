-- Keep workers as a derived projection of parties.  Financial and production
-- records continue to reference the same UUID; a party removal only retires the
-- worker record and never deletes historical work or reconciliation evidence.

CREATE OR REPLACE FUNCTION public.tr_sync_party_to_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL
     OR NOT ('worker' = ANY(NEW.type) OR 'job_worker' = ANY(NEW.type)) THEN
    UPDATE public.workers
       SET is_active = false,
           deleted_at = COALESCE(deleted_at, NOW()),
           updated_at = NOW()
     WHERE id = NEW.id
       AND business_id = NEW.business_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.workers (
    id, business_id, name, worker_id, type, phone, address, remarks,
    is_active, created_at, updated_at, deleted_at
  ) VALUES (
    NEW.id,
    NEW.business_id,
    NEW.name,
    COALESCE(NULLIF(NEW.code, ''), 'WRK') || '_' || SUBSTRING(NEW.id::text, 1, 6),
    CASE WHEN 'job_worker' = ANY(NEW.type) THEN 'job_worker' ELSE 'permanent' END,
    NEW.phone,
    NEW.billing_address_line1,
    NEW.remarks,
    COALESCE(NEW.is_active, true),
    COALESCE(NEW.created_at, NOW()),
    NOW(),
    NULL
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    worker_id = EXCLUDED.worker_id,
    type = EXCLUDED.type,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    remarks = EXCLUDED.remarks,
    is_active = EXCLUDED.is_active,
    deleted_at = NULL,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_party_to_worker ON public.parties;
CREATE TRIGGER tr_sync_party_to_worker
  AFTER INSERT OR UPDATE OF name, type, code, phone, billing_address_line1, remarks, is_active, deleted_at
  ON public.parties
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_sync_party_to_worker();
