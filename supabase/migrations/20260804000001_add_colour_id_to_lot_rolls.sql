-- Migration: 20260804000001_add_colour_id_to_lot_rolls.sql
-- Description: Add colour_id to lot_rolls table to track design colour per roll allocation in production lots

ALTER TABLE lot_rolls ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id);
