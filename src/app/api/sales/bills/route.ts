import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateAndStoreProfit } from "@/lib/utils/profit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "pakka"; // 'pakka' or 'kacha'
  const partyId = searchParams.get("party_id");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  try {
    // 1. Fetch bills matching filters
    let query = supabase
      .from("sale_bills")
      .select("*, party:parties(name, gstin)", { count: "exact" })
      .eq("business_id", businessId)
      .eq("bill_type", type)
      .is("deleted_at", null)
      .order("bill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (partyId) {
      query = query.eq("party_id", partyId);
    }
    if (status) {
      query = query.eq("payment_status", status);
    }
    if (startDate) {
      query = query.gte("bill_date", startDate);
    }
    if (endDate) {
      query = query.lte("bill_date", endDate);
    }
    if (search) {
      query = query.or(`bill_number.ilike.%${search}%,reference_no.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: bills, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Fetch stats for the active type (Pakka or Kacha)
    const { data: allBills, error: statsErr } = await supabase
      .from("sale_bills")
      .select("grand_total, paid_amount, payment_status, due_date")
      .eq("business_id", businessId)
      .eq("bill_type", type)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    if (statsErr) {
      return NextResponse.json({ error: statsErr.message }, { status: 500 });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const stats = {
      totalBills: allBills.length,
      totalAmount: allBills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0),
      paidAmount: allBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0),
      outstandingAmount: allBills.reduce(
        (sum, b) => sum + (Number(b.grand_total || 0) - Number(b.paid_amount || 0)),
        0
      ),
      overdueBills: allBills.filter(
        (b) =>
          b.payment_status !== "paid" &&
          b.due_date &&
          b.due_date < todayStr
      ).length
    };

    return NextResponse.json({
      bills: bills || [],
      total: count || 0,
      page,
      limit,
      stats
    });
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
      bill_type, // 'pakka' or 'kacha'
      party_id,
      bill_date,
      due_date,
      payment_terms,
      reference_no,
      billing_address,
      phone,
      gstin,
      gst_treatment,
      transporter_name,
      vehicle_no,
      salesman,
      remarks,
      items, // array of items
      charges, // array of charges
      discount_type,
      discount_value,
      eway_details,
      status // 'active' or 'draft'
    } = body;

    if (!party_id || !bill_type || !bill_date) {
      return NextResponse.json({ error: "Party, Bill Type, and Bill Date are required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // 1. Generate sequential bill number
    let billNumber = "";
    if (status === "active") {
      const prefix = bill_type === "pakka" ? "INV-" : "KB-";
      const { data: lastBill, error: seqErr } = await supabase
        .from("sale_bills")
        .select("bill_number")
        .eq("business_id", businessId)
        .eq("bill_type", bill_type)
        .like("bill_number", `${prefix}%`)
        .order("bill_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seqErr) {
        return NextResponse.json({ error: seqErr.message }, { status: 500 });
      }

      let nextNum = 1;
      if (lastBill) {
        const numPart = lastBill.bill_number.replace(prefix, "");
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      billNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;
    } else {
      billNumber = `DRAFT-${Date.now()}`;
    }

    // 2. Fetch business settings to get default godown
    const { data: bSettings } = await supabase
      .from("business_settings")
      .select("default_godown_id")
      .eq("business_id", businessId)
      .maybeSingle();

    let godownId = bSettings?.default_godown_id;
    if (!godownId) {
      // Fallback: pick the first active godown
      const { data: godowns } = await supabase
        .from("godowns")
        .select("id")
        .eq("business_id", businessId)
        .limit(1);
      if (godowns && godowns.length > 0) {
        godownId = godowns[0].id;
      } else {
        return NextResponse.json({ error: "Please configure a godown in settings first" }, { status: 400 });
      }
    }

    // 3. Totals calculations
    const itemTotal = items.reduce((sum: number, it: any) => sum + (it.rate * it.quantity), 0);
    const itemTotalAfterDiscount = items.reduce(
      (sum: number, it: any) => sum + (it.rate * it.quantity * (1 - it.discount_percent / 100)),
      0
    );

    const taxableChargesTotal = (charges || [])
      .filter((c: any) => c.is_taxable)
      .reduce((sum: number, c: any) => {
        if (c.charge_type === "flat") return sum + Number(c.amount || 0);
        if (c.charge_type === "per_qty") {
          const totalQty = items.reduce((tot: number, it: any) => tot + Number(it.quantity || 0), 0);
          return sum + (Number(c.amount || 0) * totalQty);
        }
        if (c.charge_type === "percentage") {
          return sum + (itemTotalAfterDiscount * (Number(c.amount || 0) / 100));
        }
        return sum;
      }, 0);

    const nonTaxableChargesTotal = (charges || [])
      .filter((c: any) => !c.is_taxable)
      .reduce((sum: number, c: any) => {
        if (c.charge_type === "flat") return sum + Number(c.amount || 0);
        if (c.charge_type === "per_qty") {
          const totalQty = items.reduce((tot: number, it: any) => tot + Number(it.quantity || 0), 0);
          return sum + (Number(c.amount || 0) * totalQty);
        }
        if (c.charge_type === "percentage") {
          return sum + (itemTotalAfterDiscount * (Number(c.amount || 0) / 100));
        }
        return sum;
      }, 0);

    const subTotal = itemTotalAfterDiscount + taxableChargesTotal;
    
    let discountAmount = 0;
    if (discount_type === "flat") {
      discountAmount = discount_value;
    } else if (discount_type === "percentage") {
      discountAmount = subTotal * (discount_value / 100);
    }

    const taxableAmount = Math.max(0, subTotal - discountAmount);

    // GST Taxes splits
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    // Check Interstate from client or settings (first 2 digits of business GSTIN vs customer GSTIN)
    let isInterstate = false;
    if (gstin) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("gstin")
        .eq("id", businessId)
        .maybeSingle();

      if (biz?.gstin && biz.gstin.trim().substring(0, 2) !== gstin.trim().substring(0, 2)) {
        isInterstate = true;
      }
    }

    if (gst_treatment === "regular") {
      items.forEach((item: any) => {
        const share = itemTotalAfterDiscount > 0 ? item.amount / itemTotalAfterDiscount : 0;
        const itemShareOfSubtotal = item.amount + (taxableChargesTotal * share);
        const itemNetTaxableAfterDiscount = Math.max(0, itemShareOfSubtotal - (discountAmount * share));
        const itemGst = itemNetTaxableAfterDiscount * (item.tax_percent / 100);

        if (isInterstate) {
          igst += itemGst;
        } else {
          cgst += itemGst / 2;
          sgst += itemGst / 2;
        }
      });
    }

    const preRoundTotal = taxableAmount + cgst + sgst + igst + nonTaxableChargesTotal;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    // Fetch brand
    const { data: primaryBrand } = await supabase
      .from("brands")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_primary", true)
      .is("deleted_at", null)
      .maybeSingle();

    let brandIds: string[] = [];
    if (primaryBrand) {
      brandIds = [primaryBrand.id];
    } else {
      const { data: firstBrand } = await supabase
        .from("brands")
        .select("id")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(1);
      if (firstBrand && firstBrand.length > 0) {
        brandIds = [firstBrand[0].id];
      }
    }

    // 4. Save Sale Bill
    const { data: bill, error: billErr } = await supabase
      .from("sale_bills")
      .insert({
        business_id: businessId,
        brand_ids: brandIds,
        bill_number: billNumber,
        bill_type,
        party_id,
        bill_date,
        due_date: due_date || bill_date,
        payment_terms,
        reference_no: reference_no || null,
        billing_address: billing_address || null,
        phone: phone || null,
        gstin: gstin || null,
        gst_treatment,
        transporter_name: transporter_name || null,
        vehicle_no: vehicle_no || null,
        salesman: salesman || null,
        remarks: remarks || null,
        item_total: itemTotal,
        charges_total: taxableChargesTotal + nonTaxableChargesTotal,
        discount_type: discount_type || null,
        discount_value: discount_value || 0,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        cgst,
        sgst,
        igst,
        round_off: roundOff,
        grand_total: grandTotal,
        paid_amount: 0, // initially unpaid
        payment_status: "unpaid",
        status,
        generate_eway_bill: eway_details?.generate_eway_bill || false,
        eway_transporter: eway_details?.transporter || null,
        eway_vehicle_no: eway_details?.vehicle_no || null,
        eway_place_of_supply: eway_details?.place_of_supply || null,
        eway_valid_till: eway_details?.valid_till || null
      })
      .select()
      .single();

    if (billErr) {
      return NextResponse.json({ error: billErr.message }, { status: 500 });
    }

    // 5. Insert Sale Bill Items
    const itemsToInsert = items.map((it: any) => ({
      business_id: businessId,
      bill_id: bill.id,
      design_id: it.design_id,
      colour_id: it.colour_id,
      size: it.size,
      quantity: it.quantity,
      unit: it.unit || "Pcs",
      rate: it.rate,
      discount_percent: it.discount_percent || 0,
      tax_percent: it.tax_percent || 0,
      amount: it.amount,
      cost_per_piece: it.cost_per_piece || 0,
      description: it.description || null,
      hsn_sac: it.hsn_sac || null
    }));

    const { error: itemsErr } = await supabase
      .from("sale_bill_items")
      .insert(itemsToInsert);

    if (itemsErr) {
      // Soft rollback: delete the bill
      await supabase.from("sale_bills").delete().eq("id", bill.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // 6. Insert Sale Bill Charges
    if (charges && charges.length > 0) {
      const chargesToInsert = charges.map((c: any) => ({
        business_id: businessId,
        bill_id: bill.id,
        charge_name: c.charge_name,
        charge_type: c.charge_type,
        is_taxable: c.is_taxable,
        amount: c.amount
      }));

      const { error: chargesErr } = await supabase
        .from("sale_bill_charges")
        .insert(chargesToInsert);

      if (chargesErr) {
        // Soft rollback
        await supabase.from("sale_bills").delete().eq("id", bill.id);
        return NextResponse.json({ error: chargesErr.message }, { status: 500 });
      }
    }

    // 7. Calculate and Store Profit (server-side utility)
    const profitItems = items.map((it: any) => ({
      cost_per_piece: it.cost_per_piece || 0,
      quantity: it.quantity,
      amount: it.amount
    }));
    await calculateAndStoreProfit(supabase, bill.id, businessId, profitItems, taxableChargesTotal + nonTaxableChargesTotal, discountAmount);

    // 8. Deduct Stock if ACTIVE (not draft)
    if (status === "active") {
      // Sum quantities grouped by design/colour
      // For stock entries size_quantities is JSONB, and total_quantity is the sum
      // We will group the items by design_id & colour_id
      const groupedStock: Record<string, { design_id: string; colour_id: string; size_quantities: Record<string, number>; total_quantity: number; cost: number }> = {};
      
      items.forEach((it: any) => {
        const key = `${it.design_id}_${it.colour_id || "none"}`;
        if (!groupedStock[key]) {
          groupedStock[key] = {
            design_id: it.design_id,
            colour_id: it.colour_id,
            size_quantities: {},
            total_quantity: 0,
            cost: it.cost_per_piece || 0
          };
        }
        
        groupedStock[key].size_quantities[it.size] = (groupedStock[key].size_quantities[it.size] || 0) - it.quantity; // negative for stock out
        groupedStock[key].total_quantity -= it.quantity;
      });

      const stockRowsToInsert = Object.values(groupedStock).map((row) => ({
        business_id: businessId,
        design_id: row.design_id,
        colour_id: row.colour_id || null,
        godown_id: godownId,
        entry_type: "sales_bill",
        size_quantities: row.size_quantities,
        total_quantity: row.total_quantity,
        cost_per_piece: row.cost,
        total_value: row.total_quantity * row.cost,
      }));

      const { error: stockErr } = await supabase
        .from("finished_stock")
        .insert(stockRowsToInsert);

      if (stockErr) {
        console.error("Warning: Bill saved, but stock ledger entry failed:", stockErr.message);
      }
    }

    return NextResponse.json({ success: true, bill });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
