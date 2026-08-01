import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function parseDaysFromTerms(terms?: string | null): number {
  if (!terms) return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function computeDueDate(billDateStr: string, dueDateStr: string | null, terms: string | null): string {
  if (dueDateStr) return dueDateStr;
  if (!billDateStr) return new Date().toISOString().split("T")[0];
  const d = new Date(billDateStr);
  const addDays = parseDaysFromTerms(terms);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().split("T")[0];
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayMs = new Date(todayStr).getTime();

    // 1. Fetch reminder schedule rules
    const { data: schedulesData } = await supabase
      .from("bill_reminder_schedules")
      .select("*")
      .eq("business_id", businessId);

    const scheduleMap = new Map<string, any>();
    (schedulesData || []).forEach((s) => {
      scheduleMap.set(`${s.bill_type}_${s.bill_id}`, s);
    });

    // 2. Fetch active unpaid sale bills (Receivables)
    const { data: salesBills } = await supabase
      .from("sale_bills")
      .select(`
        id, bill_number, bill_date, due_date, payment_terms, grand_total, paid_amount,
        payment_status, status, party:parties(id, name, company_name)
      `)
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("payment_status", "paid");

    // 3. Fetch active unpaid purchases (Payables)
    const { data: purchases } = await supabase
      .from("purchases")
      .select(`
        id, doc_number, invoice_no, invoice_date, due_date, payment_terms, grand_total, paid_amount,
        payment_status, status, supplier:parties(id, name, company_name)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("payment_status", "paid");

    const newNotifications: any[] = [];
    const updatedSchedules: any[] = [];

    // Evaluate Receivables
    (salesBills || []).forEach((b: any) => {
      const grandTotal = Number(b.grand_total || 0);
      const paidAmount = Number(b.paid_amount || 0);
      const outstanding = Math.max(0, grandTotal - paidAmount);
      if (outstanding <= 0) return;

      const effDueDate = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
      const dueMs = new Date(effDueDate).getTime();
      const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

      const schedKey = `receivable_${b.id}`;
      const sched = scheduleMap.get(schedKey);

      // Check if snoozed
      if (sched?.snoozed_until && sched.snoozed_until > todayStr) {
        return; // Snoozed until future date
      }

      const recurringInterval = sched?.recurring_interval_days || 2;
      const lastRemindedAt = sched?.last_reminded_at;

      let shouldRemind = false;
      if (!lastRemindedAt) {
        // First time
        shouldRemind = daysOverdue >= 0;
      } else {
        const lastRemindedMs = new Date(lastRemindedAt).getTime();
        const daysSinceLast = Math.floor((todayMs - lastRemindedMs) / (1000 * 60 * 60 * 24));
        if (daysSinceLast >= recurringInterval && daysOverdue >= 0) {
          shouldRemind = true;
        }
      }

      if (shouldRemind) {
        const partyName = b.party?.company_name || b.party?.name || "Customer";
        const title = daysOverdue > 0
          ? `🚨 Overdue Receivable: Bill #${b.bill_number}`
          : `⚠️ Payment Due Today: Bill #${b.bill_number}`;
        const message = daysOverdue > 0
          ? `Bill #${b.bill_number} for ${partyName} is overdue by ${daysOverdue} days. Outstanding: ₹${outstanding.toLocaleString("en-IN")}.`
          : `Bill #${b.bill_number} for ${partyName} of ₹${outstanding.toLocaleString("en-IN")} is due today.`;

        newNotifications.push({
          business_id: businessId,
          rule_type: "payment_receivable",
          title,
          message,
          link_url: `/sales/bills/${b.id}`,
          is_read: false,
        });

        updatedSchedules.push({
          business_id: businessId,
          bill_id: b.id,
          bill_type: "receivable",
          last_reminded_at: new Date().toISOString(),
          recurring_interval_days: recurringInterval,
        });
      }
    });

    // Evaluate Payables
    (purchases || []).forEach((p: any) => {
      const grandTotal = Number(p.grand_total || 0);
      const paidAmount = Number(p.paid_amount || 0);
      const outstanding = Math.max(0, grandTotal - paidAmount);
      if (outstanding <= 0) return;

      const effDueDate = computeDueDate(p.invoice_date, p.due_date, p.payment_terms);
      const dueMs = new Date(effDueDate).getTime();
      const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

      const schedKey = `payable_${p.id}`;
      const sched = scheduleMap.get(schedKey);

      // Check if snoozed
      if (sched?.snoozed_until && sched.snoozed_until > todayStr) {
        return;
      }

      const recurringInterval = sched?.recurring_interval_days || 2;
      const lastRemindedAt = sched?.last_reminded_at;

      let shouldRemind = false;
      if (!lastRemindedAt) {
        shouldRemind = daysOverdue >= 0;
      } else {
        const lastRemindedMs = new Date(lastRemindedAt).getTime();
        const daysSinceLast = Math.floor((todayMs - lastRemindedMs) / (1000 * 60 * 60 * 24));
        if (daysSinceLast >= recurringInterval && daysOverdue >= 0) {
          shouldRemind = true;
        }
      }

      if (shouldRemind) {
        const supplierName = p.supplier?.company_name || p.supplier?.name || "Supplier";
        const docNo = p.doc_number || p.invoice_no || "Purchase Bill";
        const title = daysOverdue > 0
          ? `🚨 Overdue Payable: ${docNo}`
          : `⚠️ Vendor Payment Due Today: ${docNo}`;
        const message = daysOverdue > 0
          ? `Purchase invoice ${docNo} to ${supplierName} is overdue by ${daysOverdue} days. Outstanding: ₹${outstanding.toLocaleString("en-IN")}.`
          : `Purchase invoice ${docNo} to ${supplierName} of ₹${outstanding.toLocaleString("en-IN")} is due today.`;

        newNotifications.push({
          business_id: businessId,
          rule_type: "payment_payable",
          title,
          message,
          link_url: `/purchases/${p.id}`,
          is_read: false,
        });

        updatedSchedules.push({
          business_id: businessId,
          bill_id: p.id,
          bill_type: "payable",
          last_reminded_at: new Date().toISOString(),
          recurring_interval_days: recurringInterval,
        });
      }
    });

    // Insert generated notifications
    if (newNotifications.length > 0) {
      await supabase.from("in_app_notifications").insert(newNotifications);
    }

    // Upsert updated schedule timestamps
    if (updatedSchedules.length > 0) {
      for (const s of updatedSchedules) {
        await supabase.from("bill_reminder_schedules").upsert(s, { onConflict: "business_id,bill_id,bill_type" });
      }
    }

    return NextResponse.json({
      success: true,
      evaluated: {
        receivables_checked: (salesBills || []).length,
        payables_checked: (purchases || []).length,
        notifications_created: newNotifications.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
