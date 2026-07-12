import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: templates, error } = await supabase
      .from("production_templates")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
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
    const { name, description, is_default, stages } = body;

    if (!name) {
      return NextResponse.json({ error: "Template Name is required" }, { status: 400 });
    }

    if (is_default) {
      // Set all other templates of this business as non-default
      await supabase
        .from("production_templates")
        .update({ is_default: false })
        .eq("business_id", businessId);
    }

    const { data: template, error } = await supabase
      .from("production_templates")
      .insert({
        business_id: businessId,
        name,
        description: description || null,
        is_default: !!is_default,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert inline stages if provided
    if (stages && Array.isArray(stages) && stages.length > 0) {
      const stagesToInsert = stages.map((s: any, idx: number) => ({
        business_id: businessId,
        template_id: template.id,
        name: s.name,
        description: s.description || null,
        icon: s.icon || null,
        color: s.color || "#6366F1",
        order_index: idx + 1,
        custom_fields: s.custom_fields || [],
        is_active: s.is_active !== false,
      }));

      const { error: stagesError } = await supabase
        .from("production_stages")
        .insert(stagesToInsert);

      if (stagesError) {
        // Rollback template creation to maintain atomicity/consistency
        await supabase.from("production_templates").delete().eq("id", template.id);
        return NextResponse.json({ error: stagesError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ template });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
