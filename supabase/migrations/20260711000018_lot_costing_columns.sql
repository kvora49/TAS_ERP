-- Migration: 20260711000018_lot_costing_columns.sql
-- Add accessory_cost and other_cost to production_lots

ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS accessory_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS other_cost NUMERIC(12,2) DEFAULT 0;
