import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/calendar/month-summary?year=2026&month=8
// Returns per-day counts for calendar dot indicators
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString(), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    // Single optimized query — GROUP BY date to get counts per day
    const { data, error } = await supabase
      .from("calendar_entries")
      .select("entry_date, entry_type, status")
      .eq("business_id", businessId)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aggregate client-side (fast — typically <200 rows per month)
    const summary: Record<string, {
      notes: number;
      reminders: number;
      tasks: number;
      events: number;
      journals: number;
      completed: number;
      overdue: number;
      pending: number;
      total: number;
    }> = {};

    for (const entry of data || []) {
      const dateKey = entry.entry_date;
      if (!summary[dateKey]) {
        summary[dateKey] = { notes: 0, reminders: 0, tasks: 0, events: 0, journals: 0, completed: 0, overdue: 0, pending: 0, total: 0 };
      }
      summary[dateKey].total++;

      if (entry.entry_type === "note") summary[dateKey].notes++;
      else if (entry.entry_type === "reminder") summary[dateKey].reminders++;
      else if (entry.entry_type === "task") summary[dateKey].tasks++;
      else if (entry.entry_type === "event") summary[dateKey].events++;
      else if (entry.entry_type === "journal") summary[dateKey].journals++;

      if (entry.status === "completed") summary[dateKey].completed++;
      else if (entry.status === "overdue") summary[dateKey].overdue++;
      else if (entry.status === "pending" || entry.status === "in_progress") summary[dateKey].pending++;
    }

    return NextResponse.json({ summary, year, month });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
