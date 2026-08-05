import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─── GET /api/calendar/templates ─────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    let query = supabase
      .from("calendar_templates")
      .select("*")
      .or(`business_id.eq.${businessId},is_system.eq.true`)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });

    if (type && type !== "all") query = query.eq("template_type", type);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/calendar/templates ────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { name, description, template_type, content, task_items, category, priority, color_code } = body;

    if (!name || !template_type) {
      return NextResponse.json({ error: "name and template_type are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("calendar_templates")
      .insert({
        business_id: businessId,
        name: name.trim(),
        description: description || null,
        template_type,
        content: content || null,
        task_items: Array.isArray(task_items) ? task_items : [],
        category: category || "general",
        priority: priority || "medium",
        color_code: color_code || null,
        is_system: false,
        created_by: user?.id || null,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PUT /api/calendar/templates ─────────────────────────────────────────────
export async function PUT(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("calendar_templates")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("is_system", false) // Cannot modify system templates
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/calendar/templates ──────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase
      .from("calendar_templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("is_system", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
