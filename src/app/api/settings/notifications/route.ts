import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const RULE_TYPES = [
  "payment_due",
  "overdue",
  "pdc_reminder",
  "low_stock",
  "cheque_bounce",
  "stage_delay",
  "lot_complete",
  "write_off_alert",
];

const DEFAULT_RULES = [
  { type: "payment_due", label: "Payment Due Reminder", description: "Send alerts for invoices about to be due", days: 3, roles: ["owner", "admin"] },
  { type: "overdue", label: "Payment Overdue Alert", description: "Alert when sales invoices remain unpaid after due date", days: 1, roles: ["owner", "admin"] },
  { type: "pdc_reminder", label: "PDC Cheque Reminder", description: "Reminder for Post Dated Cheques maturing soon", days: 2, roles: ["owner", "admin", "accountant"] },
  { type: "low_stock", label: "Low Stock Alert", description: "Alert when raw material quantities cross minimum thresholds", days: 0, roles: ["owner", "admin"] },
  { type: "cheque_bounce", label: "Cheque Bounce Alert", description: "High priority warning when bank returns a cheque", days: 0, roles: ["owner", "admin", "accountant"] },
  { type: "stage_delay", label: "Stage Delay Alert", description: "Alert if a production batch stays at a stage longer than limit", days: 1, roles: ["owner", "admin"] },
  { type: "lot_complete", label: "Lot Completion Notification", description: "Notify manager when a production lot is finished", days: 0, roles: ["owner", "admin"] },
  { type: "write_off_alert", label: "Inventory Write-Off Alert", description: "Notification for inventory corrections or damages", days: 0, roles: ["owner", "admin"] },
];

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch general settings
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

    // 2. Fetch notification rules
    const { data: rules, error: rulesError } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("business_id", businessId);

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    // 3. Seed defaults if empty
    if (!rules || rules.length === 0) {
      const inserts = DEFAULT_RULES.map((r) => ({
        business_id: businessId,
        type: r.type,
        is_enabled: true,
        days_before: r.days,
        target_roles: r.roles,
        enable_email: true,
        enable_sms: false,
        enable_in_app: true,
      }));

      const { data: seeded, error: seedError } = await supabase
        .from("notification_rules")
        .insert(inserts)
        .select();

      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      return NextResponse.json({
        settings: settings || {},
        rules: seeded,
      });
    }

    return NextResponse.json({
      settings: settings || {},
      rules: rules || [],
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
      notif_default_time,
      notif_email_sender_name,
      notif_email_reply_to,
      notif_weekend,
      notif_holiday,
      rules, // Array of rule updates
    } = body;

    // 1. Update general settings
    const { error: setError } = await supabase
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          notif_default_time,
          notif_email_sender_name,
          notif_email_reply_to,
          notif_weekend: !!notif_weekend,
          notif_holiday: !!notif_holiday,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // 2. Bulk update specific notification rules
    if (rules && Array.isArray(rules)) {
      const upserts = rules.map((r: any) => ({
        id: r.id || undefined, // use existing UUID if present
        business_id: businessId,
        type: r.type,
        is_enabled: !!r.is_enabled,
        days_before: Number(r.days_before || 0),
        target_roles: r.target_roles || ["owner", "admin"],
        enable_email: !!r.enable_email,
        enable_sms: !!r.enable_sms,
        enable_in_app: !!r.enable_in_app,
        updated_at: new Date().toISOString(),
      }));

      const { error: rulesErr } = await supabase
        .from("notification_rules")
        .upsert(upserts, { onConflict: "business_id,type" });

      if (rulesErr) {
        return NextResponse.json({ error: rulesErr.message }, { status: 500 });
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
