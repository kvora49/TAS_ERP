import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json().catch(() => ({}));
    const targetBillType = body.target_bill_type === "kacha" ? "kacha" : "pakka";

    // 1. Fetch current temporary bill
    const { data: bill, error: fetchErr } = await supabase
      .from("sale_bills")
      .select("*, items:sale_bill_items(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !bill) {
      return NextResponse.json({ error: "Temporary bill not found" }, { status: 404 });
    }

    const isTemp = bill.bill_number?.startsWith("TEMP-") || bill.remarks?.includes("[TEMPORARY]");
    if (!isTemp) {
      return NextResponse.json({ error: "This bill is already an official invoice" }, { status: 400 });
    }

    // 2. Generate official sequential bill number
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = targetBillType === "kacha" ? `KAC-${yyyy}-${mm}` : `INV-${yyyy}-${mm}`;

    const { data: bills } = await supabase
      .from("sale_bills")
      .select("bill_number")
      .eq("business_id", businessId)
      .eq("bill_type", targetBillType)
      .like("bill_number", `${prefix}-%`);

    let nextNum = 1;
    if (bills && bills.length > 0) {
      const nums = bills.map((b) => {
        if (!b.bill_number) return 0;
        const numPart = b.bill_number.substring(prefix.length + 1);
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      const maxNum = Math.max(...nums, 0);
      nextNum = maxNum + 1;
    }
    const officialBillNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;

    // 3. Write stock_ledger audit entries for the line items being converted to an official bill.
    //    finished_stock is rebuilt by reconcileFinishedStock() below — do NOT directly
    //    mutate finished_stock here (single-writer pattern).
    const items = bill.items || [];
    const { data: { user } } = await supabase.auth.getUser();

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0 || !item.design_id) continue;

      // Auto-resolve godown from finished_stock — no godown_id needed on the bill.
      // Pick the godown that currently holds the most stock for this design.
      const { data: stockRow } = await supabase
        .from("finished_stock")
        .select("godown_id, total_quantity")
        .eq("business_id", businessId)
        .eq("design_id", item.design_id)
        .gt("total_quantity", 0)
        .order("total_quantity", { ascending: false })
        .limit(1)
        .maybeSingle();

      let resolvedGodownId: string | null = stockRow?.godown_id || null;

      // Fallback: if no stock row found, use the first godown in the business
      if (!resolvedGodownId) {
        const { data: fallbackGodown } = await supabase
          .from("godowns")
          .select("id")
          .eq("business_id", businessId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        resolvedGodownId = fallbackGodown?.id || null;
      }

      if (resolvedGodownId) {
        await supabase.from("stock_ledger").insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: item.design_id,
          godown_id: resolvedGodownId,
          transaction_type: "sale_bill_outflow",
          quantity_delta: -qty,
          value_delta: -Number(item.amount || 0),
          reference_table: "sale_bills",
          reference_id: bill.id,
          created_by: user?.id || null,
        });
      }
    }

    // 4. Update bill to official bill
    const cleanRemarks = (bill.remarks || "").replace("[TEMPORARY]", "").trim();
    const { data: updatedBill, error: updateErr } = await supabase
      .from("sale_bills")
      .update({
        bill_type: targetBillType,
        bill_number: officialBillNumber,
        remarks: cleanRemarks || null,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // 5. Trigger ground-truth finished stock reconciliation
    try {
      const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
      const designIdsToReconcile = Array.from(new Set((items || []).map((it: any) => it.design_id).filter(Boolean)));
      for (const dId of designIdsToReconcile) {
        await reconcileFinishedStock(supabase, businessId, dId as string);
      }
    } catch (recErr) {
      console.warn("[ConvertBill] Finished stock reconciliation warning:", recErr);
    }

    return NextResponse.json({
      success: true,
      message: `Bill converted successfully to official invoice ${officialBillNumber}`,
      data: updatedBill,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
