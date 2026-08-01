-- Add default_work_center_id to business_settings table
ALTER TABLE business_settings
ADD COLUMN IF NOT EXISTS default_work_center_id UUID REFERENCES godowns(id);
