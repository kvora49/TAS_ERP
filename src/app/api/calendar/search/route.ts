import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/calendar/search
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const tag = searchParams.get("tag");
  const personId = searchParams.get("person_id");
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "30", 10));

  if (!q && !type && !category && !priority && !status && !dateFrom && !dateTo && !tag) {
    return NextResponse.json({ data: [], meta: { total: 0 } });
  }

  try {
    let query = supabase
      .from("calendar_entries")
      .select(`
        id, entry_type, title, content, entry_date, entry_time,
        priority, status, category, tags, is_pinned,
        erp_module, erp_entity_label, erp_entity_type,
        created_at, updated_at,
        tasks:calendar_tasks(id, title, is_completed)
      `, { count: "exact" })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: true, nullsFirst: true })
      .limit(limit);

    // Keyword search — title and content
    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    }

    // Filters
    if (type && type !== "all") query = query.eq("entry_type", type);
    if (category && category !== "all") query = query.eq("category", category);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (status && status !== "all") query = query.eq("status", status);
    if (dateFrom) query = query.gte("entry_date", dateFrom);
    if (dateTo) query = query.lte("entry_date", dateTo);
    if (personId) query = query.eq("person_responsible", personId);

    // Tag filter — PostgreSQL array contains
    if (tag) query = query.contains("tags", [tag]);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also search in task titles if keyword provided
    let taskMatchEntryIds: string[] = [];
    if (q) {
      const { data: taskMatches } = await supabase
        .from("calendar_tasks")
        .select("entry_id")
        .eq("business_id", businessId)
        .ilike("title", `%${q}%`)
        .limit(20);

      taskMatchEntryIds = (taskMatches || []).map((t: any) => t.entry_id);
    }

    // Merge: combine direct matches + task title matches (deduplicated)
    const directIds = new Set((data || []).map((e: any) => e.id));
    const additionalIds = taskMatchEntryIds.filter((id) => !directIds.has(id));

    let additionalEntries: any[] = [];
    if (additionalIds.length > 0) {
      const { data: addData } = await supabase
        .from("calendar_entries")
        .select(`
          id, entry_type, title, content, entry_date, entry_time,
          priority, status, category, tags, is_pinned,
          erp_module, erp_entity_label, erp_entity_type,
          created_at,
          tasks:calendar_tasks(id, title, is_completed)
        `)
        .in("id", additionalIds)
        .eq("business_id", businessId)
        .is("deleted_at", null);
      additionalEntries = addData || [];
    }

    const allResults = [...(data || []), ...additionalEntries];

    // Group by date for easy rendering
    const grouped: Record<string, any[]> = {};
    for (const entry of allResults) {
      if (!grouped[entry.entry_date]) grouped[entry.entry_date] = [];
      grouped[entry.entry_date].push(entry);
    }

    return NextResponse.json({
      data: allResults,
      grouped,
      meta: { total: (count || 0) + additionalEntries.length },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
