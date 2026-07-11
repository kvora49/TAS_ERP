-- Migration: 20260711000004_workers_to_parties.sql
-- Add worker fields to parties, migrate workers table, and create workers view.

-- 1. Add worker fields to parties table
ALTER TABLE parties
ADD COLUMN IF NOT EXISTS stage_specialty TEXT[],
ADD COLUMN IF NOT EXISTS wage_type TEXT DEFAULT 'piece_rate',
ADD COLUMN IF NOT EXISTS wage_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS worker_type TEXT,
ADD COLUMN IF NOT EXISTS preferred_stage_id UUID REFERENCES production_stages(id),
ADD COLUMN IF NOT EXISTS working_since DATE;

-- 2. Migrate existing workers data into parties (only if the original workers table still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workers'
    AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO parties (
      id,
      business_id,
      name,
      type,
      phone,
      email,
      billing_address_line1,
      billing_city,
      billing_state,
      pan,
      aadhar,
      code,
      remarks,
      is_active,
      created_at,
      updated_at,
      deleted_at,
      stage_specialty,
      wage_type,
      wage_rate,
      worker_type,
      preferred_stage_id,
      working_since
    )
    SELECT
      id,
      business_id,
      name,
      ARRAY['worker']::TEXT[],
      phone,
      email,
      address,
      city,
      state,
      pan,
      aadhaar,
      worker_id,
      remarks,
      COALESCE(is_active, true),
      created_at,
      updated_at,
      deleted_at,
      CASE WHEN specialization IS NOT NULL AND specialization <> '' THEN ARRAY[specialization]::TEXT[] ELSE NULL END,
      'piece_rate',
      default_rate,
      type,
      preferred_stage_id,
      working_since
    FROM workers
    ON CONFLICT (id) DO NOTHING;

    -- 3. Migrate bank details to party_bank_details table
    INSERT INTO party_bank_details (
      business_id,
      party_id,
      bank_name,
      account_number,
      ifsc_code,
      is_primary
    )
    SELECT
      business_id,
      id,
      bank_name,
      account_number,
      ifsc_code,
      true
    FROM workers
    WHERE bank_name IS NOT NULL AND bank_name <> '' AND account_number IS NOT NULL AND account_number <> ''
    ON CONFLICT DO NOTHING;

    -- 4. Rename workers table to workers_deprecated
    ALTER TABLE workers RENAME TO workers_deprecated;
  END IF;
END $$;

-- 5. Create a compatibility view so existing queries referencing 'workers' table do not break
CREATE OR REPLACE VIEW workers AS
SELECT 
  id,
  business_id,
  name,
  code AS worker_id,
  worker_type AS type,
  phone,
  email,
  billing_address_line1 AS address,
  billing_city AS city,
  billing_state AS state,
  gstin,
  pan,
  aadhar AS aadhaar,
  CASE WHEN stage_specialty IS NOT NULL AND array_length(stage_specialty, 1) > 0 THEN stage_specialty[1] ELSE NULL END AS specialization,
  preferred_stage_id,
  wage_rate AS default_rate,
  NULL::INTEGER AS max_capacity_per_day, -- Placeholder/empty capacity
  NULL::TEXT AS payment_mode,
  NULL::TEXT AS payment_cycle,
  working_since,
  NULL::TEXT AS bank_name,
  NULL::TEXT AS account_number,
  NULL::TEXT AS ifsc_code,
  NULL::TEXT AS account_holder_name,
  remarks,
  is_active,
  NULL::UUID AS created_by,
  created_at,
  updated_at,
  deleted_at
FROM parties
WHERE 'worker' = ANY(type);

