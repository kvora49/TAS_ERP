import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError, validateRequestBody } from "@/lib/api-response";
import { InventorySettingsSchema } from "@/lib/schemas/settings.schema";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch settings and godowns list in parallel
    const [settingsResult, godownsResult] = await Promise.all([
      supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("godowns")
        .select("id, name")
        .eq("business_id", businessId)
        .is("deleted_at", null)
    ]);

    let { data: settings, error: setError } = settingsResult;
    const { data: godowns, error: godownError } = godownsResult;

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }
    if (godownError) {
      return NextResponse.json({ error: godownError.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: settings || {},
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
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId, user } = guard.ctx;
  const supabase = createClient();

  try {
    const validation = await validateRequestBody(request, InventorySettingsSchema);
    if (!validation.success) return validation.response;
    const body = validation.data;
    const {
      default_godown_id, low_stock_threshold, stock_valuation_method,
      allow_negative_stock, enable_batch_tracking, enable_serial_numbers,
    } = body;

    if (default_godown_id) {
      const { data: godown, error: godownError } = await supabase.from("godowns").select("id")
        .eq("id", default_godown_id).eq("business_id", businessId).is("deleted_at", null).maybeSingle();
      if (godownError) throw godownError;
      if (!godown) return NextResponse.json({ error: "Invalid default godown" }, { status: 400 });
    }

    // 1. Update business settings table
    const { error: setError } = await supabase
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          default_godown_id: default_godown_id || null,
          low_stock_threshold: Number(low_stock_threshold || 10),
          stock_valuation_method,
          allow_negative_stock: !!allow_negative_stock,
          enable_batch_tracking: !!enable_batch_tracking,
          enable_serial_numbers: !!enable_serial_numbers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // 2. Sync legacy business table fields
    const { error: legacyError } = await supabase
      .from("businesses")
      .update({
        enable_batch_tracking: !!enable_batch_tracking,
        allow_negative_stock: !!allow_negative_stock,
        low_stock_alerts: Number(low_stock_threshold) > 0,
      })
      .eq("id", businessId);
    if (legacyError) throw legacyError;

    void logAudit(businessId, "update", "inventory_settings", businessId, body, { actor_id: user.id }, request);

    return NextResponse.json({ success: true });
  } catch (err) { return handleApiError(err); }
}
