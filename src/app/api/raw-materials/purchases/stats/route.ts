import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: purchases, error } = await supabase
      .from("raw_material_purchases")
      .select("grand_total, paid_amount, payment_status")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let totalPurchases = 0;
    let totalPaid = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let paidCount = 0;

    if (purchases) {
      purchases.forEach((p) => {
        const total = Number(p.grand_total || 0);
        const paid = Number(p.paid_amount || 0);
        totalPurchases += total;
        totalPaid += paid;

        if (p.payment_status === "paid") {
          paidCount++;
        } else if (p.payment_status === "partial") {
          partialCount++;
        } else {
          unpaidCount++;
        }
      });
    }

    const totalDue = totalPurchases - totalPaid;

    return NextResponse.json({
      stats: {
        totalPurchases,
        totalPaid,
        totalDue,
        unpaidCount,
        partialCount,
        paidCount,
        totalCount: purchases?.length || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
