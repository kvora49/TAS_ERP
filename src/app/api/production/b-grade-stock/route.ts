import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/production/b-grade-stock
// Lists B-grade stock with aggregated stats, filters by design, godown, status
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("design_id");
  const godownId = searchParams.get("godown_id");
  const status = searchParams.get("status") || "available";
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("b_grade_stock")
      .select(`
        *,
        design:designs (id, name, design_number),
        colour:design_colours (id, colour_name, colour_hex),
        godown:godowns (id, name),
        lot:production_lots (id, lot_number, lot_name),
        resolution:defect_resolutions (
          id,
          resolution_date,
          waste_reason,
          rework_cost,
          defect:lot_defects (id, defect_number, defect_category, description)
        )
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (designId) query = query.eq("design_id", designId);
    if (godownId) query = query.eq("godown_id", godownId);
    if (status && status !== "all") query = query.eq("status", status);

    const { data: stockEntries, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filtered = stockEntries || [];
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((row: any) => {
        const designName = (row.design?.name || "").toLowerCase();
        const designNo = (row.design?.design_number || "").toLowerCase();
        const godownName = (row.godown?.name || "").toLowerCase();
        const lotNo = (row.lot?.lot_number || "").toLowerCase();
        const defectCat = (row.resolution?.defect?.defect_category || "").toLowerCase();
        return (
          designName.includes(term) ||
          designNo.includes(term) ||
          godownName.includes(term) ||
          lotNo.includes(term) ||
          defectCat.includes(term)
        );
      });
    }

    // Calculate aggregated statistics
    let totalQty = 0;
    let totalVal = 0;
    const godownsMap: Record<string, { godown_name: string; quantity: number; value: number }> = {};
    const designsMap: Record<string, { design_id: string; design_code: string; design_name: string; quantity: number; value: number; colours: string[] }> = {};
    const sizesMap: Record<string, number> = {};

    filtered.forEach((row: any) => {
      const q = Number(row.total_quantity || 0);
      const v = Number(row.total_value || 0);
      totalQty += q;
      totalVal += v;

      if (row.godown?.name) {
        const gName = row.godown.name;
        if (!godownsMap[gName]) {
          godownsMap[gName] = { godown_name: gName, quantity: 0, value: 0 };
        }
        godownsMap[gName].quantity += q;
        godownsMap[gName].value += v;
      }

      if (row.design_id && row.design) {
        const dId = row.design_id;
        if (!designsMap[dId]) {
          designsMap[dId] = {
            design_id: dId,
            design_code: row.design.design_number || "N/A",
            design_name: row.design.name || "Unknown",
            quantity: 0,
            value: 0,
            colours: [],
          };
        }
        designsMap[dId].quantity += q;
        designsMap[dId].value += v;
        if (row.colour?.colour_hex && !designsMap[dId].colours.includes(row.colour.colour_hex)) {
          designsMap[dId].colours.push(row.colour.colour_hex);
        }
      }

      if (row.size_quantities && typeof row.size_quantities === "object") {
        Object.entries(row.size_quantities).forEach(([sz, qty]) => {
          sizesMap[sz] = (sizesMap[sz] || 0) + Number(qty || 0);
        });
      }
    });

    const stats = {
      total_quantity: totalQty,
      total_value: totalVal,
      unique_designs: Object.keys(designsMap).length,
      active_godowns: Object.keys(godownsMap).length,
      godown_breakdown: Object.values(godownsMap),
      design_breakdown: Object.values(designsMap),
      size_breakdown: Object.entries(sizesMap).map(([size, quantity]) => ({ size, quantity })),
    };

    return NextResponse.json({
      stock: filtered,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/production/b-grade-stock
// Update sale price, status, notes on a B-grade stock record
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, b_grade_sale_price, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "B-grade stock ID is required." }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("b_grade_stock")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "B-grade stock record not found." }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (b_grade_sale_price !== undefined) updates.b_grade_sale_price = Number(b_grade_sale_price);
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;

    const { data: updated, error: updateErr } = await supabase
      .from("b_grade_stock")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    await logAudit(businessId, "update", "b_grade_stock", id, updated, existing, request);

    return NextResponse.json({ stock: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
