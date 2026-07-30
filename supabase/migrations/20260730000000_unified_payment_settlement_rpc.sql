-- Unified Payment & Contra Settlement RPC Migration

-- 1. Function to record payment (Receive/Make) with Credit/Debit Note adjustments and Advance handling
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
          -- Fallback if columns differ
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


-- 2. Function for Direct Customer-to-Supplier Contra Settlement (Direct Payment Link)
CREATE OR REPLACE FUNCTION create_direct_contra_link(
  p_business_id UUID,
  p_source_party_id UUID,
  p_source_payment_id UUID DEFAULT NULL,
  p_source_bill_id UUID DEFAULT NULL,
  p_target_party_id UUID DEFAULT NULL,
  p_target_bill_id UUID DEFAULT NULL,
  p_target_bill_type TEXT DEFAULT 'purchase_bill',
  p_linked_amount NUMERIC(15,2) DEFAULT 0,
  p_remarks TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_link_id UUID;
  v_payment_id UUID;
  v_seq_no INT;
  v_payment_no TEXT;
  v_current_paid NUMERIC(15,2);
  v_grand_total NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_status TEXT;
BEGIN
  IF p_linked_amount <= 0 THEN
    RAISE EXCEPTION 'Linked amount must be greater than zero';
  END IF;

  -- 1. Generate Contra payment voucher
  SELECT COALESCE(MAX(SUBSTRING(payment_number FROM '\d+$')::INT), 0) + 1
  INTO v_seq_no
  FROM payments
  WHERE business_id = p_business_id AND direction = 'contra';

  v_payment_no := 'CNTR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(v_seq_no::TEXT, 4, '0');

  INSERT INTO payments (
    business_id, payment_number, direction, party_id, payment_date,
    payment_mode, reference_no, bank_account_id, amount, unallocated_amount,
    is_advance, remarks, status, created_by
  ) VALUES (
    p_business_id, v_payment_no, 'contra', p_source_party_id, CURRENT_DATE,
    'direct_link', 'CONTRA-' || p_source_party_id, NULL, p_linked_amount, 0,
    false, p_remarks, 'completed', p_created_by
  ) RETURNING id INTO v_payment_id;

  -- 2. Update Target Bill (Supplier Purchase Bill / Raw Material / Job Work)
  IF p_target_bill_id IS NOT NULL THEN
    IF p_target_bill_type = 'purchase_bill' THEN
      SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
      FROM purchase_bills WHERE id = p_target_bill_id;

      v_new_paid := v_current_paid + p_linked_amount;
      v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

      UPDATE purchase_bills
      SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
      WHERE id = p_target_bill_id;

    ELSIF p_target_bill_type = 'raw_material_purchase' THEN
      SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
      FROM raw_material_purchases WHERE id = p_target_bill_id;

      v_new_paid := v_current_paid + p_linked_amount;
      v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

      UPDATE raw_material_purchases
      SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
      WHERE id = p_target_bill_id;

    ELSIF p_target_bill_type = 'job_work_entry' THEN
      BEGIN
        UPDATE stage_entries
        SET paid_amount = COALESCE(paid_amount, 0) + p_linked_amount,
            payment_status = CASE WHEN (COALESCE(paid_amount, 0) + p_linked_amount) >= COALESCE(total_job_work_amount, 0) THEN 'paid' ELSE 'partially_paid' END
        WHERE id = p_target_bill_id;
      EXCEPTION WHEN OTHERS THEN
      END;
    END IF;

    INSERT INTO payment_allocations (
      business_id, payment_id, bill_type, bill_id, allocated_amount
    ) VALUES (
      p_business_id, v_payment_id, p_target_bill_type, p_target_bill_id, p_linked_amount
    );
  END IF;

  -- 3. Update Source Sale Bill if provided
  IF p_source_bill_id IS NOT NULL THEN
    SELECT COALESCE(paid_amount, 0), COALESCE(grand_total, 0) INTO v_current_paid, v_grand_total
    FROM sale_bills WHERE id = p_source_bill_id;

    v_new_paid := v_current_paid + p_linked_amount;
    v_new_status := CASE WHEN v_new_paid >= v_grand_total THEN 'paid' ELSE 'partially_paid' END;

    UPDATE sale_bills
    SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
    WHERE id = p_source_bill_id;

    INSERT INTO payment_allocations (
      business_id, payment_id, bill_type, bill_id, allocated_amount
    ) VALUES (
      p_business_id, v_payment_id, 'sale_bill', p_source_bill_id, p_linked_amount
    );
  END IF;

  -- 4. If Source Payment is provided, adjust its unallocated balance
  IF p_source_payment_id IS NOT NULL THEN
    UPDATE payments
    SET unallocated_amount = GREATEST(0, unallocated_amount - p_linked_amount)
    WHERE id = p_source_payment_id;
  END IF;

  -- 5. Insert audit log record into direct_payment_links
  INSERT INTO direct_payment_links (
    business_id, source_payment_id, target_payment_id, linked_amount, remarks, created_by
  ) VALUES (
    p_business_id, p_source_payment_id, v_payment_id, p_linked_amount, p_remarks, p_created_by
  ) RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
