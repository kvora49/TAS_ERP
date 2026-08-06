-- Migration: Add code column to godowns table
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- Backfill codes for existing godowns without code
UPDATE godowns
SET code = 'GDN-' || UPPER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'))
WHERE code IS NULL OR TRIM(code) = '';
