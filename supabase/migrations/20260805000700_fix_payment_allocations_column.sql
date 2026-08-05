-- Migration: 20260805000700_fix_payment_allocations_column.sql
-- Description: Fix settle_advance_multi RPC by removing non-existent created_by column from payment_allocations insert.

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
  v_target_bill_id UUID;
  v_target_bill_type TEXT;
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

  -- Compute total allocation amount requested (supporting both camelCase and snake_case JSON keys)
  FOR v_alloc IN 
    SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
      "billId" UUID, "allocatedAmount" NUMERIC(15,2), "billType" TEXT,
      bill_id UUID, allocated_amount NUMERIC(15,2), bill_type TEXT
    ) 
  LOOP
    v_alloc_amount := COALESCE(v_alloc."allocatedAmount", v_alloc.allocated_amount, 0);
    v_total_to_settle := v_total_to_settle + v_alloc_amount;
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
  FOR v_alloc IN 
    SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
      "billId" UUID, "allocatedAmount" NUMERIC(15,2), "billType" TEXT,
      bill_id UUID, allocated_amount NUMERIC(15,2), bill_type TEXT
    ) 
  LOOP
    v_alloc_amount := COALESCE(v_alloc."allocatedAmount", v_alloc.allocated_amount, 0);
    v_target_bill_id := COALESCE(v_alloc."billId", v_alloc.bill_id);
    v_target_bill_type := COALESCE(v_alloc."billType", v_alloc.bill_type);

    IF v_alloc_amount > 0 AND v_target_bill_id IS NOT NULL THEN
      INSERT INTO payment_allocations (
        business_id, payment_id, bill_type, bill_id, allocated_amount
      ) VALUES (
        p_business_id, v_payment_id, v_target_bill_type, v_target_bill_id, v_alloc_amount
      );

      IF v_target_bill_type = 'sale_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM sale_bills WHERE id = v_target_bill_id;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE sale_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_target_bill_id;

      ELSIF v_target_bill_type = 'raw_material_purchase' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM raw_material_purchases WHERE id = v_target_bill_id;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE raw_material_purchases
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_target_bill_id;

      ELSIF v_target_bill_type = 'purchase_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM purchase_bills WHERE id = v_target_bill_id;

        v_new_paid := v_current_paid + v_alloc_amount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE purchase_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_target_bill_id;

      ELSIF v_target_bill_type = 'job_work_entry' THEN
        BEGIN
          UPDATE stage_entries
          SET paid_amount = COALESCE(paid_amount, 0) + v_alloc_amount,
              payment_status = CASE WHEN (COALESCE(paid_amount, 0) + v_alloc_amount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partially_paid' END
          WHERE id = v_target_bill_id;
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN v_total_to_settle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
