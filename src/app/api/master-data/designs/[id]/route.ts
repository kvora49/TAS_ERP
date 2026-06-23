import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const designId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      brand_id,
      design_number,
      name,
      category,
      sub_category,
      season,
      gender,
      hsn_code,
      description,
      images,
      size_set_id,
      sale_price,
      is_active,
      colours, // Array of { colour_name: string, colour_hex?: string, image_url?: string }
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!brand_id || !name || !design_number || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Brand, Name, Design Number, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query on designs table
    const { data: updatedDesign, error: designError } = await supabase
      .from("designs")
      .update({
        brand_id,
        design_number,
        name,
        category: category || null,
        sub_category: sub_category || null,
        season: season || null,
        gender: gender || null,
        hsn_code: hsn_code || null,
        description: description || null,
        images: images || [],
        size_set_id: size_set_id || null,
        sale_price: sale_price ? Number(sale_price) : null,
        is_active: is_active !== false,
      })
      .eq("id", designId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (designError) {
      return NextResponse.json({ error: designError.message }, { status: 500 });
    }

    if (!updatedDesign || updatedDesign.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Design was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    // Update colours: delete old ones and insert new ones
    await supabase
      .from("design_colours")
      .delete()
      .eq("design_id", designId);

    if (colours && Array.isArray(colours) && colours.length > 0) {
      const colourRows = colours.map((c) => ({
        business_id: businessId,
        design_id: designId,
        colour_name: c.colour_name,
        colour_hex: c.colour_hex || null,
        image_url: c.image_url || null,
        is_active: true,
      }));

      const { error: colourError } = await supabase
        .from("design_colours")
        .insert(colourRows);

      if (colourError) {
        return NextResponse.json({ error: colourError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ design: updatedDesign[0] });
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
  const designId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete: update deleted_at
    const { error } = await supabase
      .from("designs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", designId)
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
