import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: challans, error } = await supabase
      .from("challans")
      .select("*, from_godown:godowns(name), to_party:parties(name, company_name)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("challan_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challans });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      challan_date,
      challan_type,
      from_godown_id,
      to_party_id,
      reference_no,
      remarks,
      transporter,
      lr_awb_no,
      eway_bill_no,
      status = 'pending',
      items // array of challan items
    } = body;

    // Validate inputs
    if (!challan_date || !challan_type || !from_godown_id || !to_party_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    // Auto-generate challan number (CH-YYYY-XXXX)
    const year = new Date(challan_date).getFullYear() || new Date().getFullYear();
    const { data: lastCh } = await supabase
      .from("challans")
      .select("challan_number")
      .eq("business_id", businessId)
      .like("challan_number", `CH-${year}-%`)
      .order("challan_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastCh && lastCh.length > 0 && lastCh[0].challan_number) {
      const parts = lastCh[0].challan_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const challanNumber = `CH-${year}-${String(nextNum).padStart(4, "0")}`;

    // Calculate totals
    let totalQuantity = 0;
    let totalValue = 0;
    items.forEach((item) => {
      totalQuantity += Number(item.quantity || 0);
      totalValue += Number(item.total_value || 0);
    });

    // Insert challan header
    const { data: challan, error: chErr } = await supabase
      .from("challans")
      .insert({
        business_id: businessId,
        challan_number: challanNumber,
        challan_date,
        challan_type,
        from_godown_id,
        to_party_id,
        reference_no: reference_no || null,
        remarks: remarks || null,
        transporter: transporter || null,
        lr_awb_no: lr_awb_no || null,
        eway_bill_no: eway_bill_no || null,
        total_quantity: totalQuantity,
        total_value: totalValue,
        status
      })
      .select()
      .single();

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    // Insert challan items
    const challanItemsToInsert = items.map((item) => ({
      business_id: businessId,
      challan_id: challan.id,
      design_id: item.design_id,
      colour_id: item.colour_id,
      size: item.size,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
      total_value: Number(item.total_value),
    }));

    const { error: itemsErr } = await supabase
      .from("challan_items")
      .insert(challanItemsToInsert);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // Log stock movements in finished_stock
    // Outward: Deduct on status dispatched, received, completed, in_transit?
    // User agreed: Deduct on dispatched (outward) / add on received (inward)
    const isOutwardStockImpact = challan_type === "outward" && ["dispatched", "received", "completed"].includes(status);
    const isInwardStockImpact = challan_type === "inward" && ["received", "completed"].includes(status);

    if (isOutwardStockImpact) {
      for (const item of items) {
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: from_godown_id,
            entry_type: "challan_out",
            size_quantities: { [item.size]: -Number(item.quantity) },
            total_quantity: -Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: -Number(item.total_value),
          });
      }
    } else if (isInwardStockImpact) {
      for (const item of items) {
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: from_godown_id,
            entry_type: "challan_in",
            size_quantities: { [item.size]: Number(item.quantity) },
            total_quantity: Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: Number(item.total_value),
          });
      }
    }

    return NextResponse.json({ challan });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
