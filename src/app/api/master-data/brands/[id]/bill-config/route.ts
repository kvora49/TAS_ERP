import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const brandId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: config, error } = await supabase
      .from("brand_bill_config")
      .select("*")
      .eq("brand_id", brandId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!config) {
      // Return defaults if configuration does not exist
      return NextResponse.json({
        config: {
          brand_id: brandId,
          business_id: businessId,
          pakka_template_id: "00000000-0000-0000-0000-000000000001", // Default classic
          kacha_template_id: "00000000-0000-0000-0000-000000000001",
          primary_color: "#6366F1",
          show_hsn: true,
          show_batch_no: false,
          show_discount_column: true,
          show_transport_details: true,
          header_text: "",
          footer_text: "Thank you for your business!",
          signature_name: "",
          signature_designation: "Authorized Signatory",
          bank_account_id: null
        }
      });
    }

    return NextResponse.json({ config });
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
  const brandId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      pakka_template_id,
      kacha_template_id,
      primary_color,
      header_text,
      footer_text,
      signature_name,
      signature_designation,
      show_hsn,
      show_batch_no,
      show_discount_column,
      show_transport_details,
      bank_account_id,
      uploaded_reference_file_url,
      extracted_config
    } = body;

    // Upsert the brand configuration (UNIQUE on business_id & brand_id)
    const { data: config, error } = await supabase
      .from("brand_bill_config")
      .upsert({
        business_id: businessId,
        brand_id: brandId,
        pakka_template_id: pakka_template_id || null,
        kacha_template_id: kacha_template_id || null,
        primary_color: primary_color || "#6366F1",
        header_text: header_text || null,
        footer_text: footer_text || null,
        signature_name: signature_name || null,
        signature_designation: signature_designation || null,
        show_hsn: show_hsn !== false,
        show_batch_no: !!show_batch_no,
        show_discount_column: show_discount_column !== false,
        show_transport_details: show_transport_details !== false,
        bank_account_id: bank_account_id || null,
        uploaded_reference_file_url: uploaded_reference_file_url || null,
        extracted_config: extracted_config || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "business_id,brand_id"
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
