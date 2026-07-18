-- Atomic function to record a write-off against a bill (Sale, Purchase, or Raw Material Purchase)
CREATE OR REPLACE FUNCTION record_write_off(
  p_business_id UUID,
  p_bill_type TEXT,
  p_bill_id UUID,
  p_write_off_type TEXT,
  p_amount NUMERIC(15,2),
  p_remarks TEXT,
  p_written_off_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_write_off_id UUID;
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
BEGIN
  -- 1. Insert write-off record
  INSERT INTO write_offs (
    business_id, bill_type, bill_id, write_off_type, amount, remarks,
    written_off_by, written_off_at
  ) VALUES (
    p_business_id, p_bill_type, p_bill_id, p_write_off_type, p_amount, p_remarks,
    p_written_off_by, NOW()
  ) RETURNING id INTO v_write_off_id;

  -- 2. Adjust bill paid_amount and status
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
  END IF;

  RETURN v_write_off_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Atomic function to reverse a write-off and restore outstanding balances
CREATE OR REPLACE FUNCTION reverse_write_off(
  p_business_id UUID,
  p_write_off_id UUID,
  p_reversed_by UUID,
  p_reversal_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_bill_id UUID;
  v_bill_type TEXT;
  v_amount NUMERIC(15,2);
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
BEGIN
  -- 1. Fetch write-off details
  SELECT bill_id, bill_type, amount INTO v_bill_id, v_bill_type, v_amount
  FROM write_offs
  WHERE id = p_write_off_id AND business_id = p_business_id AND reversed_at IS NULL;

  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'Active write-off record not found';
  END IF;

  -- 2. Mark write-off as reversed
  UPDATE write_offs
  SET reversed_at = NOW(),
      reversed_by = p_reversed_by,
      reversal_reason = p_reversal_reason
  WHERE id = p_write_off_id;

  -- 3. Decrease bill paid_amount and restore status
  IF v_bill_type = 'sale_bill' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM sale_bills WHERE id = v_bill_id;

    v_new_paid := GREATEST(0, COALESCE(v_current_paid, 0) - v_amount);
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' WHEN v_new_paid > 0 THEN 'partial' ELSE 'unpaid' END;

    UPDATE sale_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = v_bill_id;

  ELSIF v_bill_type = 'raw_material_purchase' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM raw_material_purchases WHERE id = v_bill_id;

    v_new_paid := GREATEST(0, COALESCE(v_current_paid, 0) - v_amount);
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' WHEN v_new_paid > 0 THEN 'partial' ELSE 'unpaid' END;

    UPDATE raw_material_purchases
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = v_bill_id;

  ELSIF v_bill_type = 'purchase_bill' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM purchase_bills WHERE id = v_bill_id;

    v_new_paid := GREATEST(0, COALESCE(v_current_paid, 0) - v_amount);
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' WHEN v_new_paid > 0 THEN 'partial' ELSE 'unpaid' END;

    UPDATE purchase_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = v_bill_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
