-- Validate every allocation before changing any advance or payment balance.
-- This replaces the previous best-effort job-work branch, which swallowed errors.

CREATE OR REPLACE FUNCTION public.settle_advance_multi(
  p_business_id UUID,
  p_advance_id UUID,
  p_allocations JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS NUMERIC(15,2)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_advance advance_payments;
  v_payment payments;
  v_alloc RECORD;
  v_total NUMERIC(15,2) := 0;
  v_amount NUMERIC(15,2);
  v_bill_id UUID;
  v_bill_type TEXT;
  v_paid NUMERIC(15,2);
  v_total_due NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
BEGIN
  IF v_actor IS NULL OR NOT public.auth_has_business_access(p_business_id) THEN
    RAISE EXCEPTION 'Active company membership is required' USING ERRCODE = '42501';
  END IF;
  IF p_created_by IS NOT NULL AND p_created_by <> v_actor THEN
    RAISE EXCEPTION 'Settlement actor does not match the authenticated user' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one allocation is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_advance
  FROM advance_payments
  WHERE id = p_advance_id AND business_id = p_business_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_payment FROM payments
    WHERE id = v_advance.payment_id AND business_id = p_business_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_payment FROM payments
    WHERE id = p_advance_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Advance record not found'; END IF;
    SELECT * INTO v_advance FROM advance_payments
    WHERE payment_id = v_payment.id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Advance balance record not found'; END IF;
  END IF;

  -- First pass: reject malformed, unsupported, foreign, and overpaid allocations.
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
    "billId" UUID, "allocatedAmount" NUMERIC(15,2), "billType" TEXT,
    bill_id UUID, allocated_amount NUMERIC(15,2), bill_type TEXT
  ) LOOP
    v_amount := COALESCE(v_alloc."allocatedAmount", v_alloc.allocated_amount);
    v_bill_id := COALESCE(v_alloc."billId", v_alloc.bill_id);
    v_bill_type := COALESCE(v_alloc."billType", v_alloc.bill_type);
    IF v_amount IS NULL OR v_amount <= 0 OR v_amount = 'NaN'::numeric OR v_bill_id IS NULL THEN
      RAISE EXCEPTION 'Every allocation requires a bill and a positive amount' USING ERRCODE = '22023';
    END IF;
    IF v_bill_type NOT IN ('sale_bill', 'purchase_bill', 'raw_material_purchase', 'job_work_entry') THEN
      RAISE EXCEPTION 'Unsupported allocation type: %', COALESCE(v_bill_type, '<null>') USING ERRCODE = '22023';
    END IF;
    v_total := v_total + v_amount;
  END LOOP;
  IF v_total > COALESCE(v_advance.remaining_amount, 0) OR v_total > COALESCE(v_payment.unallocated_amount, 0) THEN
    RAISE EXCEPTION 'Settlement amount exceeds available advance balance' USING ERRCODE = '22023';
  END IF;

  -- Second pass locks each target row and applies it. Any error rolls back all rows.
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
    "billId" UUID, "allocatedAmount" NUMERIC(15,2), "billType" TEXT,
    bill_id UUID, allocated_amount NUMERIC(15,2), bill_type TEXT
  ) LOOP
    v_amount := COALESCE(v_alloc."allocatedAmount", v_alloc.allocated_amount);
    v_bill_id := COALESCE(v_alloc."billId", v_alloc.bill_id);
    v_bill_type := COALESCE(v_alloc."billType", v_alloc.bill_type);
    IF v_bill_type = 'sale_bill' THEN
      SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_paid, v_total_due
      FROM sale_bills WHERE id = v_bill_id AND business_id = p_business_id FOR UPDATE;
    ELSIF v_bill_type = 'purchase_bill' THEN
      SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_paid, v_total_due
      FROM purchase_bills WHERE id = v_bill_id AND business_id = p_business_id FOR UPDATE;
    ELSIF v_bill_type = 'raw_material_purchase' THEN
      SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_paid, v_total_due
      FROM raw_material_purchases WHERE id = v_bill_id AND business_id = p_business_id FOR UPDATE;
    ELSE
      SELECT COALESCE(paid_amount, 0), COALESCE(total_job_work_amount, 0) INTO v_paid, v_total_due
      FROM stage_entries WHERE id = v_bill_id AND business_id = p_business_id FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Allocated bill does not belong to active company'; END IF;
    v_new_paid := v_paid + v_amount;
    IF v_new_paid > v_total_due THEN RAISE EXCEPTION 'Allocation exceeds bill outstanding balance'; END IF;

    INSERT INTO payment_allocations (business_id, payment_id, bill_type, bill_id, allocated_amount, created_by)
    VALUES (p_business_id, v_payment.id, v_bill_type, v_bill_id, v_amount, v_actor);
    IF v_bill_type = 'sale_bill' THEN
      UPDATE sale_bills SET paid_amount = v_new_paid, payment_status = CASE WHEN v_new_paid = v_total_due THEN 'paid' ELSE 'partially_paid' END, updated_at = NOW() WHERE id = v_bill_id;
    ELSIF v_bill_type = 'purchase_bill' THEN
      UPDATE purchase_bills SET paid_amount = v_new_paid, payment_status = CASE WHEN v_new_paid = v_total_due THEN 'paid' ELSE 'partially_paid' END, updated_at = NOW() WHERE id = v_bill_id;
    ELSIF v_bill_type = 'raw_material_purchase' THEN
      UPDATE raw_material_purchases SET paid_amount = v_new_paid, payment_status = CASE WHEN v_new_paid = v_total_due THEN 'paid' ELSE 'partially_paid' END, updated_at = NOW() WHERE id = v_bill_id;
    ELSE
      UPDATE stage_entries SET paid_amount = v_new_paid, payment_status = CASE WHEN v_new_paid = v_total_due THEN 'paid' ELSE 'partially_paid' END WHERE id = v_bill_id;
    END IF;
  END LOOP;

  UPDATE advance_payments SET settled_amount = COALESCE(settled_amount, 0) + v_total,
    remaining_amount = remaining_amount - v_total, is_settled = remaining_amount - v_total = 0, updated_at = NOW()
  WHERE id = v_advance.id;
  UPDATE payments SET unallocated_amount = COALESCE(unallocated_amount, 0) - v_total, updated_at = NOW() WHERE id = v_payment.id;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_advance_multi(UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_advance_multi(UUID, UUID, JSONB, UUID) TO authenticated;
