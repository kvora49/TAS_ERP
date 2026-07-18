-- Migration: 20260717000001_cheques_atomic_balance.sql
-- Description: Create atomic PL/pgSQL database functions for cheque status transition and deletion to prevent lost-update race conditions and ensure correct bank balance reversals.

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

  -- 2. Handle bank account balance updates atomically
  IF p_new_status = 'cleared' AND v_old_status <> 'cleared' THEN
    IF v_direction = 'received' AND v_new_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance + v_amount
      WHERE id = v_new_account_id AND business_id = p_business_id;
    END IF;
  ELSIF p_new_status <> 'cleared' AND v_old_status = 'cleared' THEN
    IF v_direction = 'received' AND v_old_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance - v_amount
      WHERE id = v_old_account_id AND business_id = p_business_id;
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

  -- If a cleared received cheque is deleted, reverse its balance update
  IF v_cheque.status = 'cleared' AND v_cheque.direction = 'received' AND v_cheque.received_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = current_balance - v_cheque.amount
    WHERE id = v_cheque.received_account_id AND business_id = p_business_id;
  END IF;

  -- Delete the cheque record
  DELETE FROM cheques
  WHERE id = p_cheque_id AND business_id = p_business_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
