-- Add backup scheduling columns to business_settings table
ALTER TABLE business_settings
ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS backup_frequency TEXT DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS backup_time TEXT DEFAULT '23:45',
ADD COLUMN IF NOT EXISTS backup_retention_days INTEGER DEFAULT 30;
