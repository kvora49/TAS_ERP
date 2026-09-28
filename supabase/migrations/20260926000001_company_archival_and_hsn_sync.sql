-- Migration: Company Archival & HSN-GST Sync
-- Adds archived_at column to businesses and a unique index guard for gst_rates hsn lookups.
-- Run in Supabase SQL Editor.

-- 1. Add archived_at to businesses (nullable TIMESTAMPTZ — NULL means active)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index to quickly filter non-archived businesses
CREATE INDEX IF NOT EXISTS idx_businesses_archived_at
  ON businesses (id)
  WHERE archived_at IS NULL;

-- 3. Add index on gst_rates (business_id, hsn_code) for fast HSN lookups during design/material saves
CREATE UNIQUE INDEX IF NOT EXISTS idx_gst_rates_business_hsn
  ON gst_rates (business_id, lower(hsn_code));

-- NOTE: The application will handle archive/restore by setting/clearing archived_at.
-- All non-owner members will have their company_members.status set to 'revoked' on archive,
-- and restored to 'active' on restore. Only the owner row is preserved.
