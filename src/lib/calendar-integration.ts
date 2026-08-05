/**
 * lib/calendar-integration.ts
 *
 * Shared helper for ERP modules to auto-create calendar entries
 * when key business events occur (bills created, lots started, etc.)
 *
 * Used as fire-and-forget: void createCalendarEntry(...)
 * Never throws — any error is swallowed so it never breaks ERP flows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CalendarEntryPayload {
  business_id: string;
  entry_type: "note" | "reminder" | "task" | "journal" | "event";
  title: string;
  content?: string;
  entry_date: string;          // YYYY-MM-DD
  entry_time?: string;         // HH:MM
  end_date?: string;
  is_all_day?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "pending" | "in_progress" | "completed" | "cancelled" | "overdue";
  category?: string;
  tags?: string[];
  erp_module?: string;
  erp_entity_id?: string;
  erp_entity_type?: string;
  erp_entity_label?: string;
  person_responsible?: string;
  created_by?: string | null;
  // For reminders: auto-create a calendar_reminders row
  reminder?: {
    notify_before_minutes: number;
    repeat_type?: "never" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
    repeat_interval?: number;
    repeat_end_date?: string;
  };
}

/**
 * Creates a calendar entry linked to an ERP event.
 * Always called fire-and-forget — does not throw.
 */
export async function createERPCalendarEntry(
  supabase: SupabaseClient,
  payload: CalendarEntryPayload
): Promise<string | null> {
  try {
    const {
      reminder,
      ...entryData
    } = payload;

    const insertData = {
      business_id: entryData.business_id,
      entry_type: entryData.entry_type,
      title: entryData.title,
      content: entryData.content || null,
      entry_date: entryData.entry_date,
      entry_time: entryData.entry_time || null,
      end_date: entryData.end_date || null,
      is_all_day: entryData.is_all_day ?? true,
      priority: entryData.priority || "medium",
      status: entryData.status || "pending",
      category: entryData.category || "general",
      tags: entryData.tags || [],
      erp_module: entryData.erp_module || null,
      erp_entity_id: entryData.erp_entity_id || null,
      erp_entity_type: entryData.erp_entity_type || null,
      erp_entity_label: entryData.erp_entity_label || null,
      person_responsible: entryData.person_responsible || null,
      created_by: entryData.created_by || null,
    };

    const { data: entry, error: entryError } = await supabase
      .from("calendar_entries")
      .insert(insertData)
      .select("id")
      .single();

    if (entryError || !entry) {
      console.error("[CalendarIntegration] Failed to create entry:", entryError?.message);
      return null;
    }

    // Create reminder schedule if provided
    if (reminder && entryData.entry_time) {
      // Calculate remind_at from entry_date + entry_time - notify_before_minutes
      const entryDateTime = new Date(`${entryData.entry_date}T${entryData.entry_time}:00`);
      entryDateTime.setMinutes(entryDateTime.getMinutes() - reminder.notify_before_minutes);

      const { error: reminderError } = await supabase
        .from("calendar_reminders")
        .insert({
          business_id: entryData.business_id,
          entry_id: entry.id,
          remind_at: entryDateTime.toISOString(),
          notify_before_minutes: reminder.notify_before_minutes,
          repeat_type: reminder.repeat_type || "never",
          repeat_interval: reminder.repeat_interval || null,
          repeat_end_date: reminder.repeat_end_date || null,
        });

      if (reminderError) {
        console.error("[CalendarIntegration] Failed to create reminder:", reminderError.message);
      }
    }

    return entry.id;
  } catch (err: any) {
    console.error("[CalendarIntegration] Unexpected error:", err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Convenience factories for each ERP module
// ─────────────────────────────────────────────────────────────

/**
 * Called when a Sales Bill is created.
 * Creates a payment follow-up reminder on the due date.
 */
export async function onSalesBillCreated(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    billId: string;
    billNumber: string;
    partyName: string;
    dueDate: string;
    grandTotal: number;
    createdBy: string | null;
  }
) {
  const { businessId, billId, billNumber, partyName, dueDate, grandTotal, createdBy } = params;

  // 1. Payment due reminder on due date
  void createERPCalendarEntry(supabase, {
    business_id: businessId,
    entry_type: "reminder",
    title: `Payment Due — ${partyName}`,
    content: `Invoice ${billNumber} of ₹${grandTotal.toLocaleString("en-IN")} is due from ${partyName}.`,
    entry_date: dueDate,
    entry_time: "10:00",
    is_all_day: false,
    priority: "high",
    status: "pending",
    category: "payments",
    tags: ["payment", "receivable"],
    erp_module: "sales",
    erp_entity_id: billId,
    erp_entity_type: "sale_bill",
    erp_entity_label: `Invoice #${billNumber}`,
    created_by: createdBy,
    reminder: {
      notify_before_minutes: 60, // 1 hour before due date
      repeat_type: "never",
    },
  });

  // 2. Follow-up reminder 3 days before due date
  const followUpDate = new Date(dueDate);
  followUpDate.setDate(followUpDate.getDate() - 3);
  const followUpDateStr = followUpDate.toISOString().split("T")[0];

  // Only create follow-up if due date is more than 3 days away
  if (followUpDate > new Date()) {
    void createERPCalendarEntry(supabase, {
      business_id: businessId,
      entry_type: "reminder",
      title: `Follow-up: Payment from ${partyName}`,
      content: `Invoice ${billNumber} payment due in 3 days. Consider sending a reminder.`,
      entry_date: followUpDateStr,
      entry_time: "09:30",
      is_all_day: false,
      priority: "medium",
      status: "pending",
      category: "sales",
      tags: ["follow-up", "receivable"],
      erp_module: "sales",
      erp_entity_id: billId,
      erp_entity_type: "sale_bill",
      erp_entity_label: `Invoice #${billNumber}`,
      created_by: createdBy,
    });
  }
}

/**
 * Called when a Purchase Bill is created.
 * Creates supplier payment reminder and material tracking.
 */
export async function onPurchaseBillCreated(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    billId: string;
    billNumber: string;
    supplierName: string;
    invoiceDate: string;
    grandTotal: number;
    createdBy: string | null;
    expectedDeliveryDate?: string;
  }
) {
  const { businessId, billId, billNumber, supplierName, invoiceDate, grandTotal, createdBy, expectedDeliveryDate } = params;

  // 1. Supplier payment reminder (7 days after invoice)
  const paymentDate = new Date(invoiceDate);
  paymentDate.setDate(paymentDate.getDate() + 7);
  const paymentDateStr = paymentDate.toISOString().split("T")[0];

  void createERPCalendarEntry(supabase, {
    business_id: businessId,
    entry_type: "reminder",
    title: `Pay Supplier — ${supplierName}`,
    content: `Purchase invoice ${billNumber} of ₹${grandTotal.toLocaleString("en-IN")} from ${supplierName}. Arrange payment.`,
    entry_date: paymentDateStr,
    entry_time: "11:00",
    is_all_day: false,
    priority: "high",
    status: "pending",
    category: "payments",
    tags: ["payment", "supplier"],
    erp_module: "purchase",
    erp_entity_id: billId,
    erp_entity_type: "purchase_bill",
    erp_entity_label: `PO #${billNumber}`,
    created_by: createdBy,
    reminder: {
      notify_before_minutes: 120,
      repeat_type: "never",
    },
  });

  // 2. Material arrival follow-up
  if (expectedDeliveryDate) {
    void createERPCalendarEntry(supabase, {
      business_id: businessId,
      entry_type: "event",
      title: `Material Arrival — ${supplierName}`,
      content: `Expected delivery for PO ${billNumber}. Arrange inspection and stock update.`,
      entry_date: expectedDeliveryDate,
      is_all_day: true,
      priority: "medium",
      status: "pending",
      category: "purchase",
      tags: ["material", "delivery"],
      erp_module: "purchase",
      erp_entity_id: billId,
      erp_entity_type: "purchase_bill",
      erp_entity_label: `PO #${billNumber}`,
      created_by: createdBy,
    });
  }
}

/**
 * Called when a Production Lot is created.
 * Creates events for production milestones.
 */
export async function onProductionLotCreated(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    lotId: string;
    lotNumber: string;
    lotName?: string;
    startDate: string;
    targetCompletionDate?: string;
    createdBy: string | null;
  }
) {
  const { businessId, lotId, lotNumber, lotName, startDate, targetCompletionDate, createdBy } = params;
  const displayName = lotName ? `${lotNumber} — ${lotName}` : lotNumber;

  // 1. Production start event
  void createERPCalendarEntry(supabase, {
    business_id: businessId,
    entry_type: "event",
    title: `Production Start — Lot ${displayName}`,
    content: `Production lot ${displayName} has been initiated. Monitor progress daily.`,
    entry_date: startDate,
    is_all_day: true,
    priority: "medium",
    status: "pending",
    category: "production",
    tags: ["production", "lot"],
    erp_module: "production",
    erp_entity_id: lotId,
    erp_entity_type: "production_lot",
    erp_entity_label: `Lot #${lotNumber}`,
    created_by: createdBy,
  });

  // 2. Target completion event (if date provided)
  if (targetCompletionDate) {
    void createERPCalendarEntry(supabase, {
      business_id: businessId,
      entry_type: "reminder",
      title: `Lot Completion Target — ${displayName}`,
      content: `Production lot ${displayName} target completion date. Verify quality check and dispatch readiness.`,
      entry_date: targetCompletionDate,
      entry_time: "09:00",
      is_all_day: false,
      priority: "high",
      status: "pending",
      category: "production",
      tags: ["production", "deadline"],
      erp_module: "production",
      erp_entity_id: lotId,
      erp_entity_type: "production_lot",
      erp_entity_label: `Lot #${lotNumber}`,
      created_by: createdBy,
      reminder: {
        notify_before_minutes: 1440, // 1 day before
        repeat_type: "never",
      },
    });
  }
}

/**
 * Called when a payment is received.
 * Creates a follow-up for any outstanding balance.
 */
export async function onPaymentReceived(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    paymentId: string;
    partyName: string;
    amount: number;
    paymentDate: string;
    createdBy: string | null;
  }
) {
  const { businessId, paymentId, partyName, amount, paymentDate, createdBy } = params;

  void createERPCalendarEntry(supabase, {
    business_id: businessId,
    entry_type: "note",
    title: `Payment Received — ${partyName}`,
    content: `Received ₹${amount.toLocaleString("en-IN")} from ${partyName} on ${new Date(paymentDate).toLocaleDateString("en-IN")}.`,
    entry_date: paymentDate,
    is_all_day: true,
    priority: "low",
    status: "completed",
    category: "payments",
    tags: ["payment", "received"],
    erp_module: "payments",
    erp_entity_id: paymentId,
    erp_entity_type: "payment",
    erp_entity_label: `Payment from ${partyName}`,
    created_by: createdBy,
  });
}
