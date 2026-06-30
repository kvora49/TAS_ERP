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
      .select("*", { count: "exact" })
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

    // Fetch unique users in-memory to bypass schema cache relationship constraints
    let logsWithUsers = logs || [];
    if (logs && logs.length > 0) {
      const userIds = Array.from(new Set(logs.map((log: any) => log.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds);
        
        if (usersData) {
          const userMap = new Map(usersData.map((u: any) => [u.id, u]));
          logsWithUsers = logs.map((log: any) => ({
            ...log,
            users: log.user_id ? userMap.get(log.user_id) || null : null,
          }));
        }
      }
    }

    return NextResponse.json({
      logs: logsWithUsers,
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
