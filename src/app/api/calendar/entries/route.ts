import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─── GET /api/calendar/entries ───────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const status = searchParams.get("status");
  const personId = searchParams.get("person_id");
  const isPinned = searchParams.get("is_pinned");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("calendar_entries")
      .select(`
        *,
        tasks:calendar_tasks(id, title, is_completed, sort_order, parent_task_id),
        reminders:calendar_reminders(id, remind_at, notify_before_minutes, repeat_type, is_fired, is_acknowledged),
        attachments:calendar_attachments(id, file_name, file_type, public_url)
      `, { count: "exact" })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("entry_time", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    // Date filters
    if (date) {
      query = query.eq("entry_date", date);
    } else {
      if (dateFrom) query = query.gte("entry_date", dateFrom);
      if (dateTo) query = query.lte("entry_date", dateTo);
    }

    // Type filters
    if (type && type !== "all") query = query.eq("entry_type", type);
    if (category && category !== "all") query = query.eq("category", category);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (status && status !== "all") query = query.eq("status", status);
    if (personId) query = query.eq("person_responsible", personId);
    if (isPinned === "true") query = query.eq("is_pinned", true);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Sort tasks within each entry by sort_order
    const entries = (data || []).map((entry: any) => ({
      ...entry,
      tasks: (entry.tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    }));

    return NextResponse.json({
      data: entries,
      meta: { total: count || 0, page, limit },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/calendar/entries ──────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    const {
      entry_type, title, content, entry_date, entry_time, end_date, end_time,
      is_all_day, priority, status, category, color_code, tags, is_pinned,
      erp_module, erp_entity_id, erp_entity_type, erp_entity_label,
      person_responsible,
      // Task-specific
      task_items,
      // Reminder-specific
      reminder_notify_before_minutes, reminder_repeat_type, reminder_repeat_interval,
      reminder_repeat_end_date,
      // Template-apply
      template_id,
    } = body;

    // Validate required fields
    if (!entry_type || !title || !entry_date) {
      return NextResponse.json({ error: "entry_type, title, and entry_date are required" }, { status: 400 });
    }

    const validTypes = ["note", "reminder", "task", "journal", "event"];
    if (!validTypes.includes(entry_type)) {
      return NextResponse.json({ error: `Invalid entry_type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    // Create the entry
    const { data: entry, error: entryError } = await supabase
      .from("calendar_entries")
      .insert({
        business_id: businessId,
        entry_type,
        title: title.trim(),
        content: content || null,
        entry_date,
        entry_time: entry_time || null,
        end_date: end_date || null,
        end_time: end_time || null,
        is_all_day: is_all_day ?? true,
        priority: priority || "medium",
        status: status || "pending",
        category: category || "general",
        color_code: color_code || null,
        tags: Array.isArray(tags) ? tags : [],
        is_pinned: is_pinned || false,
        erp_module: erp_module || null,
        erp_entity_id: erp_entity_id || null,
        erp_entity_type: erp_entity_type || null,
        erp_entity_label: erp_entity_label || null,
        person_responsible: person_responsible || null,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      })
      .select("*")
      .single();

    if (entryError || !entry) {
      return NextResponse.json({ error: entryError?.message || "Failed to create entry" }, { status: 500 });
    }

    // If template_id provided, apply template tasks
    let templateTaskItems = task_items;
    if (template_id && !task_items) {
      const { data: tmpl } = await supabase
        .from("calendar_templates")
        .select("task_items, content")
        .eq("id", template_id)
        .single();
      if (tmpl?.task_items) templateTaskItems = tmpl.task_items;
    }

    // Create task items for task-type entries
    if (entry_type === "task" && Array.isArray(templateTaskItems) && templateTaskItems.length > 0) {
      const taskRows = templateTaskItems.map((item: any, idx: number) => ({
        business_id: businessId,
        entry_id: entry.id,
        title: item.title || item,
        sort_order: item.sort_order ?? idx,
        is_completed: false,
      }));

      const { error: taskError } = await supabase.from("calendar_tasks").insert(taskRows);
      if (taskError) {
        console.error("[Calendar API] Failed to create task items:", taskError.message);
      }
    }

    // Create reminder schedule for reminder-type entries
    if (entry_type === "reminder" && entry_date) {
      const notifyBefore = reminder_notify_before_minutes ?? 30;
      // Calculate remind_at from entry_date + entry_time - notify_before_minutes
      const timeStr = entry_time || "09:00";
      const entryDateTime = new Date(`${entry_date}T${timeStr}:00`);
      entryDateTime.setMinutes(entryDateTime.getMinutes() - notifyBefore);

      const { error: reminderError } = await supabase.from("calendar_reminders").insert({
        business_id: businessId,
        entry_id: entry.id,
        remind_at: entryDateTime.toISOString(),
        notify_before_minutes: notifyBefore,
        repeat_type: reminder_repeat_type || "never",
        repeat_interval: reminder_repeat_interval || null,
        repeat_end_date: reminder_repeat_end_date || null,
      });

      if (reminderError) {
        console.error("[Calendar API] Failed to create reminder:", reminderError.message);
      }
    }

    // Fetch back the complete entry with relations
    const { data: fullEntry } = await supabase
      .from("calendar_entries")
      .select(`
        *,
        tasks:calendar_tasks(id, title, is_completed, sort_order, parent_task_id),
        reminders:calendar_reminders(id, remind_at, notify_before_minutes, repeat_type, is_fired, is_acknowledged)
      `)
      .eq("id", entry.id)
      .single();

    return NextResponse.json({ data: fullEntry || entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
