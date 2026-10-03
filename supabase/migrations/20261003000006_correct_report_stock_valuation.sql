-- =============================================================================
-- Migration: 20260928000006_rpc_fn_report_stock_valuation.sql
-- Description: PostgreSQL RPC function for /api/reports/stock-valuation.
-- Replaces multiple table queries and in-memory JavaScript mappings,
-- unit cost defaults, and array reductions with a single database-level CTE calculation.
-- STABLE read-only computation reduces edge/serverless CPU; it does not cache results.
-- =============================================================================

-- Replaces route-level raw-row fetch/group/sum/reduce work with PostgreSQL aggregation
-- to reduce application CPU and transferred intermediate rows for edge/serverless compatibility.
-- Read-only STABLE SECURITY INVOKER preserves caller RLS.
CREATE OR REPLACE FUNCTION public.fn_report_stock_valuation(
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_total_rm_value numeric := 0;
  v_total_fg_value numeric := 0;
  v_total_value numeric := 0;
  v_result jsonb;
BEGIN
  WITH rm_items AS (
    SELECT
      rm.id::text AS id,
      COALESCE(rmt.name, 'Unknown RM') AS name,
      COALESCE(rmt.unit, 'Pcs') AS unit,
      ROUND(COALESCE(rm.current_stock, 0), 2) AS quantity,
      ROUND(COALESCE(rm.unit_cost, 0), 2) AS unit_cost,
      ROUND(
        CASE
          WHEN COALESCE(rm.stock_value, 0) > 0 THEN rm.stock_value
          ELSE COALESCE(rm.current_stock, 0) * COALESCE(rm.unit_cost, 0)
        END,
        2
      ) AS total_value,
      'Raw Material'::text AS category,
      1 AS sort_order
    FROM public.raw_material_current_stock rm
    LEFT JOIN public.raw_material_types rmt ON rmt.id = rm.material_type_id
    WHERE rm.business_id = p_business_id
  ),
  fg_items AS (
    SELECT
      fg.id::text AS id,
      COALESCE(d.name, 'Unknown FG') AS name,
      'Pcs'::text AS unit,
      ROUND(COALESCE(fg.total_quantity, 0), 2) AS quantity,
      ROUND(
        CASE
          WHEN COALESCE(fg.cost_per_piece, 0) > 0 THEN fg.cost_per_piece
          ELSE 0
        END,
        2
      ) AS unit_cost,
      ROUND(
        CASE
          WHEN COALESCE(fg.total_value, 0) > 0 THEN fg.total_value
          ELSE COALESCE(fg.total_quantity, 0) * (
            CASE
              WHEN COALESCE(fg.cost_per_piece, 0) > 0 THEN fg.cost_per_piece
              ELSE 0
            END
          )
        END,
        2
      ) AS total_value,
      'Finished Goods'::text AS category,
      2 AS sort_order
    FROM public.finished_stock fg
    LEFT JOIN public.designs d ON d.id = fg.design_id AND d.business_id = p_business_id
    WHERE fg.business_id = p_business_id
      AND fg.deleted_at IS NULL
  ),
  combined_items AS (
    SELECT * FROM rm_items
    UNION ALL
    SELECT * FROM fg_items
  )
  SELECT
    COALESCE(SUM(CASE WHEN category = 'Raw Material' THEN total_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Finished Goods' THEN total_value ELSE 0 END), 0),
    COALESCE(SUM(total_value), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ci.id,
          'name', ci.name,
          'unit', ci.unit,
          'quantity', ci.quantity,
          'unit_cost', ci.unit_cost,
          'total_value', ci.total_value,
          'category', ci.category
        )
        ORDER BY ci.sort_order ASC, ci.name ASC
      ),
      '[]'::jsonb
    )
  INTO v_total_rm_value, v_total_fg_value, v_total_value, v_items
  FROM combined_items ci;

  v_result := jsonb_build_object(
    'items', v_items,
    'totalValue', ROUND(v_total_value, 2),
    'totalRMValue', ROUND(v_total_rm_value, 2),
    'totalFGValue', ROUND(v_total_fg_value, 2),
    'asOf', CURRENT_DATE::text
  );

  RETURN v_result;
END;
$$;
