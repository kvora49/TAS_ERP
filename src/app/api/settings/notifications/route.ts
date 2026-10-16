import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api-response";
import { logAudit } from "@/lib/audit";

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
    // 1. Fetch settings and rules in parallel
    const [settingsResult, rulesResult] = await Promise.all([
      supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("notification_rules")
        .select("*")
        .eq("business_id", businessId)
    ]);

    let { data: settings, error: setError } = settingsResult;
    const { data: rules, error: rulesError } = rulesResult;

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }
    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    if (!settings) {
      const { data: newSettings } = await supabase
        .from("business_settings")
        .insert({ business_id: businessId })
        .select()
        .single();
      settings = newSettings;
    }

    // Do not create privileged configuration as a side effect of a read. The UI
    // receives defaults for display; an authorized PUT persists selected rules.
    if (!rules || rules.length === 0) {
      return NextResponse.json({
        settings: settings || {},
        rules: DEFAULT_RULES.map((rule) => ({
          type: rule.type, is_enabled: true, days_before: rule.days,
          target_roles: rule.roles, enable_email: true, enable_sms: false, enable_in_app: true,
        })),
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
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId, user } = guard.ctx;
  const supabase = createClient();

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

    if (notif_default_time != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(notif_default_time))) {
      return NextResponse.json({ error: "Invalid notification time" }, { status: 400 });
    }
    if (notif_email_reply_to != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(notif_email_reply_to))) {
      return NextResponse.json({ error: "Invalid notification reply-to email" }, { status: 400 });
    }
    if (rules && (!Array.isArray(rules) || rules.length > RULE_TYPES.length)) return NextResponse.json({ error: "Invalid notification rules" }, { status: 400 });
    for (const rule of rules || []) {
      if (!RULE_TYPES.includes(rule.type) || !Number.isInteger(Number(rule.days_before)) || Number(rule.days_before) < 0 || Number(rule.days_before) > 365 || !Array.isArray(rule.target_roles) || rule.target_roles.some((role: unknown) => !["owner", "admin", "manager", "accountant", "staff", "intern"].includes(String(role)))) {
        return NextResponse.json({ error: "Invalid notification rule" }, { status: 400 });
      }
    }

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

    void logAudit(businessId, "update", "notification_settings", businessId, { rule_count: rules?.length || 0 }, { actor_id: user.id }, request);

    return NextResponse.json({ success: true });
  } catch (err) { return handleApiError(err); }
}
