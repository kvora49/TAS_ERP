-- Migration: Performance indexes and atomic sales bill update function

-- 1. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sale_bills_business_id ON sale_bills(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_bills_party_id ON sale_bills(party_id);
CREATE INDEX IF NOT EXISTS idx_sale_bills_bill_type ON sale_bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_sale_bills_payment_status ON sale_bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_bills_bill_date ON sale_bills(bill_date);

CREATE INDEX IF NOT EXISTS idx_sale_bill_items_bill_id ON sale_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_sale_bill_items_business_id ON sale_bill_items(business_id);

CREATE INDEX IF NOT EXISTS idx_production_lots_business_id ON production_lots(business_id);
CREATE INDEX IF NOT EXISTS idx_production_lots_brand_id ON production_lots(brand_id);
CREATE INDEX IF NOT EXISTS idx_production_lots_design_id ON production_lots(design_id);
CREATE INDEX IF NOT EXISTS idx_production_lots_status ON production_lots(status);

CREATE INDEX IF NOT EXISTS idx_cheques_business_id ON cheques(business_id);
CREATE INDEX IF NOT EXISTS idx_cheques_party_id ON cheques(party_id);
CREATE INDEX IF NOT EXISTS idx_cheques_status ON cheques(status);

-- 2. Atomic Sales Bill Update function
CREATE OR REPLACE FUNCTION update_sales_bill_atomic(
  p_bill_id UUID,
  p_business_id UUID,
  p_bill_data JSONB,
  p_items JSONB,
  p_charges JSONB
) RETURNS VOID AS $$
DECLARE
  item_record RECORD;
  charge_record RECORD;
  v_user_business_id UUID;
BEGIN
  -- Multi-tenant validation
  SELECT business_id INTO v_user_business_id FROM users WHERE id = auth.uid();
  IF p_business_id IS NULL OR v_user_business_id IS NULL OR p_business_id <> v_user_business_id THEN
    RAISE EXCEPTION 'Unauthorized: Multi-tenant boundary violation';
  END IF;

  -- 1. Update sale_bills parent row
  UPDATE sale_bills
  SET
    bill_date = (p_bill_data->>'bill_date')::DATE,
    due_date = (p_bill_data->>'due_date')::DATE,
    payment_terms = p_bill_data->>'payment_terms',
    reference_no = p_bill_data->>'reference_no',
    billing_address = p_bill_data->>'billing_address',
    phone = p_bill_data->>'phone',
    gstin = p_bill_data->>'gstin',
    gst_treatment = p_bill_data->>'gst_treatment',
    transporter_name = p_bill_data->>'transporter_name',
    vehicle_no = p_bill_data->>'vehicle_no',
    salesman = p_bill_data->>'salesman',
    remarks = p_bill_data->>'remarks',
    item_total = (p_bill_data->>'item_total')::NUMERIC,
    charges_total = (p_bill_data->>'charges_total')::NUMERIC,
    sub_total = (p_bill_data->>'sub_total')::NUMERIC,
    discount_type = p_bill_data->>'discount_type',
    discount_value = (p_bill_data->>'discount_value')::NUMERIC,
    discount_amount = (p_bill_data->>'discount_amount')::NUMERIC,
    taxable_amount = (p_bill_data->>'taxable_amount')::NUMERIC,
    cgst = (p_bill_data->>'cgst')::NUMERIC,
    sgst = (p_bill_data->>'sgst')::NUMERIC,
    igst = (p_bill_data->>'igst')::NUMERIC,
    round_off = (p_bill_data->>'round_off')::NUMERIC,
    grand_total = (p_bill_data->>'grand_total')::NUMERIC,
    amount_in_words = p_bill_data->>'amount_in_words',
    generate_eway_bill = COALESCE((p_bill_data->>'generate_eway_bill')::BOOLEAN, false),
    eway_transporter = p_bill_data->>'eway_transporter',
    eway_vehicle_no = p_bill_data->>'eway_vehicle_no',
    eway_place_of_supply = p_bill_data->>'eway_place_of_supply',
    eway_valid_till = (p_bill_data->>'eway_valid_till')::TIMESTAMPTZ,
    status = p_bill_data->>'status',
    updated_at = NOW()
  WHERE id = p_bill_id AND business_id = p_business_id;

  -- 2. Delete all existing items
  DELETE FROM sale_bill_items WHERE bill_id = p_bill_id AND business_id = p_business_id;

  -- 3. Insert new items
  FOR item_record IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    design_id UUID,
    colour_id UUID,
    size TEXT,
    brand_id UUID,
    hsn_sac TEXT,
    quantity NUMERIC,
    unit TEXT,
    rate NUMERIC,
    discount_percent NUMERIC,
    tax_percent NUMERIC,
    amount NUMERIC,
    cost_per_piece NUMERIC,
    description TEXT
  ) LOOP
    INSERT INTO sale_bill_items (
      business_id, bill_id, design_id, colour_id, size, brand_id, hsn_sac,
      quantity, unit, rate, discount_percent, tax_percent, amount, cost_per_piece, description
    ) VALUES (
      p_business_id, p_bill_id, item_record.design_id, item_record.colour_id, item_record.size,
      item_record.brand_id, item_record.hsn_sac, item_record.quantity, COALESCE(item_record.unit, 'Pcs'),
      item_record.rate, COALESCE(item_record.discount_percent, 0), COALESCE(item_record.tax_percent, 0),
      item_record.amount, item_record.cost_per_piece, item_record.description
    );
  END LOOP;

  -- 4. Delete all existing charges
  DELETE FROM sale_bill_charges WHERE bill_id = p_bill_id AND business_id = p_business_id;

  -- 5. Insert new charges
  IF p_charges IS NOT NULL AND jsonb_array_length(p_charges) > 0 THEN
    FOR charge_record IN SELECT * FROM jsonb_to_recordset(p_charges) AS x(
      charge_name TEXT,
      charge_type TEXT,
      is_taxable BOOLEAN,
      amount NUMERIC
    ) LOOP
      INSERT INTO sale_bill_charges (
        business_id, bill_id, charge_name, charge_type, is_taxable, amount
      ) VALUES (
        p_business_id, p_bill_id, charge_record.charge_name, COALESCE(charge_record.charge_type, 'flat'),
        COALESCE(charge_record.is_taxable, false), charge_record.amount
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
