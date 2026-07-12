-- Migration: 20260712000001_finished_stock_nullable_colour.sql
-- Description: Drop NOT NULL constraint on colour_id column of finished_stock table to support colourless lots

ALTER TABLE finished_stock ALTER COLUMN colour_id DROP NOT NULL;
