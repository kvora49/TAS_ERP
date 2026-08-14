import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function parseDaysFromTerms(terms?: string | null): number {
  if (!terms) return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function computeDueDate(
  billDateStr: string,
  dueDateStr: string | null,
  terms: string | null
): string {
  if (dueDateStr) return dueDateStr;
  if (!billDateStr) return new Date().toISOString().split("T")[0];
  const d = new Date(billDateStr);
  const addDays = parseDaysFromTerms(terms);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const businessId = await getSessionBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const todayMs = new Date(today).getTime();
    const notifications: any[] = [];

    // Fetch notification rules to respect user settings
    let enabledRules = new Set(["overdue", "payment_due", "low_stock"]); // defaults if no rules configured
    let paymentDueDaysBefore = 3;
    try {
      const { data: rules } = await supabase
        .from("notification_rules")
        .select("type, is_enabled, days_before")
        .eq("business_id", businessId);

      if (rules && rules.length > 0) {
        enabledRules = new Set(
          rules.filter((r: any) => r.is_enabled).map((r: any) => r.type)
        );
        const paymentDueRule = rules.find((r: any) => r.type === "payment_due");
        if (paymentDueRule?.days_before) {
          paymentDueDaysBefore = Number(paymentDueRule.days_before);
        }
      }
    } catch (_ignored) {}

    // --- 1. All Unpaid Sales Bills (Overdue + Payment Not Received) ---
    const { data: rawBills } = await supabase
      .from("sale_bills")
      .select(
        "id, bill_number, bill_date, due_date, payment_terms, grand_total, paid_amount, payment_status, status, party:parties(name, company_name)"
      )
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("payment_status", "paid")
      .limit(50);

    (rawBills || []).forEach((b: any) => {
      const grandTotal = Number(b.grand_total || 0);
      const paidAmount = Number(b.paid_amount || 0);
      const outstanding = Math.max(0, grandTotal - paidAmount);
      if (outstanding <= 0) return; // fully settled

      const effectiveDue = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
      const dueMs = new Date(effectiveDue).getTime();
      const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
      const party = b.party?.company_name || b.party?.name || "Customer";
      const isPartiallyPaid = paidAmount > 0;
      const amtStr = `₹${outstanding.toLocaleString("en-IN")}`;

      if (daysOverdue > 0) {
        // ── OVERDUE: past due date, payment outstanding ──
        if (enabledRules.has("overdue")) {
          const partialNote = isPartiallyPaid ? ` (partial payment received)` : ``;
          notifications.push({
            id: `overdue-${b.id}`,
            rule_type: "overdue",
            title: "Payment Overdue",
            message: `Invoice #${b.bill_number} (${party}) — ${amtStr} outstanding, overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}${partialNote}.`,
            link_url: "/sales/bills",
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: { bill_id: b.id, outstanding, daysOverdue, isPartiallyPaid },
          });
        }
      } else if (daysOverdue >= -paymentDueDaysBefore && daysOverdue <= 0) {
        // ── DUE SOON: within configured days_before window ──
        if (enabledRules.has("payment_due")) {
          const daysLeft = Math.abs(daysOverdue);
          const dueDateLabel = daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
          notifications.push({
            id: `due-soon-${b.id}`,
            rule_type: "payment_due",
            title: "Payment Due Soon",
            message: `Invoice #${b.bill_number} (${party}) — ${amtStr} due ${dueDateLabel}. Payment not yet received.`,
            link_url: "/sales/bills",
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: { bill_id: b.id, outstanding, daysLeft },
          });
        }
      } else if (!isPartiallyPaid && daysOverdue < -paymentDueDaysBefore) {
        // ── PAYMENT NOT RECEIVED: bill exists, no payment at all, not yet near due date ──
        // Only surface if the bill is > 7 days old (not brand-new)
        const billAgeMs = todayMs - new Date(b.bill_date).getTime();
        const billAgeDays = Math.floor(billAgeMs / (1000 * 60 * 60 * 24));
        if (billAgeDays >= 7 && enabledRules.has("payment_due")) {
          notifications.push({
            id: `no-payment-${b.id}`,
            rule_type: "payment_not_received",
            title: "Payment Not Received",
            message: `Invoice #${b.bill_number} (${party}) — ${amtStr} — no payment received yet. Due on ${effectiveDue}.`,
            link_url: "/sales/bills",
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: { bill_id: b.id, outstanding, billAgeDays, effectiveDue },
          });
        }
      }
    });

    // --- 2. Low Stock Raw Materials ---
    if (enabledRules.has("low_stock")) {
      const { data: bSet } = await supabase
        .from("business_settings")
        .select("low_stock_threshold")
        .eq("business_id", businessId)
        .maybeSingle();

      const defaultThreshold = Number(bSet?.low_stock_threshold || 10);

      const { data: stockItems } = await supabase
        .from("raw_material_current_stock")
        .select("current_stock, material_type:raw_material_types(name, reorder_level)")
        .eq("business_id", businessId);

      (stockItems || []).forEach((item: any) => {
        const qty = Number(item.current_stock || 0);
        const threshold =
          Number(item.material_type?.reorder_level) || defaultThreshold;
        if (qty < threshold) {
          const name = item.material_type?.name || "Raw Material";
          notifications.push({
            id: `lowstock-${name.replace(/\s+/g, "-").toLowerCase()}`,
            rule_type: "low_stock",
            title: "Low Stock Warning",
            message: `${name} — only ${qty} unit${qty !== 1 ? "s" : ""} left (minimum: ${threshold}).`,
            link_url: "/stock/raw-materials",
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    // --- 3. Persisted in_app_notifications (if table exists) ---
    try {
      const { data: persisted } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (persisted && persisted.length > 0) {
        const existingKeys = new Set(
          notifications.map((n) => `${n.rule_type}-${n.id}`)
        );
        for (const p of persisted) {
          if (!existingKeys.has(`${p.rule_type}-${p.id}`)) {
            notifications.push(p);
          }
        }
      }
    } catch (_ignored) {}

    // Sort newest first
    notifications.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err: any) {
    console.error("[notifications] GET error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient();
    const businessId = await getSessionBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    try {
      if (markAllRead) {
        await supabase
          .from("in_app_notifications")
          .update({ is_read: true })
          .eq("business_id", businessId)
          .eq("is_read", false);
      } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
        const realIds = notificationIds.filter(
          (id: string) =>
            !id.startsWith("overdue-") &&
            !id.startsWith("lowstock-") &&
            !id.startsWith("due-soon-") &&
            !id.startsWith("no-payment-")
        );
        if (realIds.length > 0) {
          await supabase
            .from("in_app_notifications")
            .update({ is_read: true })
            .in("id", realIds)
            .eq("business_id", businessId);
        }
      }
    } catch (_ignored) {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}
