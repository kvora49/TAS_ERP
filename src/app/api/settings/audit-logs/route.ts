import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const moduleParam = searchParams.get("module");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  try {
    let query = supabase
      .from("audit_log")
      .select("*, users:user_id(full_name, email)", { count: "exact" })
      .eq("business_id", businessId);

    // Apply filters
    if (moduleParam && moduleParam !== "all" && moduleParam !== "All Modules") {
      query = query.ilike("table_name", `%${moduleParam}%`);
    }

    if (userId && userId !== "all" && userId !== "All Users") {
      query = query.eq("user_id", userId);
    }

    if (action && action !== "all" && action !== "All Actions") {
      query = query.eq("action", action);
    }

    if (fromDate) {
      query = query.gte("created_at", `${fromDate}T00:00:00Z`);
    }

    if (toDate) {
      query = query.lte("created_at", `${toDate}T23:59:59Z`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: logs, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      count: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
