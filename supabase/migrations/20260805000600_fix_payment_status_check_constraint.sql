-- Migration: 20260805000600_fix_payment_status_check_constraint.sql
-- Description: Expand payment_status check constraints on sale_bills, purchase_bills, and raw_material_purchases to accept 'partially_paid'.

-- 1. Update check constraint on sale_bills
ALTER TABLE sale_bills DROP CONSTRAINT IF EXISTS sale_bills_payment_status_check;
ALTER TABLE sale_bills ADD CONSTRAINT sale_bills_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'partial', 'partially_paid', 'paid', 'overdue'));

-- 2. Update check constraint on purchase_bills
ALTER TABLE purchase_bills DROP CONSTRAINT IF EXISTS purchase_bills_payment_status_check;
ALTER TABLE purchase_bills ADD CONSTRAINT purchase_bills_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'partial', 'partially_paid', 'paid', 'overdue'));

-- 3. Update check constraint on raw_material_purchases
ALTER TABLE raw_material_purchases DROP CONSTRAINT IF EXISTS raw_material_purchases_payment_status_check;
ALTER TABLE raw_material_purchases ADD CONSTRAINT raw_material_purchases_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'partial', 'partially_paid', 'paid', 'overdue'));

-- 4. Re-reconcile paid_amount and payment_status for all sale_bills
WITH alloc_sums AS (
  SELECT bill_id, SUM(allocated_amount) as total_alloc
  FROM payment_allocations
  WHERE bill_type = 'sale_bill'
  GROUP BY bill_id
)
UPDATE sale_bills sb
SET paid_amount = COALESCE(a.total_alloc, 0),
    payment_status = CASE 
      WHEN COALESCE(a.total_alloc, 0) >= sb.grand_total THEN 'paid' 
      WHEN COALESCE(a.total_alloc, 0) > 0 THEN 'partially_paid' 
      ELSE 'unpaid' 
    END
FROM alloc_sums a
WHERE sb.id = a.bill_id;
