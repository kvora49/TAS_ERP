import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const moduleParam = searchParams.get("module");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  try {
    let query = supabase
      .from("audit_log")
      .select("*")
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

    // Limit to 1000 for export safety
    const { data: logs, error } = await query
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return new Response(error.message, { status: 500 });
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

    // Format logs as CSV rows
    let csv = "Date & Time,User,Module,Action,Description,IP Address\n";
    if (logsWithUsers && logsWithUsers.length > 0) {
      logsWithUsers.forEach((log) => {
        const date = new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const userName = log.user_name || log.users?.full_name || "System";
        const moduleVal = log.table_name || "General";
        const actionVal = log.action || "Activity";
        const desc = log.new_values?.description || `${actionVal} in ${moduleVal}`;
        const ip = log.ip_address || "N/A";
        
        // Escape fields to avoid CSV breaking
        const escapedUser = userName.replace(/"/g, '""');
        const escapedDesc = desc.replace(/"/g, '""');
        const escapedModule = moduleVal.replace(/"/g, '""');

        csv += `"${date}","${escapedUser}","${escapedModule}","${actionVal}","${escapedDesc}","${ip}"\n`;
      });
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit_logs_${new Date().toISOString().substring(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return new Response(err.message || "Export failed", { status: 500 });
  }
}
