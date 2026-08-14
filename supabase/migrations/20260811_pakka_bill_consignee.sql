-- ============================================================
-- Migration: Pakka Bill Consignee, Dispatch & Print Settings
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- 1. Consignee / Ship-To fields on sale_bills
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS ship_to_same_as_bill_to BOOLEAN DEFAULT TRUE;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS consignee_name TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS consignee_address TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS consignee_gstin TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS consignee_state TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS consignee_state_code TEXT;

-- 2. Dispatch / shipping reference fields on sale_bills
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS buyer_order_no TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS buyer_order_date DATE;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS dispatch_doc_no TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS delivery_note_date DATE;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS dispatched_through TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS terms_of_delivery TEXT;
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS mode_of_payment TEXT;

-- 3. Print section exclusion preferences saved per bill (JSONB)
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS print_exclusions JSONB DEFAULT '{}'::jsonb;

-- 4. Structured bank + terms + declaration on brand_bill_config
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS terms_conditions TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS declaration TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE brand_bill_config ADD COLUMN IF NOT EXISTS bank_account_type TEXT DEFAULT 'Current Account';
