-- Migration: 20260711000012_lot_extensions.sql
-- Add garment_type_id, design_type, and lot_name to production_lots
-- Add default_production_target_days to business_settings

ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS garment_type_id UUID REFERENCES garment_types(id);
ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS design_type TEXT;
ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS lot_name TEXT;

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_production_target_days INTEGER DEFAULT 90;
