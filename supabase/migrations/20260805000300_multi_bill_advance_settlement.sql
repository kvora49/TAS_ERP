-- Migration: 20260805000300_multi_bill_advance_settlement.sql
-- Description: Create settle_advance_multi RPC, fix status values to 'partially_paid', and run data reconciliation.

-- 1. Create settle_advance_multi RPC procedure
CREATE OR REPLACE FUNCTION settle_advance_multi(
  p_business_id UUID,
  p_advance_id UUID,
  p_allocations JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS NUMERIC(15,2) AS $$
DECLARE
  v_payment_id UUID;
  v_remaining NUMERIC(15,2);
  v_total_to_settle NUMERIC(15,2) := 0;
  v_alloc RECORD;
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
  v_alloc_amount NUMERIC(15,2);
BEGIN
  -- 1. Fetch advance record details
  SELECT payment_id, remaining_amount INTO v_payment_id, v_remaining
  FROM advance_payments
  WHERE id = p_advance_id AND business_id = p_business_id;

  IF v_payment_id IS NULL THEN
    -- Fallback: check if p_advance_id is directly a payment_id
    SELECT id, unallocated_amount INTO v_payment_id, v_remaining
    FROM payments
    WHERE id = p_advance_id AND business_id = p_business_id;
  END IF;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Advance record not found';
  END IF;

  -- Compute total allocation amount requested
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(billId UUID, allocatedAmount NUMERIC(15,2), billType TEXT) LOOP
    v_total_to_settle := v_total_to_settle + COALESCE(v_alloc.allocatedAmount, 0);
  END LOOP;

  IF v_total_to_settle <= 0 THEN
    RAISE EXCEPTION 'No valid settlement allocation amounts provided';
  END IF;

  IF v_total_to_settle > v_remaining THEN
    RAISE EXCEPTION 'Settlement total (₹%) exceeds available advance balance (₹%)', v_total_to_settle, v_remaining;
  END IF;

  -- 2. Update advance_payments table if row exists
  UPDATE advance_payments
  SET settled_amount = COALESCE(settled_amount, 0) + v_total_to_settle,
      remaining_amount = GREATEST(0, COALESCE(remaining_amount, 0) - v_total_to_settle),
      is_settled = (GREATEST(0, COALESCE(remaining_amount, 0) - v_total_to_settle) <= 0),
      updated_at = NOW()
  WHERE id = p_advance_id OR payment_id = v_payment_id;

  -- Update payments table unallocated_amount
  UPDATE payments
  SET unallocated_amount = GREATEST(0, COALESCE(unallocated_amount, 0) - v_total_to_settle),
      updated_at = NOW()
  WHERE id = v_payment_id;

  -- 3. Loop over allocations, insert payment_allocations, and update respective bills
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(billId UUID, allocatedAmount NUMERIC(15,2), billType TEXT) LOOP
    v_alloc_amount := COALESCE(v_alloc.allocatedAmount, 0);
    IF v_alloc_amount > 0 THEN
      INSERT INTO payment_allocations (
        business_id, payment_id, bill_type, bill_id, allocated_amount, created_by
      ) VALUES (
        p_business_id, v_payment_id, v_alloc.billType, v_alloc.billId, v_alloc_amount, p_created_by
      );

      IF v_alloc.billType = 'sale_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM sale_bills WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE sale_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'raw_material_purchase' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM raw_material_purchases WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE raw_material_purchases
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'purchase_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM purchase_bills WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE purchase_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'job_work_entry' THEN
        BEGIN
          UPDATE stage_entries
          SET paid_amount = COALESCE(paid_amount, 0) + v_alloc_amount,
              payment_status = CASE WHEN (COALESCE(paid_amount, 0) + v_alloc_amount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partially_paid' END
          WHERE id = v_alloc.billId;
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN v_total_to_settle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update legacy single-bill settle_advance RPC to set 'partially_paid' instead of 'partial'
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
    SELECT id, unallocated_amount INTO v_payment_id, v_remaining
    FROM payments
    WHERE id = p_advance_id AND business_id = p_business_id;
  END IF;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Advance record not found';
  END IF;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Settlement amount exceeds remaining advance amount';
  END IF;

  -- 2. Update advance_payments status
  UPDATE advance_payments
  SET settled_amount = COALESCE(settled_amount, 0) + p_amount,
      remaining_amount = GREATEST(0, COALESCE(remaining_amount, 0) - p_amount),
      is_settled = (GREATEST(0, COALESCE(remaining_amount, 0) - p_amount) <= 0),
      updated_at = NOW()
  WHERE id = p_advance_id OR payment_id = v_payment_id;

  UPDATE payments
  SET unallocated_amount = GREATEST(0, COALESCE(unallocated_amount, 0) - p_amount),
      updated_at = NOW()
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
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

    UPDATE sale_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'raw_material_purchase' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM raw_material_purchases WHERE id = p_bill_id;

    v_new_paid := COALESCE(v_current_paid, 0) + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

    UPDATE raw_material_purchases
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'purchase_bill' THEN
    SELECT paid_amount, grand_total INTO v_current_paid, v_grand_total
    FROM purchase_bills WHERE id = p_bill_id;

    v_new_paid := COALESCE(v_current_paid, 0) + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

    UPDATE purchase_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status
    WHERE id = p_bill_id;

  ELSIF p_bill_type = 'job_work_entry' THEN
    BEGIN
      UPDATE stage_entries
      SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
          payment_status = CASE WHEN (COALESCE(paid_amount, 0) + p_amount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partially_paid' END
      WHERE id = p_bill_id;
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Data Reconciliation SQL: Fix corrupted payment_status strings 'partial' -> 'partially_paid'
UPDATE sale_bills SET payment_status = 'partially_paid' WHERE payment_status = 'partial';
UPDATE purchase_bills SET payment_status = 'partially_paid' WHERE payment_status = 'partial';
UPDATE raw_material_purchases SET payment_status = 'partially_paid' WHERE payment_status = 'partial';

-- 4. Re-reconcile paid_amount for all sale_bills from payment_allocations
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
