-- Migration: 20260712000002_sale_bills_billing_address.sql
-- Description: Add billing_address TEXT column to sale_bills table for invoicing snapshot

ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS billing_address TEXT;
