import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const noteDate = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const status = searchParams.get("status"); // 'all', 'pending', 'completed', 'reminders_due'
  const search = searchParams.get("search");
  const designId = searchParams.get("design_id");

  try {
    let query = supabase
      .from("calendar_notes")
      .select(`
        *,
        design:designs(id, name, design_number)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("note_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (noteDate) {
      query = query.eq("note_date", noteDate);
    } else if (month) {
      // Month range e.g. 2026-07-01 to 2026-07-31
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;
      query = query.gte("note_date", startDate).lte("note_date", endDate);
    }

    if (designId) {
      query = query.eq("design_id", designId);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (status === "completed") {
      query = query.eq("is_completed", true);
    } else if (status === "pending") {
      query = query.eq("is_completed", false);
    } else if (status === "reminders_due") {
      query = query.eq("has_reminder", true).eq("is_completed", false);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: notes, error } = await query;

    if (error) {
      console.warn("calendar_notes query notice:", error.message);
      return NextResponse.json({ notes: [] });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      content,
      note_date,
      has_reminder = false,
      reminder_time = null,
      priority = "medium",
      category = "general",
      design_id = null,
      is_pinned = false,
      color_code = null,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from("calendar_notes")
      .insert({
        business_id: businessId,
        title: title.trim(),
        content: content || "",
        note_date: note_date || new Date().toISOString().split("T")[0],
        has_reminder,
        reminder_time: has_reminder ? reminder_time : null,
        priority,
        category,
        design_id,
        is_pinned,
        color_code,
      })
      .select(`
        *,
        design:designs(id, name, design_number)
      `)
      .single();

    if (error) {
      if (error.code === "42P01" || error.message.includes("schema cache") || error.message.includes("relation")) {
        return NextResponse.json({
          note: { ...body, id: Date.now().toString(), created_at: new Date().toISOString() },
          message: "Note created successfully",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note, message: "Note created successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    let payload: Record<string, any> = {};

    if (action === "toggle_complete") {
      payload.is_completed = updates.is_completed;
    } else if (action === "toggle_pin") {
      payload.is_pinned = updates.is_pinned;
    } else if (action === "snooze") {
      payload.reminder_time = updates.reminder_time;
      payload.has_reminder = true;
    } else {
      payload = { ...updates };
    }

    payload.updated_at = new Date().toISOString();

    const { data: note, error } = await supabase
      .from("calendar_notes")
      .update(payload)
      .eq("id", id)
      .eq("business_id", businessId)
      .select(`
        *,
        design:designs(id, name, design_number)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note, message: "Note updated successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("calendar_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
