import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch settings
    let { data: settings, error: setError } = await supabase
      .from("business_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!settings && !setError) {
      const { data: newSettings } = await supabase
        .from("business_settings")
        .insert({ business_id: businessId })
        .select()
        .single();
      settings = newSettings;
    }

    // 2. Fetch default production template with its stages, and all active templates
    const { data: defaultTemplate } = await supabase
      .from("production_templates")
      .select("*, stages:production_stages(*)")
      .eq("business_id", businessId)
      .eq("is_default", true)
      .is("deleted_at", null)
      .maybeSingle();

    const { data: allTemplates } = await supabase
      .from("production_templates")
      .select("id, name, description, is_default, created_at, stages:production_stages(id, name, order_index, is_active)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const sortedDefaultStages = defaultTemplate?.stages
      ? [...defaultTemplate.stages].sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
      : [];

    // 3. Fetch godowns list (used for default work centers selection)
    const { data: godowns } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    return NextResponse.json({
      settings: settings || {},
      stages: sortedDefaultStages,
      defaultTemplate: defaultTemplate ? { ...defaultTemplate, stages: sortedDefaultStages } : null,
      templates: allTemplates || [],
      godowns: godowns || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      job_work_default_bill_type,
      auto_complete_lot,
      allow_back_date_production,
      lock_completed_lots,
      default_work_center_id, // Default Work Center
      default_template_id, // Switch default workflow template
      stages, // Optional array of stages with their IDs and new sort_order/order_index values
    } = body;

    // 1. Update settings
    const { error: setError } = await supabase
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          job_work_default_bill_type,
          auto_complete_lot: !!auto_complete_lot,
          allow_back_date_production: !!allow_back_date_production,
          lock_completed_lots: !!lock_completed_lots,
          default_work_center_id: default_work_center_id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // 2. Switch default template if requested
    if (default_template_id) {
      await supabase
        .from("production_templates")
        .update({ is_default: false })
        .eq("business_id", businessId);

      await supabase
        .from("production_templates")
        .update({ is_default: true })
        .eq("id", default_template_id)
        .eq("business_id", businessId);
    }

    // 3. Update production stages sorting order if passed
    if (stages && Array.isArray(stages)) {
      for (const stage of stages) {
        const orderVal = Number(stage.sort_order ?? stage.order_index ?? 0);
        await supabase
          .from("production_stages")
          .update({ sort_order: orderVal, order_index: orderVal })
          .eq("id", stage.id)
          .eq("business_id", businessId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
