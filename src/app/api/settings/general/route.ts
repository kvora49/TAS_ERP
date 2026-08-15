import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch business and settings in parallel
    const [businessResult, settingsResult] = await Promise.all([
      supabase
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle()
    ]);

    const { data: business, error: busError } = businessResult;
    let { data: settings, error: setError } = settingsResult;

    if (busError) {
      console.error("GET /api/settings/general error busError:", busError);
      return NextResponse.json({ error: busError.message }, { status: 500 });
    }
    if (setError) {
      console.error("GET /api/settings/general error setError:", setError);
    }

    if (!settings && !setError) {
      // Seed default settings record on-demand
      const { data: newSettings, error: insertError } = await supabase
        .from("business_settings")
        .insert({
          business_id: businessId,
          enable_batch_tracking: business?.enable_batch_tracking ?? true,
          allow_negative_stock: business?.allow_negative_stock ?? false,
          low_stock_threshold: 10,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to seed business_settings:", insertError.message);
      } else {
        settings = newSettings;
      }
    }

    const enableKachaBilling = settings ? settings.job_work_default_bill_type !== "kacha_disabled" : true;

    return NextResponse.json({
      business: business || {
        id: businessId,
        name: "TAS ERP",
        currency: "INR",
        date_format: "DD MMM YYYY",
        timezone: "Asia/Kolkata",
        items_per_page: 10,
        enable_gst: true,
        enable_batch_tracking: true,
        allow_negative_stock: false,
        low_stock_alerts: true,
        updated_at: new Date().toISOString(),
      },
      settings: {
        ...(settings || {}),
        enable_kacha_billing: enableKachaBilling,
      },
    });
  } catch (err: any) {
    console.error("GET /api/settings/general exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { requireAuthGuard } = await import("@/lib/auth/guards");
  const { handleApiError } = await import("@/lib/api-response");

  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;
  const supabase = createClient();

  try {
    const body = await request.json();
    const {
      name,
      currency,
      date_format,
      timezone,
      items_per_page,
      enable_gst,
      enable_batch_tracking,
      enable_serial_numbers,
      enable_kacha_billing,
      low_stock_alerts,
      allow_negative_stock,
      motion_profile,
      client_updated_at,
    } = body;

    // Validate motion_profile
    const validMotionProfile = ['ultraFast', 'balanced', 'premium'].includes(motion_profile)
      ? motion_profile
      : 'balanced';

    // Optimistic Lock Check
    const { data: currentBus, error: currentError } = await supabase
      .from("businesses")
      .select("updated_at")
      .eq("id", businessId)
      .single();

    if (currentError) {
      throw new Error("Failed to verify record version");
    }

    if (client_updated_at && currentBus && currentBus.updated_at !== client_updated_at) {
      return NextResponse.json(
        { error: "Conflict: This record has been modified by another user. Please refresh.", code: "VERSION_CONFLICT" },
        { status: 409 }
      );
    }

    // 1. Update businesses table
    const { error: busUpdateError } = await supabase
      .from("businesses")
      .update({
        name,
        currency,
        date_format,
        timezone,
        items_per_page: Number(items_per_page || 10),
        enable_gst: !!enable_gst,
        enable_batch_tracking: !!enable_batch_tracking,
        allow_negative_stock: !!allow_negative_stock,
        low_stock_alerts: !!low_stock_alerts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (busUpdateError) {
      throw busUpdateError;
    }

    // 2. Update business_settings table
    const { data: existingSettings } = await supabase
      .from("business_settings")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();

    const kachaSettingValue = enable_kacha_billing === false ? "kacha_disabled" : "kacha_enabled";

    if (existingSettings) {
      const { error: setUpdateError } = await supabase
        .from("business_settings")
        .update({
          enable_batch_tracking: !!enable_batch_tracking,
          allow_negative_stock: !!allow_negative_stock,
          enable_serial_numbers: !!enable_serial_numbers,
          job_work_default_bill_type: kachaSettingValue,
          motion_profile: validMotionProfile,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      if (setUpdateError) {
        throw setUpdateError;
      }
    } else {
      const { error: setInsertError } = await supabase
        .from("business_settings")
        .insert({
          business_id: businessId,
          enable_batch_tracking: !!enable_batch_tracking,
          allow_negative_stock: !!allow_negative_stock,
          enable_serial_numbers: !!enable_serial_numbers,
          job_work_default_bill_type: kachaSettingValue,
          motion_profile: validMotionProfile,
        });

      if (setInsertError) {
        throw setInsertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}

