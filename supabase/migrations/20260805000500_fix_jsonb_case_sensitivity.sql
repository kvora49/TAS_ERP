-- Migration: 20260805000500_fix_jsonb_case_sensitivity.sql
-- Description: Fix case sensitivity in jsonb_to_recordset across record_payment and settle_advance_multi RPC functions.

-- 1. Fix settle_advance_multi RPC
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
        business_id, payment_id, bill_type, bill_id, allocated_amount, created_by
      ) VALUES (
        p_business_id, v_payment_id, v_target_bill_type, v_target_bill_id, v_alloc_amount, p_created_by
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

-- 2. Fix record_payment RPC
CREATE OR REPLACE FUNCTION record_payment(
  p_business_id UUID,
  p_direction TEXT,
  p_party_id UUID,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_reference_no TEXT,
  p_bank_account_id UUID,
  p_amount NUMERIC(15,2),
  p_remarks TEXT,
  p_allocations JSONB,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_payment_no TEXT;
  v_allocated_total NUMERIC(15,2) := 0;
  v_unallocated NUMERIC(15,2);
  v_alloc RECORD;
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
  v_seq_no INT;
  v_bank_bal NUMERIC(15,2);
  v_bank_name TEXT;
  v_alloc_amount NUMERIC(15,2);
  v_target_bill_id UUID;
  v_target_bill_type TEXT;
BEGIN
  -- Validate sufficient balance for outgoing immediate payments
  IF p_direction = 'paid' AND p_bank_account_id IS NOT NULL AND p_payment_mode NOT IN ('cheque', 'pdc') THEN
    SELECT COALESCE(current_balance, 0), name INTO v_bank_bal, v_bank_name
    FROM bank_accounts
    WHERE id = p_bank_account_id AND business_id = p_business_id AND deleted_at IS NULL;

    IF v_bank_bal IS NOT NULL AND v_bank_bal < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance in "%". Available: ₹%, Required: ₹%',
        COALESCE(v_bank_name, 'Selected Account'), TO_CHAR(v_bank_bal, 'FM99,99,99,990.00'), TO_CHAR(p_amount, 'FM99,99,99,990.00');
    END IF;
  END IF;

  -- 1. Generate payment number
  SELECT COALESCE(MAX(SUBSTRING(payment_number FROM '\d+$')::INT), 0) + 1
  INTO v_seq_no
  FROM payments
  WHERE business_id = p_business_id AND direction = p_direction;

  v_payment_no := CASE WHEN p_direction = 'received' THEN 'REC-' ELSE 'PAY-' END 
                  || TO_CHAR(p_payment_date, 'YYYYMMDD') || '-' 
                  || LPAD(v_seq_no::TEXT, 4, '0');

  -- Calculate total allocated from JSONB (supporting both camelCase and snake_case keys)
  FOR v_alloc IN 
    SELECT * FROM jsonb_to_recordset(p_allocations) AS x(
      "billId" UUID, "allocatedAmount" NUMERIC(15,2), "billType" TEXT,
      bill_id UUID, allocated_amount NUMERIC(15,2), bill_type TEXT
    ) 
  LOOP
    v_alloc_amount := COALESCE(v_alloc."allocatedAmount", v_alloc.allocated_amount, 0);
    v_allocated_total := v_allocated_total + v_alloc_amount;
  END LOOP;

  v_unallocated := GREATEST(0, p_amount - v_allocated_total);

  -- 2. Insert payments record
  INSERT INTO payments (
    business_id, payment_number, direction, party_id, payment_date,
    payment_mode, reference_no, bank_account_id, amount, unallocated_amount,
    is_advance, remarks, status, created_by
  ) VALUES (
    p_business_id, v_payment_no, p_direction, p_party_id, p_payment_date,
    p_payment_mode, p_reference_no, p_bank_account_id, p_amount, v_unallocated,
    (v_allocated_total = 0), p_remarks, 'completed', p_created_by
  ) RETURNING id INTO v_payment_id;

  -- 3. Update bank account balance for immediate payment modes
  IF p_bank_account_id IS NOT NULL AND p_payment_mode NOT IN ('cheque', 'pdc') THEN
    IF p_direction = 'received' THEN
      UPDATE bank_accounts
      SET current_balance = COALESCE(current_balance, 0) + p_amount, updated_at = NOW()
      WHERE id = p_bank_account_id AND business_id = p_business_id;
    ELSIF p_direction = 'paid' THEN
      UPDATE bank_accounts
      SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = NOW()
      WHERE id = p_bank_account_id AND business_id = p_business_id;
    END IF;
  END IF;

  -- 4. If payment_mode is cheque or pdc, auto-create cheque entry
  IF p_payment_mode IN ('cheque', 'pdc') THEN
    INSERT INTO cheques (
      business_id, cheque_number, direction, party_id, bank_name,
      account_no, cheque_date, due_date, amount, status,
      received_account_id, remarks, created_by
    ) VALUES (
      p_business_id, COALESCE(p_reference_no, 'CHQ-' || v_payment_no), 
      CASE WHEN p_direction = 'received' THEN 'received' ELSE 'issued' END,
      p_party_id, 'Bank', '', p_payment_date, p_payment_date, p_amount, 'pending',
      p_bank_account_id, p_remarks, p_created_by
    );
  END IF;

  -- 5. Loop over allocations, insert payment_allocations, and update respective bills
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

  -- 6. Guarantee advance_payments table entry if unallocated > 0
  IF v_unallocated > 0 THEN
    IF EXISTS (SELECT 1 FROM advance_payments WHERE payment_id = v_payment_id) THEN
      UPDATE advance_payments
      SET remaining_amount = v_unallocated, is_settled = false, updated_at = NOW()
      WHERE payment_id = v_payment_id;
    ELSE
      INSERT INTO advance_payments (
        business_id, payment_id, party_id, advance_amount,
        settled_amount, remaining_amount, is_settled, created_at, updated_at
      ) VALUES (
        p_business_id, v_payment_id, p_party_id, p_amount,
        v_allocated_total, v_unallocated, false, NOW(), NOW()
      );
    END IF;
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
