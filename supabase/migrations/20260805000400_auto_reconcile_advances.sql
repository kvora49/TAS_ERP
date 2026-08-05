-- Migration: 20260805000400_auto_reconcile_advances.sql
-- Description: Unify advance_payments with payments table via real-time triggers, update record_payment RPC, and clean up historical desynced advances.

-- 1. Create automatic sync function between payments and advance_payments
CREATE OR REPLACE FUNCTION sync_advance_payments_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- If new/updated payment has unallocated_amount > 0
  IF NEW.unallocated_amount > 0 THEN
    -- Check if advance_payments record exists
    IF EXISTS (SELECT 1 FROM advance_payments WHERE payment_id = NEW.id) THEN
      UPDATE advance_payments
      SET remaining_amount = NEW.unallocated_amount,
          is_settled = false,
          updated_at = NOW()
      WHERE payment_id = NEW.id;
    ELSE
      INSERT INTO advance_payments (
        business_id, payment_id, party_id, advance_amount,
        settled_amount, remaining_amount, is_settled, created_at, updated_at
      ) VALUES (
        NEW.business_id, NEW.id, NEW.party_id, NEW.amount,
        (NEW.amount - NEW.unallocated_amount), NEW.unallocated_amount, false, NEW.created_at, NOW()
      );
    END IF;
  ELSE
    -- If unallocated_amount = 0, mark advance as settled
    UPDATE advance_payments
    SET remaining_amount = 0,
        settled_amount = advance_amount,
        is_settled = true,
        updated_at = NOW()
    WHERE payment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_sync_advance_payments ON payments;
CREATE TRIGGER trg_sync_advance_payments
AFTER INSERT OR UPDATE OF unallocated_amount ON payments
FOR EACH ROW
EXECUTE FUNCTION sync_advance_payments_fn();

-- 2. Update record_payment RPC to guarantee sync with advance_payments
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

  -- Calculate total allocated from JSONB
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(billId UUID, allocatedAmount NUMERIC(15,2), billType TEXT) LOOP
    v_allocated_total := v_allocated_total + COALESCE(v_alloc.allocatedAmount, 0);
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
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(billId UUID, allocatedAmount NUMERIC(15,2), billType TEXT) LOOP
    IF COALESCE(v_alloc.allocatedAmount, 0) > 0 THEN
      INSERT INTO payment_allocations (
        business_id, payment_id, bill_type, bill_id, allocated_amount
      ) VALUES (
        p_business_id, v_payment_id, v_alloc.billType, v_alloc.billId, v_alloc.allocatedAmount
      );

      IF v_alloc.billType = 'sale_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM sale_bills WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc.allocatedAmount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE sale_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'raw_material_purchase' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM raw_material_purchases WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc.allocatedAmount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE raw_material_purchases
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'purchase_bill' THEN
        SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
        FROM purchase_bills WHERE id = v_alloc.billId;

        v_new_paid := v_current_paid + v_alloc.allocatedAmount;
        v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

        UPDATE purchase_bills
        SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
        WHERE id = v_alloc.billId;

      ELSIF v_alloc.billType = 'job_work_entry' THEN
        BEGIN
          UPDATE stage_entries
          SET paid_amount = COALESCE(paid_amount, 0) + v_alloc.allocatedAmount,
              payment_status = CASE WHEN (COALESCE(paid_amount, 0) + v_alloc.allocatedAmount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partially_paid' END
          WHERE id = v_alloc.billId;
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

-- 3. Data Reconciliation SQL: Sync all existing payments into advance_payments
-- A. Ensure all payments with unallocated_amount > 0 have an advance_payments row
INSERT INTO advance_payments (
  business_id, payment_id, party_id, advance_amount,
  settled_amount, remaining_amount, is_settled, created_at, updated_at
)
SELECT 
  p.business_id, p.id, p.party_id, p.amount,
  (p.amount - p.unallocated_amount), p.unallocated_amount, false, p.created_at, NOW()
FROM payments p
WHERE p.unallocated_amount > 0
  AND NOT EXISTS (SELECT 1 FROM advance_payments ap WHERE ap.payment_id = p.id);

-- B. Update existing advance_payments rows to match actual payments.unallocated_amount
UPDATE advance_payments ap
SET remaining_amount = p.unallocated_amount,
    settled_amount = (ap.advance_amount - p.unallocated_amount),
    is_settled = (p.unallocated_amount <= 0),
    updated_at = NOW()
FROM payments p
WHERE ap.payment_id = p.id;
