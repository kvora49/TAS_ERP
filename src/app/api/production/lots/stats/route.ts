import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get status counts
    const { data: lots, error } = await supabase
      .from("production_lots")
      .select("status, design_id, designs(id, name, code:design_number)")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = lots.length;
    const stats = {
      total,
      draft: lots.filter((l) => l.status === "draft").length,
      in_progress: lots.filter((l) => l.status === "in_progress").length,
      completed: lots.filter((l) => l.status === "completed").length,
      on_hold: lots.filter((l) => l.status === "on_hold").length,
      cancelled: lots.filter((l) => l.status === "cancelled").length,
    };

    // Calculate percentages
    const percentages = {
      in_progress: total > 0 ? ((stats.in_progress / total) * 100).toFixed(2) : "0",
      completed: total > 0 ? ((stats.completed / total) * 100).toFixed(2) : "0",
      on_hold: total > 0 ? ((stats.on_hold / total) * 100).toFixed(2) : "0",
      cancelled: total > 0 ? ((stats.cancelled / total) * 100).toFixed(2) : "0",
    };

    // 2. Calculate top designs
    const designCounts: Record<string, { name: string; code: string; count: number }> = {};
    lots.forEach((lot) => {
      if (lot.design_id && lot.designs) {
        const design = lot.designs as any;
        if (!designCounts[lot.design_id]) {
          designCounts[lot.design_id] = {
            name: design.name,
            code: design.code,
            count: 0,
          };
        }
        designCounts[lot.design_id].count += 1;
      }
    });

    const topDesigns = Object.values(designCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Get recent activities from audit logs
    const { data: audits } = await supabase
      .from("audit_log")
      .select("*")
      .eq("business_id", businessId)
      .in("table_name", ["production_lots", "stage_entries", "job_work_payments"])
      .order("created_at", { ascending: false })
      .limit(5);

    // Format audit activities to match layout spec
    const recentActivity = (audits || []).map((audit) => {
      let icon = "clipboard";
      let actionText = "";

      if (audit.table_name === "production_lots") {
        if (audit.action === "create") {
          actionText = `Created production lot: ${audit.new_values?.lot_number || "Lot"}`;
          icon = "create";
        } else if (audit.action === "update") {
          const status = audit.new_values?.status;
          if (status === "on_hold") {
            actionText = `Put production lot on hold: ${audit.new_values?.lot_number || "Lot"}`;
            icon = "on_hold";
          } else if (status === "cancelled") {
            actionText = `Cancelled production lot: ${audit.new_values?.lot_number || "Lot"}`;
            icon = "cancelled";
          } else if (status === "completed") {
            actionText = `Completed production lot: ${audit.new_values?.lot_number || "Lot"}`;
            icon = "completed";
          } else {
            actionText = `Updated production lot: ${audit.new_values?.lot_number || "Lot"}`;
            icon = "update";
          }
        }
      } else if (audit.table_name === "stage_entries") {
        actionText = `Logged stage entry: ${audit.new_values?.entry_number || "Entry"}`;
        icon = "stage_entry";
      } else if (audit.table_name === "job_work_payments") {
        actionText = `Recorded job worker payment: ${audit.new_values?.payment_number || "Payment"}`;
        icon = "payment";
      } else {
        actionText = `${audit.action} on ${audit.table_name}`;
      }

      return {
        id: audit.id,
        icon,
        actionText,
        userName: audit.user_name || "System",
        createdAt: audit.created_at,
      };
    });

    return NextResponse.json({
      stats,
      percentages,
      topDesigns,
      recentActivity,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
