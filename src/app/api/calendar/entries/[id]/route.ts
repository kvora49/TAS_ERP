import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─── GET /api/calendar/entries/[id] ─────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const { data, error } = await supabase
      .from("calendar_entries")
      .select(`
        *,
        tasks:calendar_tasks(id, title, is_completed, sort_order, parent_task_id, completed_at, completed_by),
        reminders:calendar_reminders(id, remind_at, notify_before_minutes, repeat_type, repeat_interval, repeat_end_date, is_fired, is_acknowledged),
        attachments:calendar_attachments(id, file_name, file_type, file_size, public_url, storage_path, created_at)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort tasks by sort_order
    if (data?.tasks) {
      data.tasks = data.tasks.sort((a: any, b: any) => a.sort_order - b.sort_order);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PUT /api/calendar/entries/[id] ─────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    // Verify ownership before update
    const { data: existing } = await supabase
      .from("calendar_entries")
      .select("id, entry_type, entry_date, entry_time")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Build update payload — only include provided fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: user?.id };

    const allowedFields = [
      "title", "content", "entry_date", "entry_time", "end_date", "end_time",
      "is_all_day", "priority", "status", "category", "color_code", "tags",
      "is_pinned", "erp_module", "erp_entity_id", "erp_entity_type",
      "erp_entity_label", "person_responsible",
    ];

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from("calendar_entries")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If entry_date or entry_time changed and it's a reminder, recalculate remind_at
    if ((body.entry_date || body.entry_time) && existing.entry_type === "reminder") {
      const newDate = body.entry_date || existing.entry_date;
      const newTime = body.entry_time || existing.entry_time || "09:00";

      const { data: reminders } = await supabase
        .from("calendar_reminders")
        .select("id, notify_before_minutes")
        .eq("entry_id", id)
        .eq("is_fired", false);

      if (reminders && reminders.length > 0) {
        for (const rem of reminders) {
          const entryDateTime = new Date(`${newDate}T${newTime}:00`);
          entryDateTime.setMinutes(entryDateTime.getMinutes() - (rem.notify_before_minutes || 0));

          await supabase
            .from("calendar_reminders")
            .update({ remind_at: entryDateTime.toISOString(), updated_at: new Date().toISOString() })
            .eq("id", rem.id);
        }
      }
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/calendar/entries/[id] ──────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    // Soft delete
    const { error } = await supabase
      .from("calendar_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
