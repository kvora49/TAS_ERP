import { createClient } from "@supabase/supabase-js";
import { dispatchSystemPushAlert } from "@/lib/notifications/push-dispatcher";

export interface NotificationsJobOptions {
  force?: boolean;
}

export async function runNotificationsJob(options: NotificationsJobOptions = {}) {
  const startTime = performance.now();
  const { force = false } = options;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration for notifications job");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: businesses, error: bizErr } = await supabase.from("businesses").select("id, name");
    if (bizErr) throw bizErr;

    if (!businesses || businesses.length === 0) {
      return { success: true, message: "No active businesses for notifications", processed: 0, webPushSentCount: 0 };
    }

    const createdNotifications: any[] = [];
    let totalWebPushSent = 0;

    for (const biz of businesses) {
      // Fetch enabled notification rules for this business
      const { data: rules } = await supabase
        .from("notification_rules")
        .select("*")
        .eq("business_id", biz.id)
        .eq("is_enabled", true);

      if (!rules || rules.length === 0) continue;

      const { data: bSet } = await supabase
        .from("business_settings")
        .select("low_stock_threshold")
        .eq("business_id", biz.id)
        .maybeSingle();

      const defaultThreshold = Number(bSet?.low_stock_threshold || 10);

      for (const rule of rules) {
        const days = Number(rule.days_before || 0);

        // 1. Low Stock Rule
        if (rule.type === "low_stock") {
          const { data: stockItems } = await supabase
            .from("raw_material_current_stock")
            .select("current_stock, material_type:raw_material_types(name, reorder_level)")
            .eq("business_id", biz.id);

          (stockItems || []).forEach((item: any) => {
            const qty = Number(item.current_stock || 0);
            const threshold = Number(item.material_type?.reorder_level) || defaultThreshold;
            if (qty < threshold) {
              const name = item.material_type?.name || "Raw Material";
              createdNotifications.push({
                business_id: biz.id,
                target_roles: rule.target_roles || ["owner", "admin"],
                rule_type: "low_stock",
                title: "Low Stock Warning",
                message: `${name} has fallen below threshold (${qty} remaining, threshold: ${threshold}).`,
                link_url: "/stock/raw-materials",
              });
            }
          });
        }

        // 2. Overdue Payment Rule
        if (rule.type === "overdue") {
          const todayStr = new Date().toISOString().split("T")[0];
          const { data: overdueBills } = await supabase
            .from("sale_bills")
            .select("id, bill_number, due_date, grand_total")
            .eq("business_id", biz.id)
            .lt("due_date", todayStr)
            .neq("status", "paid")
            .limit(10);

          (overdueBills || []).forEach((bill: any) => {
            createdNotifications.push({
              business_id: biz.id,
              target_roles: rule.target_roles || ["owner", "admin"],
              rule_type: "overdue",
              title: "Payment Overdue Alert",
              message: `Sales invoice ${bill.bill_number} (₹${bill.grand_total}) is overdue.`,
              link_url: "/sales/bills",
            });
          });
        }

        // 3. Upcoming Payment Due Rule
        if (rule.type === "payment_due") {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + days);
          const dateStr = targetDate.toISOString().split("T")[0];

          const { data: dueBills } = await supabase
            .from("sale_bills")
            .select("id, bill_number, due_date, grand_total")
            .eq("business_id", biz.id)
            .eq("due_date", dateStr)
            .neq("status", "paid")
            .limit(10);

          (dueBills || []).forEach((bill: any) => {
            createdNotifications.push({
              business_id: biz.id,
              target_roles: rule.target_roles || ["owner", "admin"],
              rule_type: "payment_due",
              title: "Payment Due Soon",
              message: `Sales invoice ${bill.bill_number} is due in ${days} days.`,
              link_url: "/sales/bills",
            });
          });
        }

        // 4. Production Lot Complete Rule
        if (rule.type === "lot_complete") {
          const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: completedLots } = await supabase
            .from("production_lots")
            .select("id, lot_number, lot_name")
            .eq("business_id", biz.id)
            .eq("status", "completed")
            .gte("updated_at", yesterdayStr)
            .limit(5);

          (completedLots || []).forEach((lot: any) => {
            createdNotifications.push({
              business_id: biz.id,
              target_roles: rule.target_roles || ["owner", "admin", "manager"],
              rule_type: "lot_complete",
              title: "Production Lot Completed",
              message: `Lot ${lot.lot_number} (${lot.lot_name || "Lot"}) has finished production.`,
              link_url: "/production/lots",
            });
          });
        }
      }
    }

    // Deduplicate, insert unique notifications and dispatch mobile push
    if (createdNotifications.length > 0) {
      for (const notif of createdNotifications.slice(0, 20)) {
        let existing = null;
        if (!force) {
          const { data } = await supabase
            .from("in_app_notifications")
            .select("id")
            .eq("business_id", notif.business_id)
            .eq("rule_type", notif.rule_type)
            .eq("title", notif.title)
            .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
            .maybeSingle();
          existing = data;
        }

        if (!existing) {
          await supabase.from("in_app_notifications").insert(notif);

          // Dispatch Web Push notification to mobile devices
          const pushRes = await dispatchSystemPushAlert({
            businessId: notif.business_id,
            title: notif.title,
            message: notif.message,
            linkUrl: notif.link_url || "/",
            tag: `tas-erp-${notif.rule_type}`,
          });

          if (pushRes?.sentCount) {
            totalWebPushSent += pushRes.sentCount;
          }
        }
      }
    }

    const durationMs = performance.now() - startTime;
    console.log(`[PERF_TIMING] runNotificationsJob - ${durationMs.toFixed(2)}ms (processed: ${createdNotifications.length}, pushSent: ${totalWebPushSent})`);

    return {
      success: true,
      processed: createdNotifications.length,
      webPushSentCount: totalWebPushSent,
      durationMs,
    };
  } finally {
    const elapsed = performance.now() - startTime;
    console.log(`[PERF_TIMING] cron/notifications total duration - ${elapsed.toFixed(2)}ms`);
  }
}
