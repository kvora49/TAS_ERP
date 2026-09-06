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
    // 1. Fetch GST rate details
    const { data: gstRate, error: rateError } = await supabase
      .from("gst_rates")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (rateError || !gstRate) {
      return NextResponse.json({ error: "GST Rate not found" }, { status: 404 });
    }

    const cleanHsn = (gstRate.hsn_code || "").trim();

    // 2. Fetch raw materials and designs matching this HSN code in parallel
    const [rawMaterialsRes, designsRes] = await Promise.all([
      supabase
        .from("raw_material_types")
        .select("id, name, category, unit, is_active")
        .ilike("hsn_code", cleanHsn)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("designs")
        .select(`
          id,
          name,
          design_number,
          is_active,
          brand:brands(name)
        `)
        .ilike("hsn_code", cleanHsn)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("design_number", { ascending: true }),
    ]);

    return NextResponse.json({
      gstRate,
      rawMaterials: rawMaterialsRes.data || [],
      designs: designsRes.data || [],
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

    // Fetch existing record to check if HSN is being renamed
    const { data: existingRate } = await supabase
      .from("gst_rates")
      .select("hsn_code")
      .eq("id", gstRateId)
      .eq("business_id", businessId)
      .single();

    const oldHsn = (existingRate?.hsn_code || "").trim();
    const newHsn = (hsn_code || "").trim();

    // Optimistic locking update query
    const { data: updatedGstRate, error } = await supabase
      .from("gst_rates")
      .update({
        hsn_code: newHsn,
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

    // If HSN changed, cascade update referencing raw materials & designs to prevent orphaned references
    if (oldHsn && oldHsn.toLowerCase() !== newHsn.toLowerCase()) {
      await Promise.all([
        supabase
          .from("raw_material_types")
          .update({ hsn_code: newHsn })
          .eq("business_id", businessId)
          .ilike("hsn_code", oldHsn),
        supabase
          .from("designs")
          .update({ hsn_code: newHsn })
          .eq("business_id", businessId)
          .ilike("hsn_code", oldHsn),
      ]);
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
    // 1. Fetch the target GST rate to get its HSN code
    const { data: targetRate, error: fetchErr } = await supabase
      .from("gst_rates")
      .select("id, hsn_code")
      .eq("id", gstRateId)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !targetRate) {
      return NextResponse.json({ error: "GST rate not found" }, { status: 404 });
    }

    const cleanHsn = (targetRate.hsn_code || "").trim();

    // 2. Check for active references in Raw Materials and Designs
    const [rawMaterialsCountRes, designsCountRes] = await Promise.all([
      supabase
        .from("raw_material_types")
        .select("id", { count: "exact", head: true })
        .ilike("hsn_code", cleanHsn)
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("designs")
        .select("id", { count: "exact", head: true })
        .ilike("hsn_code", cleanHsn)
        .eq("business_id", businessId)
        .is("deleted_at", null),
    ]);

    const matCount = rawMaterialsCountRes.count || 0;
    const desCount = designsCountRes.count || 0;

    if (matCount > 0 || desCount > 0) {
      const parts = [];
      if (matCount > 0) parts.push(`${matCount} raw material(s)`);
      if (desCount > 0) parts.push(`${desCount} catalog design(s)`);
      return NextResponse.json(
        {
          error: `Cannot delete GST rate "${targetRate.hsn_code}": it is actively referenced by ${parts.join(" and ")}. Please reassign them to another HSN code first.`,
        },
        { status: 400 }
      );
    }

    // 3. Delete safely since no active items reference this code
    const { error } = await supabase
      .from("gst_rates")
      .delete()
      .eq("id", gstRateId)
      .eq("business_id", businessId);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Cannot delete GST rate because it is referenced in transactional records." },
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
