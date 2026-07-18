-- Migration: 20260717000002_atomic_code_generation.sql
-- Description: Implement database-level atomic sequential-code generation using a counters table and triggers to eliminate HTTP-level two-trip race conditions.

CREATE TABLE IF NOT EXISTS code_counters (
  business_id UUID NOT NULL,
  code_type TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, code_type)
);

ALTER TABLE code_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'code_counters' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON code_counters
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_next_code_number(p_business_id UUID, p_code_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_next_val INTEGER;
BEGIN
  INSERT INTO code_counters (business_id, code_type, last_value)
  VALUES (p_business_id, p_code_type, 1)
  ON CONFLICT (business_id, code_type)
  DO UPDATE SET last_value = code_counters.last_value + 1
  RETURNING last_value INTO v_next_val;
  
  RETURN v_next_val;
END;
$$ LANGUAGE plpgsql;

-- 1. Parties code trigger
CREATE OR REPLACE FUNCTION tr_fn_assign_party_code()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_next_num INTEGER;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' OR NEW.code LIKE 'SUP-%' OR NEW.code LIKE 'CUS-%' OR NEW.code LIKE 'WRK-%' OR NEW.code LIKE 'JW-%' OR NEW.code LIKE 'PW-%' OR NEW.code LIKE 'PRT-%' THEN
    IF 'worker' = ANY(NEW.type) THEN
      IF NEW.worker_type = 'permanent' THEN
        v_prefix := 'PW';
      ELSE
        v_prefix := 'JW';
      END IF;
    ELSIF 'supplier' = ANY(NEW.type) THEN
      v_prefix := 'SUP';
    ELSIF 'customer' = ANY(NEW.type) THEN
      v_prefix := 'CUS';
    ELSE
      v_prefix := 'PRT';
    END IF;

    v_next_num := get_next_code_number(NEW.business_id, v_prefix);
    NEW.code := v_prefix || '-' || LPAD(v_next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_party_code ON parties;
CREATE TRIGGER tr_assign_party_code
BEFORE INSERT ON parties
FOR EACH ROW
EXECUTE FUNCTION tr_fn_assign_party_code();

-- 2. Production Lots code trigger
CREATE OR REPLACE FUNCTION tr_fn_assign_lot_number()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_yy TEXT;
  v_mm TEXT;
  v_next_num INTEGER;
BEGIN
  IF NEW.lot_number IS NULL OR NEW.lot_number = '' OR NEW.lot_number LIKE 'LOT-%' THEN
    v_yy := to_char(CURRENT_DATE, 'YY');
    v_mm := to_char(CURRENT_DATE, 'MM');
    v_prefix := 'LOT-' || v_yy || '-' || v_mm;

    v_next_num := get_next_code_number(NEW.business_id, v_prefix);
    NEW.lot_number := v_prefix || '-' || LPAD(v_next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_lot_number ON production_lots;
CREATE TRIGGER tr_assign_lot_number
BEFORE INSERT ON production_lots
FOR EACH ROW
EXECUTE FUNCTION tr_fn_assign_lot_number();

-- 3. Stock Adjustments code trigger
CREATE OR REPLACE FUNCTION tr_fn_assign_adjustment_number()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_next_num INTEGER;
BEGIN
  IF NEW.adjustment_number IS NULL OR NEW.adjustment_number = '' OR NEW.adjustment_number LIKE 'ADJ-%' THEN
    v_year := to_char(COALESCE(NEW.adjustment_date, CURRENT_DATE), 'YYYY');
    v_prefix := 'ADJ-' || v_year;

    v_next_num := get_next_code_number(NEW.business_id, v_prefix);
    NEW.adjustment_number := v_prefix || '-' || LPAD(v_next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_adjustment_number ON stock_adjustments;
CREATE TRIGGER tr_assign_adjustment_number
BEFORE INSERT ON stock_adjustments
FOR EACH ROW
EXECUTE FUNCTION tr_fn_assign_adjustment_number();
