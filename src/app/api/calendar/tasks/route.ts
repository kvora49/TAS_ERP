import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/calendar/tasks
// Handles all checklist item operations
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { action, entry_id, task_id, title, is_completed, sort_orders, parent_task_id } = body;

    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    switch (action) {
      case "toggle_complete": {
        if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

        const { data: task } = await supabase
          .from("calendar_tasks")
          .select("id, is_completed, entry_id")
          .eq("id", task_id)
          .eq("business_id", businessId)
          .single();

        if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

        const newCompleted = is_completed !== undefined ? is_completed : !task.is_completed;

        const { data, error } = await supabase
          .from("calendar_tasks")
          .update({
            is_completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null,
            completed_by: newCompleted ? (user?.id || null) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task_id)
          .eq("business_id", businessId)
          .select("*")
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Update parent entry status based on task completion
        await updateParentEntryStatus(supabase, businessId, task.entry_id);

        return NextResponse.json({ data });
      }

      case "add_item": {
        if (!entry_id || !title) return NextResponse.json({ error: "entry_id and title required" }, { status: 400 });

        // Verify entry ownership
        const { data: entry } = await supabase
          .from("calendar_entries")
          .select("id")
          .eq("id", entry_id)
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .single();

        if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

        // Get next sort_order
        const { count } = await supabase
          .from("calendar_tasks")
          .select("id", { count: "exact" })
          .eq("entry_id", entry_id)
          .eq("business_id", businessId);

        const { data, error } = await supabase
          .from("calendar_tasks")
          .insert({
            business_id: businessId,
            entry_id,
            title: title.trim(),
            sort_order: count || 0,
            parent_task_id: parent_task_id || null,
          })
          .select("*")
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data }, { status: 201 });
      }

      case "update_title": {
        if (!task_id || !title) return NextResponse.json({ error: "task_id and title required" }, { status: 400 });

        const { data, error } = await supabase
          .from("calendar_tasks")
          .update({ title: title.trim(), updated_at: new Date().toISOString() })
          .eq("id", task_id)
          .eq("business_id", businessId)
          .select("*")
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case "delete_item": {
        if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

        const { data: task } = await supabase
          .from("calendar_tasks")
          .select("entry_id")
          .eq("id", task_id)
          .eq("business_id", businessId)
          .single();

        const { error } = await supabase
          .from("calendar_tasks")
          .delete()
          .eq("id", task_id)
          .eq("business_id", businessId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (task?.entry_id) {
          await updateParentEntryStatus(supabase, businessId, task.entry_id);
        }

        return NextResponse.json({ success: true });
      }

      case "reorder": {
        // sort_orders: [{id: uuid, sort_order: number}]
        if (!Array.isArray(sort_orders) || sort_orders.length === 0) {
          return NextResponse.json({ error: "sort_orders array required" }, { status: 400 });
        }

        const updates = sort_orders.map(({ id, sort_order }: { id: string; sort_order: number }) =>
          supabase
            .from("calendar_tasks")
            .update({ sort_order, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("business_id", businessId)
        );

        await Promise.all(updates);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Helper: update parent entry status based on task completion
async function updateParentEntryStatus(
  supabase: any,
  businessId: string,
  entryId: string
) {
  const { data: allTasks } = await supabase
    .from("calendar_tasks")
    .select("is_completed")
    .eq("entry_id", entryId)
    .eq("business_id", businessId)
    .is("parent_task_id", null); // Only root tasks

  if (!allTasks || allTasks.length === 0) return;

  const allCompleted = allTasks.every((t: any) => t.is_completed);
  const anyStarted = allTasks.some((t: any) => t.is_completed);

  let newStatus = "pending";
  if (allCompleted) newStatus = "completed";
  else if (anyStarted) newStatus = "in_progress";

  await supabase
    .from("calendar_entries")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("business_id", businessId);
}
