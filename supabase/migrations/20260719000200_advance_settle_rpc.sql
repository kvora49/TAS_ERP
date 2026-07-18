-- Atomic function to settle an advance payment against an outstanding bill
CREATE OR REPLACE FUNCTION settle_advance(
  p_business_id UUID,
  p_advance_id UUID,
  p_bill_id UUID,
  p_bill_type TEXT,
  p_amount NUMERIC(15,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment_id UUID;
  v_remaining NUMERIC(15,2);
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
BEGIN
  -- 1. Fetch advance remaining amount and payment_id
  SELECT payment_id, remaining_amount INTO v_payment_id, v_remaining
  FROM advance_payments
  WHERE id = p_advance_id AND business_id = p_business_id;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Advance record not found';
  END IF;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Settlement amount exceeds remaining advance amount';
  END IF;

  -- 2. Update advance_payments status
  UPDATE advance_payments
  SET settled_amount = settled_amount + p_amount,
      remaining_amount = remaining_amount - p_amount,
      is_settled = (remaining_amount - p_amount <= 0),
      updated_at = NOW()
  WHERE id = p_advance_id;

  -- Also update payments table unallocated_amount
  UPDATE payments
  SET unallocated_amount = unallocated_amount - p_amount
  WHERE id = v_payment_id;

  -- 3. Insert allocation record
  INSERT INTO payment_allocations (
    business_id, payment_id, bill_type, bill_id, allocated_amount
  ) VALUES (
    p_business_id, v_payment_id, p_bill_type, p_bill_id, p_amount
  );

  -- 4. Update the outstanding bill status/paid_amount
  IF p_bill_type = 'sale_bill' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM sale_bills WHERE id = p_bill_id;

    v_new_paid := COALESCE(v_current_paid, 0) + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partial' END;

    UPDATE sale_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'raw_material_purchase' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM raw_material_purchases WHERE id = p_bill_id;

    v_new_paid := COALESCE(v_current_paid, 0) + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partial' END;

    UPDATE raw_material_purchases
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'purchase_bill' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM purchase_bills WHERE id = p_bill_id;

    v_new_paid := COALESCE(v_current_paid, 0) + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partial' END;

    UPDATE purchase_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'job_work_entry' THEN
    BEGIN
      UPDATE stage_entries
      SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
          payment_status = CASE WHEN (COALESCE(paid_amount, 0) + p_amount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partial' END
      WHERE id = p_bill_id;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore or handle
    END;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
