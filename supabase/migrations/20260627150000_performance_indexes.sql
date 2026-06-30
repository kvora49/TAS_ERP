-- Database performance optimization indexes for TAS ERP
-- Execute these in your Supabase SQL Editor to improve query and RLS performance.

-- 1. Indexes on business_id (for RLS performance on tables without composite unique keys starting with business_id)
CREATE INDEX IF NOT EXISTS idx_purchase_items_business_id ON raw_material_purchase_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_business_id ON purchase_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_return_items_business_id ON purchase_return_items(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_business_id ON raw_material_stock_entry_items(business_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_business_id ON party_bank_details(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_business_id ON whatsapp_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_business_id ON backup_history(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON audit_log(business_id);

-- 2. Foreign Key Indexes (to prevent sequential scans on joins and filter lookups)
-- Parties & Payments
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON raw_material_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier_id ON purchase_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier_id ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_party_id ON party_bank_details(party_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_party_id ON whatsapp_logs(party_id);

-- Stock & Entries
CREATE INDEX IF NOT EXISTS idx_stock_entries_godown_id ON raw_material_stock_entries(godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry_id ON raw_material_stock_entry_items(stock_entry_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_material_type ON raw_material_stock_entry_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material_type ON raw_material_purchase_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_current_stock_godown_id ON raw_material_current_stock(godown_id);
CREATE INDEX IF NOT EXISTS idx_current_stock_material_type ON raw_material_current_stock(material_type_id);

-- 3. Ordering / Range Query Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date ON raw_material_purchases(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_entries_posting_date ON raw_material_stock_entries(posting_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
