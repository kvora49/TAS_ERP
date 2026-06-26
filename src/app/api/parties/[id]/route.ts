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
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (partyError) {
      return NextResponse.json({ error: partyError.message }, { status: 404 });
    }

    const { data: bankDetails, error: bankError } = await supabase
      .from("party_bank_details")
      .select("*")
      .eq("party_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    return NextResponse.json({
      party: {
        ...party,
        bank_details: bankDetails || [],
      },
    });
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
      name,
      type,
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
      bank_details,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Party Name is required" }, { status: 400 });
    }
    if (!type || !Array.isArray(type) || type.length === 0) {
      return NextResponse.json({ error: "At least one Party Type is required" }, { status: 400 });
    }

    // Update party
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .update({
        name,
        type,
        phone: phone || null,
        whatsapp_number: whatsapp_number || null,
        company_name: company_name || null,
        email: email || null,
        website: website || null,
        gstin: gstin || null,
        pan: pan || null,
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
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (partyError) {
      return NextResponse.json({ error: partyError.message }, { status: 500 });
    }

    // Delete existing bank details and insert new ones
    await supabase
      .from("party_bank_details")
      .delete()
      .eq("party_id", id)
      .eq("business_id", businessId);

    if (bank_details && Array.isArray(bank_details) && bank_details.length > 0) {
      const banksToInsert = bank_details
        .filter((b: any) => b.bank_name && b.account_number && b.ifsc_code)
        .map((b: any) => ({
          business_id: businessId,
          party_id: id,
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
            warning: "Party updated, but bank details could not be updated: " + bankError.message,
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
    const { error } = await supabase
      .from("parties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
