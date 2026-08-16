-- Migration: Add godown_id to sale_bills and sales_returns
-- This ensures that sales and returns always store their target godown directly on the table,
-- and allows reconciliation and watchdog to accurately track stock movements per godown.

-- 1. Add godown_id to sale_bills
ALTER TABLE public.sale_bills
  ADD COLUMN IF NOT EXISTS godown_id UUID REFERENCES public.godowns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_bills_godown
  ON public.sale_bills (business_id, godown_id)
  WHERE godown_id IS NOT NULL;

-- 2. Add godown_id to sales_returns
ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS godown_id UUID REFERENCES public.godowns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_returns_godown
  ON public.sales_returns (business_id, godown_id)
  WHERE godown_id IS NOT NULL;

-- 3. Backfill sale_bills.godown_id from stock_ledger
UPDATE public.sale_bills sb
SET godown_id = sl.godown_id
FROM (
  SELECT DISTINCT ON (reference_id) reference_id, godown_id
  FROM public.stock_ledger
  WHERE reference_table = 'sale_bills' AND godown_id IS NOT NULL
  ORDER BY reference_id, created_at DESC
) sl
WHERE sb.id = sl.reference_id AND sb.godown_id IS NULL;

-- 4. Backfill sales_returns.godown_id from stock_ledger
UPDATE public.sales_returns sr
SET godown_id = sl.godown_id
FROM (
  SELECT DISTINCT ON (reference_id) reference_id, godown_id
  FROM public.stock_ledger
  WHERE reference_table = 'sales_returns' AND godown_id IS NOT NULL
  ORDER BY reference_id, created_at DESC
) sl
WHERE sr.id = sl.reference_id AND sr.godown_id IS NULL;
