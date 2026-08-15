import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
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
    // 1. Fetch Roll Master Data & Linked Purchase Information
    const { data: roll, error: rollError } = await supabase
      .from("purchase_rolls")
      .select(`
        id,
        roll_number,
        shade,
        meters,
        remaining_meters,
        width,
        weight_value,
        weight_unit,
        comment,
        created_at,
        purchase_item:raw_material_purchase_items (
          id,
          rate,
          quantity,
          material_type:raw_material_types(id, name, unit, category),
          purchase:raw_material_purchases (
            id,
            invoice_no,
            invoice_date,
            godown:godowns(id, name, code),
            supplier:parties(id, name, phone)
          )
        )
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (rollError || !roll) {
      return NextResponse.json({ error: "Roll not found" }, { status: 404 });
    }

    // 2. Fetch Production Lot Allocations
    const { data: lotAllocations } = await supabase
      .from("lot_rolls")
      .select(`
        id,
        allocated_meters,
        created_at,
        lot:production_lots (
          id,
          lot_number,
          lot_date,
          status,
          total_quantity,
          design:designs(id, name, design_number)
        )
      `)
      .eq("purchase_roll_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    // 3. Fetch Direct Fabric Sales (if any sale bills referenced this roll)
    const { data: saleBillItems } = await supabase
      .from("sale_bill_items")
      .select(`
        id,
        quantity,
        rate,
        amount,
        created_at,
        bill:sale_bills(id, bill_number, bill_date, status, party:parties(id, name))
      `)
      .eq("purchase_roll_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    // Build Chronological Timeline
    const timeline: Array<{
      id: string;
      type: "purchase_inward" | "lot_allocation" | "direct_sale" | "cutting_return" | "purchase_return" | "adjustment";
      date: string;
      title: string;
      description: string;
      quantityDelta: number;
      runningBalance?: number;
      referenceId?: string;
      referenceType?: string;
      referenceLabel?: string;
      metadata?: Record<string, any>;
    }> = [];

    const initialMeters = Number(roll.meters || 0);
    const purchaseInfo = (roll.purchase_item as any)?.purchase;
    const rate = Number((roll.purchase_item as any)?.rate || 0);
    const materialType = (roll.purchase_item as any)?.material_type;
    const godownName = purchaseInfo?.godown?.name || "Main Godown";

    // Event 1: Initial Purchase Inward
    timeline.push({
      id: `inward-${roll.id}`,
      type: "purchase_inward",
      date: purchaseInfo?.invoice_date || roll.created_at,
      title: "Purchase Inward Received",
      description: `Received ${initialMeters} ${materialType?.unit || "Meters"} from ${purchaseInfo?.supplier?.name || "Supplier"} at ₹${rate.toFixed(2)}/${materialType?.unit || "m"} into godown ${godownName}`,
      quantityDelta: initialMeters,
      referenceId: purchaseInfo?.id,
      referenceType: "purchase",
      referenceLabel: purchaseInfo?.invoice_no ? `Invoice #${purchaseInfo.invoice_no}` : undefined,
      metadata: {
        invoiceNo: purchaseInfo?.invoice_no,
        supplierName: purchaseInfo?.supplier?.name,
        godownName: godownName,
        rate: rate,
      },
    });

    // Event 2: Lot Allocations (exclude cancelled lots from consumption)
    let totalAllocated = 0;
    (lotAllocations || []).forEach((la: any) => {
      const lot = la.lot;
      const isCancelled = lot?.status === "cancelled";
      const allocatedQty = Number(la.allocated_meters || 0);

      if (!isCancelled) {
        totalAllocated += allocatedQty;
      }

      const designName = lot?.design?.name || "Garment Style";
      const designCode = lot?.design?.design_number;

      timeline.push({
        id: `alloc-${la.id}`,
        type: "lot_allocation",
        date: la.created_at || lot?.lot_date,
        title: isCancelled ? `Lot Allocation (Cancelled)` : `Allocated to Production Lot`,
        description: isCancelled
          ? `Allocated ${allocatedQty} ${materialType?.unit || "Meters"} for Lot ${lot?.lot_number || "Lot"} (Lot Cancelled — meters restored)`
          : `Issued ${allocatedQty} ${materialType?.unit || "Meters"} for Lot ${lot?.lot_number || "Lot"} (${designCode ? `${designCode} - ` : ""}${designName})`,
        quantityDelta: isCancelled ? 0 : -allocatedQty,
        referenceId: lot?.id,
        referenceType: "production_lot",
        referenceLabel: lot?.lot_number ? `Lot ${lot.lot_number}` : undefined,
        metadata: {
          lotId: lot?.id,
          lotNumber: lot?.lot_number,
          lotStatus: lot?.status,
          designName: designName,
          designCode: designCode,
          isCancelled: isCancelled,
        },
      });
    });

    // Event 3: Direct Sales
    let totalSold = 0;
    (saleBillItems || []).forEach((sbi: any) => {
      const bill = sbi.bill;
      const isCancelled = bill?.status === "cancelled";
      const soldQty = Number(sbi.quantity || 0);

      if (!isCancelled) {
        totalSold += soldQty;
      }

      timeline.push({
        id: `sale-${sbi.id}`,
        type: "direct_sale",
        date: sbi.created_at || bill?.bill_date,
        title: isCancelled ? "Direct Fabric Sale (Cancelled)" : "Direct Fabric Sale",
        description: isCancelled
          ? `Sold ${soldQty} ${materialType?.unit || "Meters"} to ${bill?.party?.name || "Customer"} (Bill Cancelled — meters restored)`
          : `Sold ${soldQty} ${materialType?.unit || "Meters"} to ${bill?.party?.name || "Customer"} via Invoice #${bill?.bill_number || "Bill"}`,
        quantityDelta: isCancelled ? 0 : -soldQty,
        referenceId: bill?.id,
        referenceType: "sale_bill",
        referenceLabel: bill?.bill_number ? `Bill #${bill.bill_number}` : undefined,
        metadata: {
          billId: bill?.id,
          billNumber: bill?.bill_number,
          customerName: bill?.party?.name,
          rate: Number(sbi.rate || 0),
          isCancelled: isCancelled,
        },
      });
    });

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let curBalance = 0;
    timeline.forEach((item) => {
      curBalance += item.quantityDelta;
      item.runningBalance = Math.max(0, curBalance);
    });

    // True audited consumption & remaining
    const totalConsumed = totalAllocated + totalSold;
    const remainingMeters = Math.max(0, initialMeters - totalConsumed);
    const utilizationPct = initialMeters > 0 ? Math.min(100, Math.round((totalConsumed / initialMeters) * 100)) : 0;

    let status: "in_stock" | "partially_used" | "exhausted" = "exhausted";
    if (remainingMeters >= initialMeters && remainingMeters > 0) {
      status = "in_stock";
    } else if (remainingMeters > 0) {
      status = "partially_used";
    }

    // Auto-heal / sync database column if it differed from audited balance
    if (Number(roll.remaining_meters) !== remainingMeters) {
      await supabase
        .from("purchase_rolls")
        .update({ remaining_meters: remainingMeters })
        .eq("id", roll.id);
    }

    return NextResponse.json({
      roll: {
        id: roll.id,
        roll_number: roll.roll_number,
        shade: roll.shade,
        width: roll.width,
        weight_value: roll.weight_value,
        weight_unit: roll.weight_unit,
        comment: roll.comment,
        initial_meters: initialMeters,
        remaining_meters: remainingMeters,
        consumed_meters: totalConsumed,
        utilization_pct: utilizationPct,
        status: status,
        rate: rate,
        material: {
          id: materialType?.id,
          name: materialType?.name,
          unit: materialType?.unit || "Meters",
          category: materialType?.category,
        },
        purchase: {
          id: purchaseInfo?.id,
          invoice_no: purchaseInfo?.invoice_no,
          invoice_date: purchaseInfo?.invoice_date,
          supplier_name: purchaseInfo?.supplier?.name,
          supplier_phone: purchaseInfo?.supplier?.phone,
          godown_name: godownName,
          godown_id: purchaseInfo?.godown?.id,
        },
        allocations_count: (lotAllocations || []).length,
        sales_count: (saleBillItems || []).length,
      },
      timeline,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
