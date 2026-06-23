import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      name,
      logo_url,
      gstin,
      address,
      state,
      state_code,
      bank_details,
      bill_prefix_pakka,
      bill_prefix_kacha,
      design_prefix,
      design_separator,
      design_digits,
      is_primary,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Reset others to false if this is set as primary
    if (is_primary) {
      await supabase
        .from("brands")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    // Optimistic locking update query
    const { data: updatedBrand, error } = await supabase
      .from("brands")
      .update({
        name,
        logo_url: logo_url || null,
        gstin: gstin || null,
        address: address || null,
        state: state || null,
        state_code: state_code || null,
        bank_details: bank_details || null,
        bill_prefix_pakka: bill_prefix_pakka || null,
        bill_prefix_kacha: bill_prefix_kacha || null,
        design_prefix: design_prefix || null,
        design_separator: design_separator || ".",
        design_digits: Number(design_digits || 4),
        is_primary: !!is_primary,
        is_active: is_active !== false,
      })
      .eq("id", brandId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedBrand || updatedBrand.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Brand was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ brand: updatedBrand[0] });
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
  const brandId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete: update deleted_at instead of deleting row
    const { error } = await supabase
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", brandId)
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
