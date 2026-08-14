import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { dispatchSystemPushAlert } from "@/lib/notifications/push-dispatcher";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET || "tas-erp-cron-secret";

  if (secret !== cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: businesses } = await supabase.from("businesses").select("id, name");
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ message: "No active businesses for notifications" });
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
            if (qty > 0 && qty < threshold) {
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
        const { data: existing } = await supabase
          .from("in_app_notifications")
          .select("id")
          .eq("business_id", notif.business_id)
          .eq("rule_type", notif.rule_type)
          .eq("title", notif.title)
          .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

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

    return NextResponse.json({
      success: true,
      processed: createdNotifications.length,
      webPushSentCount: totalWebPushSent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Cron notification runner failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

