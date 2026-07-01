-- 1. Finished stock ledger table (keeps chronological stock entry logs)
CREATE TABLE IF NOT EXISTS finished_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size_set_id UUID REFERENCES size_sets(id),
  lot_id UUID REFERENCES production_lots(id),
  godown_id UUID NOT NULL REFERENCES godowns(id),
  entry_type TEXT DEFAULT 'production' CHECK (entry_type IN ('production','manual','adjustment','transfer_in','transfer_out','challan_in','challan_out')),
  size_quantities JSONB NOT NULL DEFAULT '{}', -- {S:200,M:300,L:300,XL:200,XXL:200}
  total_quantity INTEGER NOT NULL DEFAULT 0,
  cost_per_piece NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE finished_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'finished_stock' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON finished_stock
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_finished_stock_updated_at ON finished_stock;
CREATE TRIGGER tr_finished_stock_updated_at BEFORE UPDATE ON finished_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2. Stock adjustments (individual garment piece correction, damage, scrap, or samples)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  adjustment_number TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('damage','sample','scrap','correction','other')),
  adjustment_date DATE NOT NULL,
  godown_id UUID NOT NULL REFERENCES godowns(id),
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity_change INTEGER NOT NULL, -- negative=reduce, positive=add
  unit_cost NUMERIC(12,2) NOT NULL,
  value_impact NUMERIC(15,2) NOT NULL,
  reason TEXT NOT NULL, -- Free TEXT to avoid DB-level check constraints on vocabulary
  remarks TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, adjustment_number)
);
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_adjustments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_adjustments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_stock_adjustments_updated_at ON stock_adjustments;
CREATE TRIGGER tr_stock_adjustments_updated_at BEFORE UPDATE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3. Stock transfers (moves stock between godowns)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  from_godown_id UUID NOT NULL REFERENCES godowns(id),
  to_godown_id UUID NOT NULL REFERENCES godowns(id) CHECK (from_godown_id <> to_godown_id),
  reference_no TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('Stock Rebalancing','Sales Order','Godown Consolidation','Other')),
  remarks TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, transfer_number)
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_transfers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_transfers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_stock_transfers_updated_at ON stock_transfers;
CREATE TRIGGER tr_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4. Stock transfer items (individual items transferred)
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_transfer_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_transfer_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;


-- 5. Challans (Inward and outward stock transit documents to third parties)
CREATE TABLE IF NOT EXISTS challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  challan_number TEXT NOT NULL,
  challan_date DATE NOT NULL,
  challan_type TEXT NOT NULL CHECK (challan_type IN ('inward','outward')),
  from_godown_id UUID NOT NULL REFERENCES godowns(id),
  to_party_id UUID NOT NULL REFERENCES parties(id),
  reference_no TEXT,
  remarks TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','dispatched','received','completed','cancelled')),
  transporter TEXT,
  lr_awb_no TEXT,
  dispatched_by UUID REFERENCES users(id),
  eway_bill_no TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, challan_number)
);
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challans' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON challans
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_challans_updated_at ON challans;
CREATE TRIGGER tr_challans_updated_at BEFORE UPDATE ON challans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 6. Challan items (individual items added to a challan)
CREATE TABLE IF NOT EXISTS challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  challan_id UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE challan_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challan_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON challan_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;


-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_finished_stock_design_colour ON finished_stock (business_id, design_id, colour_id);
CREATE INDEX IF NOT EXISTS idx_finished_stock_godown ON finished_stock (business_id, godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_filter ON stock_adjustments (business_id, adjustment_date);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_filter ON stock_transfers (business_id, transfer_date);
CREATE INDEX IF NOT EXISTS idx_challans_filter ON challans (business_id, challan_date);


-- SQL RPC Function for optimized performance of dashboard stats
CREATE OR REPLACE FUNCTION get_finished_stock_stats(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_stock BIGINT;
  v_total_designs BIGINT;
  v_total_colours BIGINT;
  v_total_sizes BIGINT;
  v_total_value NUMERIC(15,2);
  v_active_godowns BIGINT;
  v_godown_breakdown JSONB;
  v_size_breakdown JSONB;
  v_top_designs JSONB;
  v_result JSONB;
BEGIN
  -- 1. Base aggregations
  SELECT 
    COALESCE(SUM(total_quantity), 0),
    COALESCE(SUM(total_value), 0)
  INTO v_total_stock, v_total_value
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- 2. Counts
  SELECT COUNT(DISTINCT design_id) INTO v_total_designs
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT colour_id) INTO v_total_colours
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT godown_id) INTO v_active_godowns
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- Sizes count
  SELECT COUNT(DISTINCT size_key) INTO v_total_sizes
  FROM finished_stock f,
  LATERAL jsonb_object_keys(f.size_quantities) AS size_key
  WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    AND (f.size_quantities->>size_key)::integer <> 0;

  -- 3. Godown breakdown (donut chart)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_godown_breakdown
  FROM (
    SELECT 
      g.name AS godown_name,
      SUM(f.total_quantity) AS quantity,
      COALESCE(SUM(f.total_value), 0) AS value
    FROM finished_stock f
    JOIN godowns g ON f.godown_id = g.id
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY g.name
    ORDER BY quantity DESC
  ) t;

  -- 4. Size breakdown (bar chart)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_size_breakdown
  FROM (
    SELECT 
      size_key AS size,
      SUM((f.size_quantities->>size_key)::integer) AS quantity
    FROM finished_stock f,
    LATERAL jsonb_object_keys(f.size_quantities) AS size_key
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY size_key
    ORDER BY 
      CASE size_key
        WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
        WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN 'XXXL' THEN 7 ELSE 8
      END
  ) t;

  -- 5. Top 10 designs table
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_designs
  FROM (
    SELECT 
      d.id AS design_id,
      d.code AS design_code,
      d.name AS design_name,
      SUM(f.total_quantity) AS total_quantity,
      COALESCE(SUM(f.total_value), 0) AS total_value,
      (
        SELECT jsonb_agg(DISTINCT c2.colour_hex) 
        FROM finished_stock f2
        JOIN design_colours c2 ON f2.colour_id = c2.id
        WHERE f2.design_id = d.id AND f2.business_id = p_business_id AND f2.deleted_at IS NULL
      ) AS colours,
      (
        SELECT jsonb_agg(DISTINCT size_key) 
        FROM finished_stock f2,
        LATERAL jsonb_object_keys(f2.size_quantities) AS size_key
        WHERE f2.design_id = d.id AND f2.business_id = p_business_id AND f2.deleted_at IS NULL
      ) AS sizes,
      COUNT(DISTINCT f.godown_id) AS godown_count,
      MAX(g.name) AS godown_name
    FROM finished_stock f
    JOIN designs d ON f.design_id = d.id
    JOIN godowns g ON f.godown_id = g.id
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY d.id, d.code, d.name
    ORDER BY total_quantity DESC
    LIMIT 10
  ) t;

  -- 6. Combine results
  v_result := jsonb_build_object(
    'total_stock', v_total_stock,
    'total_designs', v_total_designs,
    'total_colours', v_total_colours,
    'total_sizes', v_total_sizes,
    'total_value', v_total_value,
    'active_godowns', v_active_godowns,
    'godown_breakdown', v_godown_breakdown,
    'size_breakdown', v_size_breakdown,
    'top_designs', v_top_designs
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
