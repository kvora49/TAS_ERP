-- A production roll reservation changes four inventory facts: the lot mapping,
-- the physical roll balance, the stock ledger and the denormalized stock view.
-- The ledger trigger owns the last of those; this function owns the first three
-- in one transaction and locks both the lot and the affected roll rows.

CREATE OR REPLACE FUNCTION public.fn_allocate_production_rolls(
  p_lot_id UUID,
  p_allocations JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_existing_count INTEGER;
  v_requested_count INTEGER;
  v_allocation JSONB;
  v_roll_id UUID;
  v_colour_id UUID;
  v_meters NUMERIC;
  v_roll RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one roll allocation is required';
  END IF;

  SELECT business_id INTO v_business_id
  FROM public.production_lots
  WHERE id = p_lot_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production lot not found';
  END IF;

  SELECT COUNT(*) INTO v_requested_count FROM jsonb_array_elements(p_allocations);
  IF v_requested_count <> (
    SELECT COUNT(DISTINCT (value->>'purchase_roll_id')) FROM jsonb_array_elements(p_allocations)
  ) THEN
    RAISE EXCEPTION 'A roll can only be allocated once per lot request';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.lot_rolls
  WHERE lot_id = p_lot_id AND business_id = v_business_id;
  IF v_existing_count > 0 THEN
    IF v_existing_count = v_requested_count THEN
      -- A completed request retry is intentionally a no-op.
      RETURN;
    END IF;
    RAISE EXCEPTION 'Roll allocations already exist for this lot';
  END IF;

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations) LOOP
    BEGIN
      v_roll_id := (v_allocation->>'purchase_roll_id')::UUID;
      v_colour_id := NULLIF(v_allocation->>'colour_id', '')::UUID;
      v_meters := (v_allocation->>'allocated_meters')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid roll allocation identifier or quantity';
    END;

    IF v_roll_id IS NULL OR v_meters IS NULL OR v_meters <= 0 OR v_meters = 'NaN'::NUMERIC THEN
      RAISE EXCEPTION 'Allocated meters must be a positive finite quantity';
    END IF;

    SELECT r.id, r.remaining_meters, r.purchase_item_id,
           i.material_type_id, i.rate, p.godown_id
      INTO v_roll
      FROM public.purchase_rolls r
      JOIN public.raw_material_purchase_items i ON i.id = r.purchase_item_id
      JOIN public.raw_material_purchases p ON p.id = i.purchase_id
     WHERE r.id = v_roll_id AND r.business_id = v_business_id
     FOR UPDATE OF r;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Roll % is unavailable for this business', v_roll_id;
    END IF;
    IF COALESCE(v_roll.remaining_meters, 0) < v_meters THEN
      RAISE EXCEPTION 'Insufficient remaining meters for roll %', v_roll_id;
    END IF;

    INSERT INTO public.lot_rolls (business_id, lot_id, purchase_roll_id, colour_id, allocated_meters)
    VALUES (v_business_id, p_lot_id, v_roll_id, v_colour_id, v_meters);

    UPDATE public.purchase_rolls
       SET remaining_meters = remaining_meters - v_meters
     WHERE id = v_roll_id;

    INSERT INTO public.stock_ledger (
      business_id, item_type, item_id, godown_id, transaction_type,
      quantity_delta, value_delta, reference_table, reference_id, created_by
    ) VALUES (
      v_business_id, 'raw_material', v_roll.material_type_id, v_roll.godown_id,
      'production_lot_allocation', -v_meters, -(v_meters * COALESCE(v_roll.rate, 0)),
      'production_lots', p_lot_id, auth.uid()
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_allocate_production_rolls(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_allocate_production_rolls(UUID, JSONB) TO authenticated;
