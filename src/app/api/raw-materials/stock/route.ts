import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "summary"; // summary or entries
  const godownId = searchParams.get("godown_id");
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  try {
    if (view === "entries") {
      // Return list of stock entries
      let query = supabase
        .from("raw_material_stock_entries")
        .select("*, godown:godowns(name)")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (godownId) {
        query = query.eq("godown_id", godownId);
      }
      if (search) {
        query = query.or(`stock_entry_number.ilike.%${search}%,reference_no.ilike.%${search}%,remarks.ilike.%${search}%`);
      }

      const { data: entries, error } = await query.order("posting_date", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ entries });
    } else {
      // Return current stock summary
      let query = supabase
        .from("raw_material_current_stock")
        .select("*, material_type:raw_material_types(name, category, uom, min_stock_level), godown:godowns(name)")
        .eq("business_id", businessId);

      if (godownId) {
        query = query.eq("godown_id", godownId);
      }

      const { data: stock, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Filter and compute details
      let formattedStock = (stock || []).map((s: any) => {
        const current = Number(s.current_stock || 0);
        const minLevel = Number(s.material_type?.min_stock_level || 0);
        let stockStatus = "in_stock";
        if (current <= 0) {
          stockStatus = "out_of_stock";
        } else if (current < minLevel) {
          stockStatus = "low_stock";
        }

        return {
          ...s,
          status: stockStatus,
        };
      });

      // Filter by category or search term in memory
      if (category) {
        formattedStock = formattedStock.filter(
          (s: any) => s.material_type?.category === category
        );
      }
      if (search) {
        const sLower = search.toLowerCase();
        formattedStock = formattedStock.filter(
          (s: any) =>
            s.material_type?.name?.toLowerCase().includes(sLower) ||
            s.godown?.name?.toLowerCase().includes(sLower)
        );
      }

      return NextResponse.json({ stock: formattedStock });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
