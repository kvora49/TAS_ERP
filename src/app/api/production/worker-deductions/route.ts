import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get("worker_id");
  const lotId = searchParams.get("lot_id");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    let query = supabase
      .from("worker_deductions")
      .select(`
        *,
        worker:parties (id, name, code),
        lot:production_lots (id, lot_number),
        defect:lot_defects (id, defect_number, defect_category, quantity)
      `)
      .eq("business_id", businessId)
      .order("deduction_date", { ascending: false });

    if (workerId) {
      query = query.eq("worker_id", workerId);
    }
    if (lotId) {
      query = query.eq("lot_id", lotId);
    }
    if (startDate) {
      query = query.gte("deduction_date", startDate);
    }
    if (endDate) {
      query = query.lte("deduction_date", endDate);
    }

    const { data: deductions, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deductions: deductions || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
