import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. Fetch template
    const { data: template, error: tempError } = await supabase
      .from("production_templates")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (tempError || !template) {
      return NextResponse.json({ error: "Production template not found" }, { status: 404 });
    }

    // 2. Fetch linked stages ordered by order_index
    const { data: stages, error: stagesError } = await supabase
      .from("production_stages")
      .select("*")
      .eq("template_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true });

    return NextResponse.json({
      template,
      stages: stages || [],
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

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

    // Update template details
    const { data: template, error: tempError } = await supabase
      .from("production_templates")
      .update({
        name,
        description: description || null,
        is_default: !!is_default,
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (tempError) {
      return NextResponse.json({ error: tempError.message }, { status: 500 });
    }

    // Update stages order_index if provided
    if (stages && Array.isArray(stages)) {
      for (const st of stages) {
        await supabase
          .from("production_stages")
          .update({ order_index: st.order_index, sort_order: st.order_index }) // sync both
          .eq("id", st.id)
          .eq("template_id", id)
          .eq("business_id", businessId);
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // Verify if it is default
    const { data: template } = await supabase
      .from("production_templates")
      .select("is_default")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (template?.is_default) {
      return NextResponse.json(
        { error: "Cannot delete the default template. Set another template as default first." },
        { status: 400 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from("production_templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
