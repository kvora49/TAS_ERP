-- Migration: Add is_temporary and temp_bill_number columns to sale_bills
ALTER TABLE sale_bills 
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_bill_number TEXT;

-- Create index on is_temporary and temp_bill_number for fast query filtering
CREATE INDEX IF NOT EXISTS idx_sale_bills_is_temporary ON sale_bills(is_temporary);
CREATE INDEX IF NOT EXISTS idx_sale_bills_temp_bill_number ON sale_bills(temp_bill_number);
