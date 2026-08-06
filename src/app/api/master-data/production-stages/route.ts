import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function resolveOptionalTemplateId(supabase: any, businessId: string, requestedTemplateId?: string | null): Promise<string | null> {
  if (requestedTemplateId) return requestedTemplateId;

  try {
    // 1. Try finding default template
    const { data: defaultTemp } = await supabase
      .from("production_templates")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_default", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (defaultTemp?.id) return defaultTemp.id;

    // 2. Try finding ANY active template for this business
    const { data: anyTemp } = await supabase
      .from("production_templates")
      .select("id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (anyTemp?.id) return anyTemp.id;

    // 3. Auto-create default template for this business
    const { data: newTemp, error: createErr } = await supabase
      .from("production_templates")
      .insert({
        business_id: businessId,
        name: "Default Garment Flow",
        description: "Standard master production workflow template",
        is_default: true,
      })
      .select("id")
      .single();

    if (createErr) {
      console.error("Failed to auto-create default production template:", createErr);
    }

    return newTemp?.id || null;
  } catch (e) {
    console.error("Error in resolveOptionalTemplateId:", e);
    return null;
  }
}

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedTemplateId = searchParams.get("template_id");

  try {
    let query = supabase
      .from("production_stages")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (requestedTemplateId) {
      query = query.eq("template_id", requestedTemplateId);
    }

    const { data: stages, error } = await query.order("order_index", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stages: stages || [] });
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
    const { name, description, icon, color, custom_fields, is_active, template_id: requestedTemplateId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Stage Name is required" },
        { status: 400 }
      );
    }

    const template_id = await resolveOptionalTemplateId(supabase, businessId, requestedTemplateId);

    if (!template_id) {
      return NextResponse.json(
        { error: "Failed to assign a workflow template. Please create a workflow template first." },
        { status: 400 }
      );
    }

    // Get max order_index for this business and template_id to append this stage at the end
    let maxOrderQuery = supabase
      .from("production_stages")
      .select("order_index")
      .eq("business_id", businessId)
      .eq("template_id", template_id)
      .is("deleted_at", null);

    const { data: maxOrderData } = await maxOrderQuery
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrderIndex =
      maxOrderData && maxOrderData.length > 0
        ? (maxOrderData[0].order_index || 0) + 1
        : 1;

    const insertPayload: any = {
      business_id: businessId,
      template_id,
      name,
      description: description || null,
      icon: icon || null,
      color: color || null,
      order_index: nextOrderIndex,
      sort_order: nextOrderIndex,
      custom_fields: custom_fields || [],
      is_active: is_active !== false,
    };

    const { data: stage, error } = await supabase
      .from("production_stages")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stage });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Bulk update reorder
export async function PUT(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { stages } = body; // Array of { id: string, sort_order: number }

    if (!stages || !Array.isArray(stages)) {
      return NextResponse.json(
        { error: "stages list array is required for reordering" },
        { status: 400 }
      );
    }

    // Perform individual updates. In Postgres, we can do these in parallel.
    const promises = stages.map((s: any) =>
      supabase
        .from("production_stages")
        .update({ 
          sort_order: s.sort_order,
          order_index: s.sort_order
        })
        .eq("id", s.id)
        .eq("business_id", businessId)
    );

    const results = await Promise.all(promises);
    const failed = results.find((r) => r.error);
    
    if (failed) {
      return NextResponse.json(
        { error: failed.error?.message || "Failed to update sort order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
