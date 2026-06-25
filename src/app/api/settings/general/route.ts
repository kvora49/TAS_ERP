import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch business info
    const { data: business, error: busError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (busError) {
      return NextResponse.json({ error: busError.message }, { status: 500 });
    }

    // 2. Fetch or create business settings
    let { data: settings, error: setError } = await supabase
      .from("business_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!settings && !setError) {
      // Seed default settings record on-demand
      const { data: newSettings, error: insertError } = await supabase
        .from("business_settings")
        .insert({
          business_id: businessId,
          enable_batch_tracking: business.enable_batch_tracking ?? true,
          allow_negative_stock: business.allow_negative_stock ?? false,
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

    return NextResponse.json({
      business,
      settings: settings || {},
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
      name,
      currency,
      date_format,
      timezone,
      items_per_page,
      enable_gst,
      enable_batch_tracking,
      enable_serial_numbers,
      low_stock_alerts,
      allow_negative_stock,
      client_updated_at,
    } = body;

    // Optimistic Lock Check
    const { data: currentBus, error: currentError } = await supabase
      .from("businesses")
      .select("updated_at")
      .eq("id", businessId)
      .single();

    if (currentError) {
      return NextResponse.json({ error: "Failed to verify record version" }, { status: 500 });
    }

    if (client_updated_at && currentBus && currentBus.updated_at !== client_updated_at) {
      return NextResponse.json(
        { error: "Conflict: This record has been modified by another user. Please refresh." },
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
      return NextResponse.json({ error: busUpdateError.message }, { status: 500 });
    }

    // 2. Update business_settings table
    const { data: existingSettings } = await supabase
      .from("business_settings")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();

    if (existingSettings) {
      const { error: setUpdateError } = await supabase
        .from("business_settings")
        .update({
          enable_batch_tracking: !!enable_batch_tracking,
          allow_negative_stock: !!allow_negative_stock,
          enable_serial_numbers: !!enable_serial_numbers,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      if (setUpdateError) {
        return NextResponse.json({ error: setUpdateError.message }, { status: 500 });
      }
    } else {
      const { error: setInsertError } = await supabase
        .from("business_settings")
        .insert({
          business_id: businessId,
          enable_batch_tracking: !!enable_batch_tracking,
          allow_negative_stock: !!allow_negative_stock,
          enable_serial_numbers: !!enable_serial_numbers,
        });

      if (setInsertError) {
        return NextResponse.json({ error: setInsertError.message }, { status: 500 });
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
