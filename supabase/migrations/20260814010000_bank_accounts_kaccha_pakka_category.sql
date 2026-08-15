-- Description: Add account_category column ('pakka', 'kacha', 'both') to bank_accounts table, set initial defaults, and add performance index.

-- 1. Add account_category column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS account_category TEXT NOT NULL DEFAULT 'pakka';

-- 2. Drop existing constraint if any and re-add check constraint
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_account_category_check;
ALTER TABLE bank_accounts 
ADD CONSTRAINT bank_accounts_account_category_check 
CHECK (account_category IN ('pakka', 'kacha', 'both'));

-- 3. Initial backfill:
-- For accounts where type = 'cash', default them to 'kacha' or 'both' (defaulting to 'kacha' so cash is treated as kacha by default)
UPDATE bank_accounts
SET account_category = 'kacha'
WHERE type = 'cash' AND (account_category IS NULL OR account_category = 'pakka');

-- 4. Create performance index on (business_id, account_category)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_business_category 
ON bank_accounts (business_id, account_category);
