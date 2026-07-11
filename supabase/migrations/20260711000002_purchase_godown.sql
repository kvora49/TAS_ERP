-- Migration: 20260711000002_purchase_godown.sql
-- Add godown_id to raw_material_purchases referencing godowns(id)

ALTER TABLE raw_material_purchases
ADD COLUMN IF NOT EXISTS godown_id UUID REFERENCES godowns(id);
