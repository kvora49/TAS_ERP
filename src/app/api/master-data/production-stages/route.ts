import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let templateId = searchParams.get("template_id");

  try {
    if (!templateId) {
      const { data: defaultTemp } = await supabase
        .from("production_templates")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_default", true)
        .is("deleted_at", null)
        .limit(1)
        .single();
      if (defaultTemp) {
        templateId = defaultTemp.id;
      }
    }

    if (!templateId) {
      return NextResponse.json({ error: "No production templates found" }, { status: 404 });
    }

    const { data: stages, error } = await supabase
      .from("production_stages")
      .select("*")
      .eq("business_id", businessId)
      .eq("template_id", templateId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stages });
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
    const { name, description, icon, color, custom_fields, is_active } = body;
    let { template_id } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Stage Name is required" },
        { status: 400 }
      );
    }

    // Resolve template_id if not supplied
    if (!template_id) {
      const { data: defaultTemp } = await supabase
        .from("production_templates")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_default", true)
        .is("deleted_at", null)
        .limit(1)
        .single();
      if (defaultTemp) {
        template_id = defaultTemp.id;
      }
    }

    if (!template_id) {
      return NextResponse.json({ error: "No production template specified or found" }, { status: 400 });
    }

    // Get max order_index in this template to append this stage at the end
    const { data: maxOrderData } = await supabase
      .from("production_stages")
      .select("order_index")
      .eq("business_id", businessId)
      .eq("template_id", template_id)
      .is("deleted_at", null)
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrderIndex =
      maxOrderData && maxOrderData.length > 0
        ? (maxOrderData[0].order_index || 0) + 1
        : 1;

    const { data: stage, error } = await supabase
      .from("production_stages")
      .insert({
        business_id: businessId,
        template_id,
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        order_index: nextOrderIndex,
        sort_order: nextOrderIndex, // sync sort_order too
        custom_fields: custom_fields || [],
        is_active: is_active !== false,
      })
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
