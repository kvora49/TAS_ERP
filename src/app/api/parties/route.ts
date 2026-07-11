import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // e.g. 'supplier', 'customer', 'worker'
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("parties")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (type) {
      query = query.contains("type", [type]);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,code.ilike.%${search}%,billing_city.ilike.%${search}%,billing_state.ilike.%${search}%`);
    }

    const { data: parties, error } = await query.order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ parties });
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
      name,
      type, // array of strings
      phone,
      whatsapp_number,
      company_name,
      email,
      website,
      gstin,
      pan,
      aadhar,
      msme_number,
      tan,
      code,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_pincode,
      shipping_address_line1,
      shipping_address_line2,
      shipping_city,
      shipping_state,
      shipping_pincode,
      payment_terms,
      credit_limit,
      opening_balance,
      opening_balance_date,
      currency,
      default_purchase_account,
      default_godown_id,
      remarks,
      status,
      contact_numbers,
      bank_details, // array of bank details
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Party Name is required" }, { status: 400 });
    }
    if (!type || !Array.isArray(type) || type.length === 0) {
      return NextResponse.json({ error: "At least one Party Type is required" }, { status: 400 });
    }

    // Insert party
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .insert({
        business_id: businessId,
        name,
        type,
        phone: phone || null,
        whatsapp_number: whatsapp_number || null,
        company_name: company_name || null,
        email: email || null,
        website: website || null,
        gstin: gstin && gstin.trim() ? gstin.trim() : "URP",
        pan: pan && pan.trim() ? pan.trim() : "N/A",
        aadhar: aadhar || null,
        msme_number: msme_number || null,
        tan: tan || null,
        code: code || null,
        billing_address_line1: billing_address_line1 || null,
        billing_address_line2: billing_address_line2 || null,
        billing_city: billing_city || null,
        billing_state: billing_state || null,
        billing_pincode: billing_pincode || null,
        shipping_address_line1: shipping_address_line1 || null,
        shipping_address_line2: shipping_address_line2 || null,
        shipping_city: shipping_city || null,
        shipping_state: shipping_state || null,
        shipping_pincode: shipping_pincode || null,
        payment_terms: payment_terms || '30_days',
        credit_limit: credit_limit ? Number(credit_limit) : 0,
        opening_balance: opening_balance ? Number(opening_balance) : 0,
        opening_balance_date: opening_balance_date || null,
        currency: currency || 'INR',
        default_purchase_account: default_purchase_account || null,
        default_godown_id: default_godown_id || null,
        remarks: remarks || null,
        status: status || 'active',
        contact_numbers: contact_numbers || [],
      })
      .select()
      .single();

    if (partyError) {
      return NextResponse.json({ error: partyError.message }, { status: 500 });
    }

    // Handle bank details if provided
    if (bank_details && Array.isArray(bank_details) && bank_details.length > 0) {
      const banksToInsert = bank_details
        .filter((b: any) => b.bank_name && b.account_number && b.ifsc_code)
        .map((b: any) => ({
          business_id: businessId,
          party_id: party.id,
          bank_name: b.bank_name,
          account_number: b.account_number,
          ifsc_code: b.ifsc_code,
          branch: b.branch || null,
          is_primary: !!b.is_primary,
        }));

      if (banksToInsert.length > 0) {
        const { error: bankError } = await supabase
          .from("party_bank_details")
          .insert(banksToInsert);

        if (bankError) {
          return NextResponse.json({
            party,
            warning: "Party created, but bank details could not be saved: " + bankError.message,
          });
        }
      }
    }

    return NextResponse.json({ party });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
