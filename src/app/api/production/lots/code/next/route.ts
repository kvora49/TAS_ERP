import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const yy = String(now.getFullYear()).substring(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `LOT-${yy}-${mm}`;

  try {
    const { data: lots, error } = await supabase
      .from("production_lots")
      .select("lot_number")
      .eq("business_id", businessId)
      .like("lot_number", `${prefix}-%`)
      .order("lot_number", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let nextNum = 1;
    if (lots && lots.length > 0) {
      const nums = lots.map((l) => {
        if (!l.lot_number) return 0;
        const numPart = l.lot_number.substring(prefix.length + 1);
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      const maxNum = Math.max(...nums, 0);
      nextNum = maxNum + 1;
    }

    const nextCode = `${prefix}-${String(nextNum).padStart(3, "0")}`;
    return NextResponse.json({ code: nextCode });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
