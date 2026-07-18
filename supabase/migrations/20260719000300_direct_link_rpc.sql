-- Atomic function to record a direct payment link between a source receipt and a target payment
CREATE OR REPLACE FUNCTION create_direct_payment_link(
  p_business_id UUID,
  p_source_payment_id UUID,
  p_target_payment_id UUID,
  p_linked_amount NUMERIC(15,2),
  p_remarks TEXT,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_link_id UUID;
  v_source_unallocated NUMERIC(15,2);
  v_target_unallocated NUMERIC(15,2);
BEGIN
  -- 1. Verify source payment has enough remaining unallocated amount
  SELECT unallocated_amount INTO v_source_unallocated
  FROM payments
  WHERE id = p_source_payment_id AND business_id = p_business_id;

  IF v_source_unallocated IS NULL THEN
    RAISE EXCEPTION 'Source payment not found';
  END IF;

  IF p_linked_amount > v_source_unallocated THEN
    RAISE EXCEPTION 'Linked amount exceeds available source unallocated balance';
  END IF;

  -- 2. Insert link record
  INSERT INTO direct_payment_links (
    business_id, source_payment_id, target_payment_id, linked_amount, remarks, created_by
  ) VALUES (
    p_business_id, p_source_payment_id, p_target_payment_id, p_linked_amount, p_remarks, p_created_by
  ) RETURNING id INTO v_link_id;

  -- 3. Adjust source payment unallocated amount
  UPDATE payments
  SET unallocated_amount = unallocated_amount - p_linked_amount
  WHERE id = p_source_payment_id;

  -- 4. Adjust target payment unallocated amount (since it is now funded by this source link)
  UPDATE payments
  SET unallocated_amount = unallocated_amount - p_linked_amount
  WHERE id = p_target_payment_id;

  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
