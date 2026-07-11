-- Migration: Add payment_method and upi_id to purchase_payments, and link job_work_payments to bank/upi accounts.
ALTER TABLE purchase_payments
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'upi', 'cash', 'cheque')),
ADD COLUMN upi_id UUID REFERENCES bank_accounts(id);

-- Backfill payment_method from payment_mode in purchase_payments
UPDATE purchase_payments
SET payment_method = 
  CASE 
    WHEN payment_mode = 'upi' THEN 'upi'
    WHEN payment_mode = 'cash' THEN 'cash'
    WHEN payment_mode = 'cheque' THEN 'cheque'
    ELSE 'bank_transfer'
  END;

ALTER TABLE job_work_payments
ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id),
ADD COLUMN upi_id UUID REFERENCES bank_accounts(id),
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'upi', 'cash', 'cheque'));

-- Backfill payment_method from payment_mode in job_work_payments
UPDATE job_work_payments
SET payment_method = 
  CASE 
    WHEN payment_mode = 'upi' THEN 'upi'
    WHEN payment_mode = 'cash' THEN 'cash'
    WHEN payment_mode = 'cheque' THEN 'cheque'
    ELSE 'bank_transfer'
  END;
