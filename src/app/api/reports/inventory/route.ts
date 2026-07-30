import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase.from("users").select("business_id").eq("id", user.id).single();
  if (!userData?.business_id) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "valuation";
  const bid = userData.business_id;

  try {
    if (tab === "valuation") {
      // 1. Finished goods stock
      const { data: finished } = await supabase
        .from("finished_stock")
        .select(`
          total_quantity, total_value,
          design:designs(id, name, design_number, brands(id, name))
        `)
        .eq("business_id", bid)
        .is("deleted_at", null);

      // 2. Raw material stock
      const { data: raw } = await supabase
        .from("raw_material_current_stock")
        .select(`
          current_stock,
          material_type:raw_material_types(id, name, category, unit, reorder_level)
        `)
        .eq("business_id", bid);

      // Aggregate finished goods by design
      const designMap: Record<string, {
        design_id: string; design_name: string; design_number: string;
        brand: string; total_qty: number; total_value: number;
      }> = {};

      (finished ?? []).forEach((s: any) => {
        const d = s.design;
        const did = d?.id ?? "unknown";
        if (!designMap[did]) {
          designMap[did] = {
            design_id: did,
            design_name: d?.name ?? "—",
            design_number: d?.design_number ?? "—",
            brand: d?.brands?.name ?? "Default",
            total_qty: 0,
            total_value: 0,
          };
        }
        designMap[did].total_qty += Number(s.total_quantity ?? 0);
        designMap[did].total_value += Number(s.total_value ?? 0);
      });

      const fgRows = Object.values(designMap).sort((a, b) => b.total_value - a.total_value);
      const totalFGQty = fgRows.reduce((s, r) => s + r.total_qty, 0);
      const totalFGValue = fgRows.reduce((s, r) => s + r.total_value, 0);

      const totalRMQty = (raw ?? []).reduce((s, r: any) => s + Number(r.current_stock ?? 0), 0);

      const brandBreakdown = fgRows.reduce<Record<string, { qty: number; value: number }>>((acc, r) => {
        if (!acc[r.brand]) acc[r.brand] = { qty: 0, value: 0 };
        acc[r.brand].qty += r.total_qty;
        acc[r.brand].value += r.total_value;
        return acc;
      }, {});

      return NextResponse.json({
        tab,
        rows: fgRows,
        summary: {
          totalQty: totalFGQty + totalRMQty,
          totalValue: totalFGValue,
          totalDesigns: fgRows.length,
          totalRMQty,
        },
        brandBreakdown,
      });
    }

    if (tab === "warehouse") {
      const { data: stock } = await supabase
        .from("finished_stock")
        .select(`
          total_quantity, total_value, godown_id,
          godown:godowns(id, name)
        `)
        .eq("business_id", bid)
        .is("deleted_at", null);

      const godownMap: Record<string, { name: string; qty: number; value: number }> = {};
      (stock ?? []).forEach((s: any) => {
        const g = s.godown;
        const gid = g?.id ?? "no_godown";
        const gName = g?.name ?? "Main Godown";
        if (!godownMap[gid]) godownMap[gid] = { name: gName, qty: 0, value: 0 };
        godownMap[gid].qty += Number(s.total_quantity ?? 0);
        godownMap[gid].value += Number(s.total_value ?? 0);
      });

      const rows = Object.entries(godownMap).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.value - a.value);
      const totalQty = rows.reduce((s, r) => s + r.qty, 0);
      const totalValue = rows.reduce((s, r) => s + r.value, 0);

      return NextResponse.json({ tab, rows, summary: { totalQty, totalValue, totalGodowns: rows.length } });
    }

    if (tab === "design") {
      const { data: stock } = await supabase
        .from("finished_stock")
        .select(`
          id, total_quantity, total_value, size_quantities,
          design:designs(id, name, design_number, brands(id, name)),
          colour:design_colours(id, colour_name),
          godown:godowns(id, name)
        `)
        .eq("business_id", bid)
        .is("deleted_at", null);

      const rows = (stock ?? []).map((s: any) => ({
        id: s.id,
        design_name: s.design?.name ?? "—",
        design_number: s.design?.design_number ?? "—",
        brand: s.design?.brands?.name ?? "—",
        colour: s.colour?.colour_name ?? "—",
        godown: s.godown?.name ?? "Main Godown",
        quantity: Number(s.total_quantity ?? 0),
        cost_per_piece: Number(s.total_quantity) > 0 ? Number(s.total_value ?? 0) / Number(s.total_quantity) : 0,
        value: Number(s.total_value ?? 0),
      }));

      const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
      const totalValue = rows.reduce((s, r) => s + r.value, 0);

      return NextResponse.json({ tab, rows, summary: { totalQty, totalValue, totalItems: rows.length } });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (err: any) {
    console.error("[reports/inventory]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
