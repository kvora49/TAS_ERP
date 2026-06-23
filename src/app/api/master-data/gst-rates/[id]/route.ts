import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const gstRateId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      hsn_code,
      description,
      gst_percent,
      auto_tier,
      tier_threshold,
      tier_low_gst,
      tier_high_gst,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!hsn_code || gst_percent === undefined || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "HSN Code, Base GST Percent, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedGstRate, error } = await supabase
      .from("gst_rates")
      .update({
        hsn_code,
        description: description || null,
        gst_percent: Number(gst_percent),
        auto_tier: !!auto_tier,
        tier_threshold: auto_tier ? Number(tier_threshold || 1000) : null,
        tier_low_gst: auto_tier ? Number(tier_low_gst || 5) : null,
        tier_high_gst: auto_tier ? Number(tier_high_gst || 12) : null,
        is_active: is_active !== false,
      })
      .eq("id", gstRateId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedGstRate || updatedGstRate.length === 0) {
      return NextResponse.json(
        { error: "Conflict: GST Rate was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ gstRate: updatedGstRate[0] });
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
  const gstRateId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hard delete since gst_rates does not have deleted_at
    const { error } = await supabase
      .from("gst_rates")
      .delete()
      .eq("id", gstRateId)
      .eq("business_id", businessId);

    if (error) {
      // Check if item is referenced as a foreign key somewhere
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Cannot delete GST rate because it is referenced in transactional logs." },
          { status: 400 }
        );
      }
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
