import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Fetch entries
    const { data: entries, error } = await supabase
      .from("raw_material_stock_entries")
      .select("id, entry_type, posting_date, status, items:raw_material_stock_entry_items(quantity)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("posting_date", sixMonthsAgo.toISOString().split("T")[0]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Initialize 6 months in array
    interface MonthData {
      monthKey: string;
      name: string;
      inward: number;
      outward: number;
    }
    const months: MonthData[] = [];
    const tempDate = new Date(sixMonthsAgo);
    for (let i = 0; i < 6; i++) {
      months.push({
        monthKey: tempDate.toISOString().substring(0, 7), // YYYY-MM
        name: tempDate.toLocaleString("default", { month: "short", year: "2-digit" }),
        inward: 0,
        outward: 0,
      });
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    if (entries) {
      entries.forEach((e: any) => {
        const dateStr = e.posting_date.substring(0, 7); // YYYY-MM
        const monthObj = months.find((m) => m.monthKey === dateStr);
        if (monthObj) {
          let totalQty = 0;
          if (e.items && Array.isArray(e.items)) {
            e.items.forEach((item: any) => {
              totalQty += Number(item.quantity || 0);
            });
          }
          if (e.entry_type === "stock_in") {
            monthObj.inward += totalQty;
          } else if (e.entry_type === "stock_out") {
            monthObj.outward += totalQty;
          }
        }
      });
    }

    const chartData = months.map(({ name, inward, outward }) => ({
      name,
      inward: Number(inward.toFixed(2)),
      outward: Number(outward.toFixed(2)),
    }));

    return NextResponse.json({ chartData });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
