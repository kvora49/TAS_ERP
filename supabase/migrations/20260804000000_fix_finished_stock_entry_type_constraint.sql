-- Migration: 20260804000000_fix_finished_stock_entry_type_constraint.sql
-- Description: Fix finished_stock entry_type constraint and clean up stale reconciliation rows.

-- 1. Expand the entry_type constraint to include all valid types used by application code
ALTER TABLE finished_stock DROP CONSTRAINT IF EXISTS finished_stock_entry_type_check;
ALTER TABLE finished_stock ADD CONSTRAINT finished_stock_entry_type_check
  CHECK (entry_type IN (
    'production',
    'manual',
    'adjustment',
    'purchase',
    'return',
    'sale_return',
    'purchase_deduction',
    'transfer_in',
    'transfer_out',
    'challan_in',
    'challan_out',
    'sales_bill',
    'sales_return'
  ));

-- 2. Delete ALL manual-type rows since they were written by the buggy reconciliation
-- (double-counted purchases + returns). The next page load will trigger a fresh reconciliation.
DELETE FROM finished_stock WHERE entry_type = 'manual';

