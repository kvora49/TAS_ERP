-- A cheque clearing, cancellation, or bounce must not leave a separate payment,
-- bill allocation, advance, debit note, or bank balance behind on failure.
CREATE OR REPLACE FUNCTION public.settle_cheque_atomic(
  p_business_id UUID, p_cheque_id UUID, p_new_status TEXT,
  p_received_account_id UUID DEFAULT NULL, p_deposited_date DATE DEFAULT NULL,
  p_cleared_date DATE DEFAULT NULL, p_bounce_reason TEXT DEFAULT NULL,
  p_bounce_charges NUMERIC DEFAULT 0, p_remarks TEXT DEFAULT NULL,
  p_debit_party BOOLEAN DEFAULT FALSE
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid(); v_cheque cheques; v_payment payments; v_account bank_accounts;
  v_alloc RECORD; v_amount NUMERIC(15,2); v_bill_id UUID; v_bill_type TEXT;
  v_total NUMERIC(15,2) := 0; v_paid NUMERIC(15,2); v_due NUMERIC(15,2); v_new_paid NUMERIC(15,2);
  v_payment_no TEXT; v_sequence INTEGER; v_payment_id UUID; v_debit_note_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.auth_has_business_access(p_business_id) THEN
    RAISE EXCEPTION 'Active company membership is required' USING ERRCODE = '42501';
  END IF;
  IF p_new_status NOT IN ('pending','deposited','cleared','bounced','cancelled') THEN
    RAISE EXCEPTION 'Invalid cheque status' USING ERRCODE = '22023';
  END IF;
  IF p_bounce_charges IS NULL OR p_bounce_charges < 0 OR p_bounce_charges = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Invalid bounce charges' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_cheque FROM cheques WHERE id=p_cheque_id AND business_id=p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cheque not found'; END IF;
  IF v_cheque.status IN ('bounced','cancelled') AND p_new_status <> v_cheque.status THEN
    RAISE EXCEPTION 'Terminal cheque status cannot be changed' USING ERRCODE = '22023';
  END IF;
  IF p_new_status='cleared' AND v_cheque.status NOT IN ('pending','deposited','cleared') THEN
    RAISE EXCEPTION 'Cheque cannot be cleared from its current status' USING ERRCODE = '22023';
  END IF;

  IF (p_new_status='cleared' AND v_cheque.status <> 'cleared') OR (v_cheque.status='cleared' AND p_new_status <> 'cleared') THEN
    SELECT * INTO v_account FROM bank_accounts
    WHERE id=COALESCE(p_received_account_id, v_cheque.received_account_id)
      AND business_id=p_business_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A valid bank account is required for settlement' USING ERRCODE='22023'; END IF;
    IF p_new_status='cleared' AND v_cheque.direction='issued' AND COALESCE(v_account.current_balance,0) < v_cheque.amount THEN
      RAISE EXCEPTION 'Insufficient funds in "%"', COALESCE(v_account.name,'Selected Account') USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_new_status='cleared' AND v_cheque.status <> 'cleared' THEN
    IF jsonb_typeof(COALESCE(v_cheque.allocations, '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'Invalid cheque allocations' USING ERRCODE='22023';
    END IF;
    FOR v_alloc IN SELECT * FROM jsonb_to_recordset(COALESCE(v_cheque.allocations, '[]'::jsonb)) AS x("billId" UUID, "allocatedAmount" NUMERIC, "billType" TEXT, bill_id UUID, allocated_amount NUMERIC, bill_type TEXT) LOOP
      v_amount:=COALESCE(v_alloc."allocatedAmount",v_alloc.allocated_amount); v_bill_id:=COALESCE(v_alloc."billId",v_alloc.bill_id); v_bill_type:=COALESCE(v_alloc."billType",v_alloc.bill_type);
      IF v_amount IS NULL OR v_amount<=0 OR v_bill_id IS NULL OR v_bill_type NOT IN ('sale_bill','purchase_bill','raw_material_purchase','job_work_entry') THEN RAISE EXCEPTION 'Invalid cheque allocation' USING ERRCODE='22023'; END IF;
      v_total:=v_total+v_amount;
    END LOOP;
    IF v_total > v_cheque.amount THEN RAISE EXCEPTION 'Cheque allocations exceed cheque amount' USING ERRCODE='22023'; END IF;

    IF v_cheque.payment_id IS NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || v_cheque.direction, 0));
      SELECT COALESCE(MAX(substring(payment_number FROM '([0-9]+)$')::INTEGER),0)+1 INTO v_sequence FROM payments WHERE business_id=p_business_id AND direction=CASE WHEN v_cheque.direction='received' THEN 'received' ELSE 'paid' END;
      v_payment_no:=CASE WHEN v_cheque.direction='received' THEN 'REC-' ELSE 'PAY-' END || to_char(COALESCE(p_cleared_date,CURRENT_DATE),'YYYYMMDD') || '-' || lpad(v_sequence::text,4,'0');
      INSERT INTO payments (business_id,payment_number,direction,party_id,payment_date,payment_mode,reference_no,bank_account_id,amount,unallocated_amount,is_advance,remarks,status,created_by)
      VALUES (p_business_id,v_payment_no,CASE WHEN v_cheque.direction='received' THEN 'received' ELSE 'paid' END,v_cheque.party_id,COALESCE(p_cleared_date,CURRENT_DATE),'cheque',v_cheque.cheque_number,v_account.id,v_cheque.amount,v_cheque.amount-v_total,v_cheque.amount>v_total,COALESCE(p_remarks,'Cheque settlement'),'completed',v_actor) RETURNING id INTO v_payment_id;

      FOR v_alloc IN SELECT * FROM jsonb_to_recordset(COALESCE(v_cheque.allocations, '[]'::jsonb)) AS x("billId" UUID, "allocatedAmount" NUMERIC, "billType" TEXT, bill_id UUID, allocated_amount NUMERIC, bill_type TEXT) LOOP
        v_amount:=COALESCE(v_alloc."allocatedAmount",v_alloc.allocated_amount); v_bill_id:=COALESCE(v_alloc."billId",v_alloc.bill_id); v_bill_type:=COALESCE(v_alloc."billType",v_alloc.bill_type);
        IF v_bill_type='sale_bill' THEN SELECT COALESCE(paid_amount,0),COALESCE(grand_total,0) INTO v_paid,v_due FROM sale_bills WHERE id=v_bill_id AND business_id=p_business_id FOR UPDATE;
        ELSIF v_bill_type='purchase_bill' THEN SELECT COALESCE(paid_amount,0),COALESCE(grand_total,0) INTO v_paid,v_due FROM purchase_bills WHERE id=v_bill_id AND business_id=p_business_id FOR UPDATE;
        ELSIF v_bill_type='raw_material_purchase' THEN SELECT COALESCE(paid_amount,0),COALESCE(grand_total,0) INTO v_paid,v_due FROM raw_material_purchases WHERE id=v_bill_id AND business_id=p_business_id FOR UPDATE;
        ELSE SELECT COALESCE(paid_amount,0),COALESCE(total_job_work_amount,0) INTO v_paid,v_due FROM stage_entries WHERE id=v_bill_id AND business_id=p_business_id FOR UPDATE; END IF;
        IF NOT FOUND OR v_paid+v_amount>v_due THEN RAISE EXCEPTION 'Cheque allocation exceeds a valid bill outstanding balance' USING ERRCODE='22023'; END IF;
        v_new_paid:=v_paid+v_amount;
        INSERT INTO payment_allocations(business_id,payment_id,bill_type,bill_id,allocated_amount,created_by) VALUES(p_business_id,v_payment_id,v_bill_type,v_bill_id,v_amount,v_actor);
        IF v_bill_type='sale_bill' THEN UPDATE sale_bills SET paid_amount=v_new_paid,payment_status=CASE WHEN v_new_paid=v_due THEN 'paid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_bill_id;
        ELSIF v_bill_type='purchase_bill' THEN UPDATE purchase_bills SET paid_amount=v_new_paid,payment_status=CASE WHEN v_new_paid=v_due THEN 'paid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_bill_id;
        ELSIF v_bill_type='raw_material_purchase' THEN UPDATE raw_material_purchases SET paid_amount=v_new_paid,payment_status=CASE WHEN v_new_paid=v_due THEN 'paid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_bill_id;
        ELSE UPDATE stage_entries SET paid_amount=v_new_paid,payment_status=CASE WHEN v_new_paid=v_due THEN 'paid' ELSE 'partially_paid' END WHERE id=v_bill_id; END IF;
      END LOOP;
      IF v_cheque.amount>v_total AND v_cheque.party_id IS NOT NULL THEN INSERT INTO advance_payments(business_id,payment_id,party_id,advance_amount,settled_amount,remaining_amount,is_settled) VALUES(p_business_id,v_payment_id,v_cheque.party_id,v_cheque.amount-v_total,0,v_cheque.amount-v_total,false); END IF;
    ELSE
      SELECT * INTO v_payment FROM payments WHERE id=v_cheque.payment_id AND business_id=p_business_id FOR UPDATE;
      IF NOT FOUND OR v_payment.status <> 'completed' THEN
        RAISE EXCEPTION 'A reversed cheque cannot be cleared again; issue a new cheque/payment instead' USING ERRCODE='22023';
      END IF;
      v_payment_id:=v_cheque.payment_id;
    END IF;
    UPDATE bank_accounts SET current_balance=COALESCE(current_balance,0)+CASE WHEN v_cheque.direction='received' THEN v_cheque.amount ELSE -v_cheque.amount END,updated_at=NOW() WHERE id=v_account.id;
  ELSIF v_cheque.status='cleared' AND p_new_status <> 'cleared' THEN
    UPDATE bank_accounts SET current_balance=COALESCE(current_balance,0)+CASE WHEN v_cheque.direction='received' THEN -v_cheque.amount ELSE v_cheque.amount END,updated_at=NOW() WHERE id=v_account.id;
    IF v_cheque.payment_id IS NOT NULL THEN
      SELECT * INTO v_payment FROM payments WHERE id=v_cheque.payment_id AND business_id=p_business_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Linked payment not found'; END IF;
      FOR v_alloc IN SELECT bill_type,bill_id,allocated_amount FROM payment_allocations WHERE payment_id=v_payment.id AND business_id=p_business_id LOOP
        IF v_alloc.bill_type='sale_bill' THEN UPDATE sale_bills SET paid_amount=GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount),payment_status=CASE WHEN GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount)=0 THEN 'unpaid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_alloc.bill_id AND business_id=p_business_id;
        ELSIF v_alloc.bill_type='purchase_bill' THEN UPDATE purchase_bills SET paid_amount=GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount),payment_status=CASE WHEN GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount)=0 THEN 'unpaid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_alloc.bill_id AND business_id=p_business_id;
        ELSIF v_alloc.bill_type='raw_material_purchase' THEN UPDATE raw_material_purchases SET paid_amount=GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount),payment_status=CASE WHEN GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount)=0 THEN 'unpaid' ELSE 'partially_paid' END,updated_at=NOW() WHERE id=v_alloc.bill_id AND business_id=p_business_id;
        ELSE UPDATE stage_entries SET paid_amount=GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount),payment_status=CASE WHEN GREATEST(0,COALESCE(paid_amount,0)-v_alloc.allocated_amount)=0 THEN 'unpaid' ELSE 'partially_paid' END WHERE id=v_alloc.bill_id AND business_id=p_business_id; END IF;
      END LOOP;
      UPDATE payments SET status=p_new_status,updated_at=NOW() WHERE id=v_payment.id;
      UPDATE advance_payments SET is_settled=true,remaining_amount=0,updated_at=NOW() WHERE payment_id=v_payment.id AND business_id=p_business_id;
    END IF;
    IF p_new_status='bounced' AND p_debit_party AND p_bounce_charges>0 AND v_cheque.party_id IS NOT NULL AND v_cheque.debit_note_id IS NULL THEN
      INSERT INTO debit_notes(business_id,dn_number,party_id,dn_date,amount,reason) VALUES(p_business_id,'DN-BNC-' || replace(v_cheque.id::text,'-',''),v_cheque.party_id,CURRENT_DATE,p_bounce_charges,'Cheque bounce penalty: ' || v_cheque.cheque_number) RETURNING id INTO v_debit_note_id;
    END IF;
  END IF;
  UPDATE cheques SET status=p_new_status,received_account_id=COALESCE(p_received_account_id,received_account_id),payment_id=COALESCE(v_payment_id,payment_id),deposited_date=CASE WHEN p_new_status='deposited' THEN COALESCE(p_deposited_date,CURRENT_DATE) ELSE deposited_date END,cleared_date=CASE WHEN p_new_status='cleared' THEN COALESCE(p_cleared_date,CURRENT_DATE) ELSE cleared_date END,bounce_reason=CASE WHEN p_new_status='bounced' THEN p_bounce_reason ELSE bounce_reason END,bounce_charges=CASE WHEN p_new_status='bounced' THEN p_bounce_charges ELSE bounce_charges END,remarks=COALESCE(p_remarks,remarks),debit_note_id=COALESCE(v_debit_note_id,debit_note_id),updated_at=NOW() WHERE id=v_cheque.id RETURNING * INTO v_cheque;
  RETURN to_jsonb(v_cheque);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_cheque_atomic(UUID,UUID,TEXT,UUID,DATE,DATE,TEXT,NUMERIC,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_cheque_atomic(UUID,UUID,TEXT,UUID,DATE,DATE,TEXT,NUMERIC,TEXT,BOOLEAN) TO authenticated;
