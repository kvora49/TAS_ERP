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

    // 3. Deduct finished stock & insert stock_ledger entries for line items
    const items = bill.items || [];
    const { data: { user } } = await supabase.auth.getUser();

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;

      let { data: fsRows } = await supabase
        .from("finished_stock")
        .select("*")
        .eq("business_id", businessId)
        .eq("design_id", item.design_id);

      if (item.colour_id && fsRows && fsRows.length > 0) {
        const matchCol = fsRows.filter((r) => r.colour_id === item.colour_id);
        if (matchCol.length > 0) fsRows = matchCol;
      }

      if (bill.godown_id && fsRows && fsRows.length > 0) {
        const matchGodown = fsRows.filter((r) => r.godown_id === bill.godown_id);
        if (matchGodown.length > 0) fsRows = matchGodown;
      }

      const existingFs = fsRows && fsRows.length > 0 ? fsRows[0] : null;
      const godownId = existingFs?.godown_id || bill.godown_id;

      if (godownId) {
        await supabase.from("stock_ledger").insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: item.design_id,
          godown_id: godownId,
          transaction_type: "sale_bill_outflow",
          quantity_delta: -qty,
          value_delta: -Number(item.amount || 0),
          reference_table: "sale_bills",
          reference_id: bill.id,
          created_by: user?.id || null,
        });
      }

      if (existingFs) {
        const currentSizeQty = existingFs.size_quantities || {};
        const sz = item.size || "all";
        const currentSzQty = Number(currentSizeQty[sz] || 0);
        const newSzQty = Math.max(0, currentSzQty - qty);
        const newTotalQty = Math.max(0, Number(existingFs.total_quantity || 0) - qty);
        const costPerPiece = Number(
          existingFs.cost_per_piece ||
            (existingFs.total_quantity > 0 ? existingFs.total_value / existingFs.total_quantity : 0)
        );
        const newTotalValue = newTotalQty * costPerPiece;

        const updatedSizes = { ...currentSizeQty };
        if (sz !== "all") {
          updatedSizes[sz] = newSzQty;
        }

        await supabase
          .from("finished_stock")
          .update({
            size_quantities: updatedSizes,
            total_quantity: newTotalQty,
            total_value: newTotalValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFs.id);
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
