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

    // 2. Fetch production stages
    const { data: stages, error: stagesError } = await supabase
      .from("production_stages")
      .select("id, name, icon, color, sort_order, is_active")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (stagesError) {
      return NextResponse.json({ error: stagesError.message }, { status: 500 });
    }

    // 3. Fetch godowns list (used for default work centers selection)
    const { data: godowns } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    return NextResponse.json({
      settings: settings || {},
      stages: stages || [],
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
      default_godown_id, // Default Work Center
      stages, // Optional array of stages with their IDs and new sort_order values
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
          default_godown_id: default_godown_id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // 2. Update production stages sorting order if passed
    if (stages && Array.isArray(stages)) {
      for (const stage of stages) {
        await supabase
          .from("production_stages")
          .update({ sort_order: Number(stage.sort_order) })
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
