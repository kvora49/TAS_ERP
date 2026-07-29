-- 20260727120000_motion_profile_column.sql
-- Add motion_profile column to business_settings table for experience level preferences

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS motion_profile TEXT DEFAULT 'balanced'
  CHECK (motion_profile IN ('ultraFast', 'balanced', 'premium'));
