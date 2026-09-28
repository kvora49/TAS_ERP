-- Migration: 20260926000000_enhance_cheques_pdc_wiring.sql
-- Description: Enhance cheques table with payment_id, allocations JSONB, settlement_type, and debit_note_id. Add indexes for high-speed queries.

-- 1. Add columns to cheques
ALTER TABLE cheques ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE cheques ADD COLUMN IF NOT EXISTS allocations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cheques ADD COLUMN IF NOT EXISTS settlement_type TEXT DEFAULT 'on_account' CHECK (settlement_type IN ('on_account', 'bill_wise'));
ALTER TABLE cheques ADD COLUMN IF NOT EXISTS debit_note_id UUID REFERENCES debit_notes(id) ON DELETE SET NULL;

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cheques_business_party ON cheques(business_id, party_id);
CREATE INDEX IF NOT EXISTS idx_cheques_business_status ON cheques(business_id, status);
CREATE INDEX IF NOT EXISTS idx_cheques_business_payment ON cheques(business_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON cheques(business_id, due_date);
CREATE INDEX IF NOT EXISTS idx_cheques_direction ON cheques(business_id, direction);
