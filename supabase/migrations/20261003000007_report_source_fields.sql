-- Record source fields required for complete reporting. NULL means unavailable,
-- so existing invoices do not acquire invented tax components or due dates.
ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS bill_type text,
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS cgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS igst numeric(15,2);
ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS cgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS igst numeric(15,2);
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS cgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS igst numeric(15,2);
ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS cgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(15,2),
  ADD COLUMN IF NOT EXISTS igst numeric(15,2);
