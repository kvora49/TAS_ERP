-- Migration: 20260805000000_bank_balance_and_cheque_wiring.sql
-- Description: Add current_balance column to bank_accounts, allow 'cash' type, auto-provision cash accounts, update payment RPCs to adjust bank/cash balances, and support issued cheque/PDC balance updates upon clearing.

-- 1. Add current_balance column to bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(15,2) DEFAULT 0;

-- 2. Update type constraint to allow 'bank', 'upi', and 'cash'
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_type_check;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_type_check CHECK (type = ANY (ARRAY['bank'::text, 'upi'::text, 'cash'::text]));

-- 3. Auto-provision default 'Cash in Hand' account for businesses without a cash account
INSERT INTO bank_accounts (
  business_id, type, name, sub_label, opening_balance, current_balance, is_default, is_active
)
SELECT 
  b.id, 'cash', 'Cash in Hand', 'Main Cash Register', 0, 0, false, true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts ba 
  WHERE ba.business_id = b.id AND ba.type = 'cash' AND ba.deleted_at IS NULL
);

-- 4. Initial backfill: Set current_balance = opening_balance for bank_accounts where current_balance IS NULL or 0
UPDATE bank_accounts
SET current_balance = COALESCE(opening_balance, 0)
WHERE current_balance IS NULL OR current_balance = 0;

-- 5. Update record_payment RPC
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
  p_allocations JSONB, -- Array of objects: [{"billId": "...", "allocatedAmount": 100.00, "billType": "..."}]
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
BEGIN
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
    (v_unallocated > 0), p_remarks, 'completed', p_created_by
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
      -- Insert allocation record
      INSERT INTO payment_allocations (
        business_id, payment_id, bill_type, bill_id, allocated_amount
      ) VALUES (
        p_business_id, v_payment_id, v_alloc.billType, v_alloc.billId, v_alloc.allocatedAmount
      );

      -- Update bill status/paid_amount based on type
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

  -- 6. If there is unallocated amount, insert into advance_payments
  IF v_unallocated > 0 THEN
    INSERT INTO advance_payments (
      business_id, payment_id, party_id, advance_amount, settled_amount,
      remaining_amount, is_settled
    ) VALUES (
      p_business_id, v_payment_id, p_party_id, v_unallocated, 0,
      v_unallocated, false
    );
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Update record_unified_payment RPC
CREATE OR REPLACE FUNCTION record_unified_payment(
  p_business_id UUID,
  p_direction TEXT,
  p_party_id UUID,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_reference_no TEXT,
  p_bank_account_id UUID,
  p_amount NUMERIC(15,2),
  p_remarks TEXT,
  p_allocations JSONB DEFAULT '[]'::JSONB,
  p_applied_notes JSONB DEFAULT '[]'::JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_payment_no TEXT;
  v_allocated_total NUMERIC(15,2) := 0;
  v_notes_applied_total NUMERIC(15,2) := 0;
  v_unallocated NUMERIC(15,2);
  v_alloc RECORD;
  v_note RECORD;
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
  v_seq_no INT;
BEGIN
  -- Calculate total allocated from JSONB
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(billId UUID, allocatedAmount NUMERIC(15,2), billType TEXT) LOOP
    v_allocated_total := v_allocated_total + COALESCE(v_alloc.allocatedAmount, 0);
  END LOOP;

  -- Calculate total credit/debit notes applied from JSONB
  FOR v_note IN SELECT * FROM jsonb_to_recordset(p_applied_notes) AS x(noteId UUID, noteType TEXT, appliedAmount NUMERIC(15,2)) LOOP
    v_notes_applied_total := v_notes_applied_total + COALESCE(v_note.appliedAmount, 0);
  END LOOP;

  -- Cash/Bank payment unallocated portion
  v_unallocated := GREATEST(0, p_amount - v_allocated_total);

  -- Generate payment number
  SELECT COALESCE(MAX(SUBSTRING(payment_number FROM '\d+$')::INT), 0) + 1
  INTO v_seq_no
  FROM payments
  WHERE business_id = p_business_id AND direction = p_direction;

  v_payment_no := CASE WHEN p_direction = 'received' THEN 'REC-' ELSE 'PAY-' END 
                  || TO_CHAR(p_payment_date, 'YYYYMMDD') || '-' 
                  || LPAD(v_seq_no::TEXT, 4, '0');

  -- Insert main payment record
  INSERT INTO payments (
    business_id, payment_number, direction, party_id, payment_date,
    payment_mode, reference_no, bank_account_id, amount, unallocated_amount,
    is_advance, remarks, status, created_by
  ) VALUES (
    p_business_id, v_payment_no, p_direction, p_party_id, p_payment_date,
    p_payment_mode, p_reference_no, p_bank_account_id, p_amount, v_unallocated,
    (v_unallocated > 0), p_remarks, 'completed', p_created_by
  ) RETURNING id INTO v_payment_id;

  -- Update bank account balance for immediate payment modes
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

  -- If payment_mode is cheque or pdc, auto-create cheque entry
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

  -- Process bill allocations & update target bills
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

  -- Create advance payment record if there is unallocated excess
  IF v_unallocated > 0 THEN
    INSERT INTO advance_payments (
      business_id, payment_id, party_id, advance_amount, settled_amount,
      remaining_amount, is_settled
    ) VALUES (
      p_business_id, v_payment_id, p_party_id, v_unallocated, 0,
      v_unallocated, false
    );
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Update process_cheque_status_update RPC to support both RECEIVED and ISSUED cheques
CREATE OR REPLACE FUNCTION process_cheque_status_update(
  p_cheque_id UUID,
  p_business_id UUID,
  p_new_status TEXT,
  p_received_account_id UUID,
  p_remarks TEXT,
  p_deposited_date DATE,
  p_cleared_date DATE,
  p_bounce_reason TEXT,
  p_bounce_charges NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_cheque cheques;
  v_old_status TEXT;
  v_direction TEXT;
  v_amount NUMERIC;
  v_old_account_id UUID;
  v_new_account_id UUID;
BEGIN
  -- 1. Fetch the existing cheque and lock the row to prevent concurrent updates
  SELECT * INTO v_cheque
  FROM cheques
  WHERE id = p_cheque_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found';
  END IF;

  v_old_status := v_cheque.status;
  v_direction := v_cheque.direction;
  v_amount := v_cheque.amount;
  v_old_account_id := v_cheque.received_account_id;
  v_new_account_id := COALESCE(p_received_account_id, v_old_account_id);

  -- 2. Handle bank account balance updates atomically for BOTH received and issued cheques
  IF p_new_status = 'cleared' AND v_old_status <> 'cleared' THEN
    IF v_new_account_id IS NOT NULL THEN
      IF v_direction = 'received' THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) + v_amount, updated_at = NOW()
        WHERE id = v_new_account_id AND business_id = p_business_id;
      ELSIF v_direction = 'issued' THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) - v_amount, updated_at = NOW()
        WHERE id = v_new_account_id AND business_id = p_business_id;
      END IF;
    END IF;
  ELSIF p_new_status <> 'cleared' AND v_old_status = 'cleared' THEN
    IF v_old_account_id IS NOT NULL THEN
      IF v_direction = 'received' THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) - v_amount, updated_at = NOW()
        WHERE id = v_old_account_id AND business_id = p_business_id;
      ELSIF v_direction = 'issued' THEN
        UPDATE bank_accounts
        SET current_balance = COALESCE(current_balance, 0) + v_amount, updated_at = NOW()
        WHERE id = v_old_account_id AND business_id = p_business_id;
      END IF;
    END IF;
  END IF;

  -- 3. Update the cheque fields
  UPDATE cheques
  SET
    status = p_new_status,
    received_account_id = p_received_account_id,
    remarks = p_remarks,
    deposited_date = CASE WHEN p_new_status = 'deposited' THEN COALESCE(p_deposited_date, CURRENT_DATE) ELSE deposited_date END,
    cleared_date = CASE WHEN p_new_status = 'cleared' THEN COALESCE(p_cleared_date, CURRENT_DATE) ELSE cleared_date END,
    bounce_reason = CASE WHEN p_new_status = 'bounced' THEN p_bounce_reason ELSE bounce_reason END,
    bounce_charges = CASE WHEN p_new_status = 'bounced' THEN COALESCE(p_bounce_charges, 0) ELSE bounce_charges END,
    updated_at = NOW()
  WHERE id = p_cheque_id AND business_id = p_business_id
  RETURNING * INTO v_cheque;

  RETURN row_to_json(v_cheque)::jsonb;
END;
$$ LANGUAGE plpgsql;


-- 8. Update delete_cheque RPC to support reversal for both received and issued cheques
CREATE OR REPLACE FUNCTION delete_cheque(
  p_cheque_id UUID,
  p_business_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_cheque cheques;
BEGIN
  -- Fetch and lock the cheque to prevent concurrent updates
  SELECT * INTO v_cheque
  FROM cheques
  WHERE id = p_cheque_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If a cleared cheque is deleted, reverse its balance update
  IF v_cheque.status = 'cleared' AND v_cheque.received_account_id IS NOT NULL THEN
    IF v_cheque.direction = 'received' THEN
      UPDATE bank_accounts
      SET current_balance = COALESCE(current_balance, 0) - v_cheque.amount, updated_at = NOW()
      WHERE id = v_cheque.received_account_id AND business_id = p_business_id;
    ELSIF v_cheque.direction = 'issued' THEN
      UPDATE bank_accounts
      SET current_balance = COALESCE(current_balance, 0) + v_cheque.amount, updated_at = NOW()
      WHERE id = v_cheque.received_account_id AND business_id = p_business_id;
    END IF;
  END IF;

  -- Delete the cheque record
  DELETE FROM cheques
  WHERE id = p_cheque_id AND business_id = p_business_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
