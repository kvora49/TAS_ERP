import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// GET /api/production/b-grade-stock/sell — list available b_grade_stock for sale
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("design_id");
  const godownId = searchParams.get("godown_id");

  try {
    let query = supabase
      .from("b_grade_stock")
      .select(`
        *,
        design:designs (id, name, design_number),
        colour:design_colours (id, colour_name, colour_hex),
        godown:godowns (id, name),
        lot:production_lots (id, lot_number, lot_name)
      `)
      .eq("business_id", businessId)
      .eq("status", "available")
      .is("deleted_at", null)
      .gt("total_quantity", 0)
      .order("created_at", { ascending: false });

    if (designId) query = query.eq("design_id", designId);
    if (godownId) query = query.eq("godown_id", godownId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ stock: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}

// POST /api/production/b-grade-stock/sell
// Body: { b_grade_stock_id, qty_sold, sale_rate, party_id?, size_quantities?, remarks? }
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { b_grade_stock_id, qty_sold, sale_rate, party_id, size_quantities, remarks } = body;

    if (!b_grade_stock_id || !qty_sold || sale_rate === undefined) {
      return NextResponse.json(
        { error: "b_grade_stock_id, qty_sold, and sale_rate are required." },
        { status: 400 }
      );
    }

    const qtySold = Number(qty_sold);
    const saleRate = Number(sale_rate);

    if (qtySold <= 0) return NextResponse.json({ error: "qty_sold must be > 0." }, { status: 400 });
    if (saleRate < 0) return NextResponse.json({ error: "sale_rate cannot be negative." }, { status: 400 });

    // Fetch b_grade_stock entry (multi-tenant check)
    const { data: bgStock, error: fetchErr } = await supabase
      .from("b_grade_stock")
      .select("*, design:designs(id, name), godown:godowns(id, name)")
      .eq("id", b_grade_stock_id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !bgStock) {
      return NextResponse.json({ error: "B-grade stock record not found." }, { status: 404 });
    }

    if (bgStock.status !== "available") {
      return NextResponse.json(
        { error: `B-grade stock status is '${bgStock.status}' — only 'available' stock can be sold.` },
        { status: 400 }
      );
    }

    if (qtySold > Number(bgStock.total_quantity)) {
      return NextResponse.json(
        { error: `Insufficient B-grade stock. Available: ${bgStock.total_quantity}, requested: ${qtySold}.` },
        { status: 400 }
      );
    }

    // Validate per-size quantities if provided
    if (size_quantities && typeof size_quantities === "object") {
      const sizeTotal = Object.values(size_quantities as Record<string, number>)
        .reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
      if (sizeTotal !== qtySold) {
        return NextResponse.json(
          { error: `Size quantities total (${sizeTotal}) must equal qty_sold (${qtySold}).` },
          { status: 400 }
        );
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const saleValue = qtySold * saleRate;
    const newQty = Number(bgStock.total_quantity) - qtySold;
    const newValue = newQty * Number(bgStock.cost_per_piece || 0);
    const newStatus = newQty <= 0 ? "sold" : "available";

    // Compute updated size_quantities
    let updatedSizeQty = { ...(bgStock.size_quantities || {}) } as Record<string, number>;
    if (size_quantities && typeof size_quantities === "object") {
      for (const [sz, q] of Object.entries(size_quantities as Record<string, number>)) {
        updatedSizeQty[sz] = Math.max(0, (updatedSizeQty[sz] || 0) - Number(q));
      }
    }

    // Deduct from b_grade_stock
    await supabase
      .from("b_grade_stock")
      .update({
        total_quantity: newQty,
        total_value: newValue,
        size_quantities: updatedSizeQty,
        status: newStatus,
        b_grade_sale_price: saleRate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", b_grade_stock_id);

    // Stock ledger outflow entry
    await supabase.from("stock_ledger").insert({
      business_id: businessId,
      item_type: "finished_good",
      item_id: bgStock.design_id,
      godown_id: bgStock.godown_id,
      transaction_type: "b_grade_sale",
      quantity_delta: -qtySold,
      value_delta: -saleValue,
      reference_table: "b_grade_stock",
      reference_id: b_grade_stock_id,
      created_by: userId,
    });

    const result = {
      b_grade_stock_id,
      design: bgStock.design,
      godown: bgStock.godown,
      qty_sold: qtySold,
      sale_rate: saleRate,
      sale_value: saleValue,
      cost_per_piece: bgStock.cost_per_piece,
      remaining_qty: newQty,
      new_status: newStatus,
      party_id: party_id || null,
      remarks: remarks || null,
      sold_at: new Date().toISOString(),
    };

    await logAudit(businessId, "create", "b_grade_stock", b_grade_stock_id, result, bgStock, request);

    return NextResponse.json({ success: true, sale: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}