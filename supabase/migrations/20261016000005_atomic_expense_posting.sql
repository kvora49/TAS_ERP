-- Post an expense, reserve its daily sequence, and debit the source account as
-- one transaction. The API must not recreate any of these writes separately.

CREATE TABLE IF NOT EXISTS public.expense_number_counters (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  PRIMARY KEY (business_id, expense_date)
);

ALTER TABLE public.expense_number_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_number_counters_service_only ON public.expense_number_counters;
CREATE POLICY expense_number_counters_service_only ON public.expense_number_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.post_expense_atomic(
  p_business_id UUID,
  p_expense_type_id UUID,
  p_expense_date DATE,
  p_amount NUMERIC,
  p_gst_percent NUMERIC DEFAULT 0,
  p_paid_from_account_id UUID DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_vendor_invoice_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_expense expenses;
  v_account bank_accounts;
  v_sequence INTEGER;
  v_gst_amount NUMERIC(15,2);
  v_legacy_max INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.auth_has_business_access(p_business_id) THEN
    RAISE EXCEPTION 'Active company membership is required' USING ERRCODE = '42501';
  END IF;
  IF p_expense_date IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount = 'NaN'::numeric
     OR p_gst_percent IS NULL OR p_gst_percent < 0 OR p_gst_percent > 100 OR p_gst_percent = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Invalid expense amount, date, or GST percentage' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expense_types
    WHERE id = p_expense_type_id AND business_id = p_business_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid expense type' USING ERRCODE = '22023';
  END IF;

  -- Lock before checking the balance so competing posts cannot overspend it.
  IF p_paid_from_account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM bank_accounts
    WHERE id = p_paid_from_account_id AND business_id = p_business_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid payment account' USING ERRCODE = '22023'; END IF;
    IF COALESCE(v_account.current_balance, 0) < p_amount THEN
      RAISE EXCEPTION 'Insufficient funds in "%"', COALESCE(v_account.name, 'Selected Account') USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Seed once from old records; the counter row then serializes the daily sequence.
  SELECT COALESCE(MAX(NULLIF(substring(expense_number FROM '([0-9]+)$'), '')::INTEGER), 0)
    INTO v_legacy_max
  FROM expenses WHERE business_id = p_business_id AND expense_date = p_expense_date;
  INSERT INTO expense_number_counters (business_id, expense_date, last_value)
  VALUES (p_business_id, p_expense_date, v_legacy_max + 1)
  ON CONFLICT (business_id, expense_date)
  DO UPDATE SET last_value = expense_number_counters.last_value + 1
  RETURNING last_value INTO v_sequence;

  v_gst_amount := ROUND(p_amount * p_gst_percent / 100, 2);
  INSERT INTO expenses (
    business_id, expense_number, expense_type_id, expense_date, amount, gst_percent,
    gst_amount, paid_from_account_id, vendor_name, vendor_invoice_no, notes, created_by
  ) VALUES (
    p_business_id,
    'EXP-' || to_char(p_expense_date, 'YYYYMMDD') || '-' || lpad(v_sequence::TEXT, 4, '0'),
    p_expense_type_id, p_expense_date, p_amount, p_gst_percent, v_gst_amount,
    p_paid_from_account_id, NULLIF(trim(p_vendor_name), ''), NULLIF(trim(p_vendor_invoice_no), ''),
    NULLIF(trim(p_notes), ''), v_actor
  ) RETURNING * INTO v_expense;

  IF p_paid_from_account_id IS NOT NULL THEN
    UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = NOW()
    WHERE id = p_paid_from_account_id AND business_id = p_business_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment account disappeared while posting expense'; END IF;
  END IF;
  RETURN to_jsonb(v_expense);
END;
$$;

REVOKE ALL ON FUNCTION public.post_expense_atomic(UUID, UUID, DATE, NUMERIC, NUMERIC, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_expense_atomic(UUID, UUID, DATE, NUMERIC, NUMERIC, UUID, TEXT, TEXT, TEXT) TO authenticated;
