import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateAndStoreProfit } from "@/lib/utils/profit";

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
    // 1. Fetch authenticated user details to determine role
    const {
      data: { user: authUser }
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "User session not found" }, { status: 401 });
    }

    const { data: userProfile, error: profileErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (profileErr || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 403 });
    }

    const role = userProfile.role; // 'owner', 'admin', 'staff', etc.

    // 2. Fetch bill details, joining customer, items and charges
    const { data: bill, error: billErr } = await supabase
      .from("sale_bills")
      .select(`
        *,
        party:parties(*),
        items:sale_bill_items(*),
        charges:sale_bill_charges(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (billErr) {
      return NextResponse.json({ error: billErr.message }, { status: 500 });
    }
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // 3. Fetch profit margin conditionally (only for owner or admin)
    let profit = null;
    if (role === "owner" || role === "admin") {
      const { data: profitData } = await supabase
        .from("bill_profit")
        .select("*")
        .eq("bill_id", id)
        .maybeSingle();
      profit = profitData;
    }

    // 4. Fetch Brand & Brand Config
    let brand = null;
    let brandConfig = null;
    if (bill.brand_ids && bill.brand_ids.length > 0) {
      const { data: b } = await supabase
        .from("brands")
        .select("*")
        .eq("id", bill.brand_ids[0])
        .maybeSingle();
      brand = b;

      const { data: c } = await supabase
        .from("brand_bill_config")
        .select("*, bank_account:bank_accounts(*)")
        .eq("brand_id", bill.brand_ids[0])
        .maybeSingle();
      brandConfig = c;
    }

    const formattedBill = {
      ...bill,
      eway_details: bill.generate_eway_bill
        ? {
            generate_eway_bill: bill.generate_eway_bill,
            transporter: bill.eway_transporter,
            vehicle_no: bill.eway_vehicle_no,
            place_of_supply: bill.eway_place_of_supply,
            valid_till: bill.eway_valid_till,
          }
        : null
    };

    return NextResponse.json({ bill: formattedBill, profit, brand, brandConfig });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const {
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

    // Fetch existing bill first
    const { data: existingBill, error: fetchErr } = await supabase
      .from("sale_bills")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !existingBill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Recalculate totals
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

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

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

    // 1. Update bill properties
    const { error: billErr } = await supabase
      .from("sale_bills")
      .update({
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
        status,
        generate_eway_bill: eway_details?.generate_eway_bill || false,
        eway_transporter: eway_details?.transporter || null,
        eway_vehicle_no: eway_details?.vehicle_no || null,
        eway_place_of_supply: eway_details?.place_of_supply || null,
        eway_valid_till: eway_details?.valid_till || null
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (billErr) {
      return NextResponse.json({ error: billErr.message }, { status: 500 });
    }

    // 2. Delete old bill items and insert new ones
    await supabase.from("sale_bill_items").delete().eq("bill_id", id);
    const itemsToInsert = items.map((it: any) => ({
      business_id: businessId,
      bill_id: id,
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

    await supabase.from("sale_bill_items").insert(itemsToInsert);

    // 3. Delete old charges and insert new ones
    await supabase.from("sale_bill_charges").delete().eq("bill_id", id);
    if (charges && charges.length > 0) {
      const chargesToInsert = charges.map((c: any) => ({
        business_id: businessId,
        bill_id: id,
        charge_name: c.charge_name,
        charge_type: c.charge_type,
        is_taxable: c.is_taxable,
        amount: c.amount
      }));
      await supabase.from("sale_bill_charges").insert(chargesToInsert);
    }

    // 4. Update Profit
    const profitItems = items.map((it: any) => ({
      cost_per_piece: it.cost_per_piece || 0,
      quantity: it.quantity,
      amount: it.amount
    }));
    await calculateAndStoreProfit(supabase, id, businessId, profitItems, taxableChargesTotal + nonTaxableChargesTotal, discountAmount);

    // 5. Deduct Stock if transitioning from Draft to Active
    if (status === "active" && existingBill.status === "draft") {
      // Fetch default godown
      const { data: bSettings } = await supabase
        .from("business_settings")
        .select("default_godown_id")
        .eq("business_id", businessId)
        .maybeSingle();

      let godownId = bSettings?.default_godown_id;
      if (!godownId) {
        const { data: godowns } = await supabase
          .from("godowns")
          .select("id")
          .eq("business_id", businessId)
          .limit(1);
        if (godowns && godowns.length > 0) godownId = godowns[0].id;
      }

      if (godownId) {
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
          groupedStock[key].size_quantities[it.size] = (groupedStock[key].size_quantities[it.size] || 0) - it.quantity;
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

        await supabase.from("finished_stock").insert(stockRowsToInsert);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    // Soft delete / Cancel bill: set status = 'cancelled' and mark deleted_at
    const { error } = await supabase
      .from("sale_bills")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reverse Stock Deductions: If bill was active, insert reverse stock records!
    const { data: bill } = await supabase
      .from("sale_bills")
      .select("status")
      .eq("id", id)
      .single();

    const { data: billItems } = await supabase
      .from("sale_bill_items")
      .select("*")
      .eq("bill_id", id);

    if (billItems && billItems.length > 0) {
      // Find default godown
      const { data: bSettings } = await supabase
        .from("business_settings")
        .select("default_godown_id")
        .eq("business_id", businessId)
        .maybeSingle();

      let godownId = bSettings?.default_godown_id;
      if (!godownId) {
        const { data: godowns } = await supabase.from("godowns").select("id").eq("business_id", businessId).limit(1);
        if (godowns && godowns.length > 0) godownId = godowns[0].id;
      }

      if (godownId) {
        const groupedStock: Record<string, { design_id: string; colour_id: string; size_quantities: Record<string, number>; total_quantity: number; cost: number }> = {};
        
        billItems.forEach((it: any) => {
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
          // Positive quantities to reverse/add back the stock!
          groupedStock[key].size_quantities[it.size] = (groupedStock[key].size_quantities[it.size] || 0) + it.quantity;
          groupedStock[key].total_quantity += it.quantity;
        });

        const stockRowsToInsert = Object.values(groupedStock).map((row) => ({
          business_id: businessId,
          design_id: row.design_id,
          colour_id: row.colour_id || null,
          godown_id: godownId,
          entry_type: "sales_return", // recorded as sales_return ledger log
          size_quantities: row.size_quantities,
          total_quantity: row.total_quantity,
          cost_per_piece: row.cost,
          total_value: row.total_quantity * row.cost,
        }));

        await supabase.from("finished_stock").insert(stockRowsToInsert);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
