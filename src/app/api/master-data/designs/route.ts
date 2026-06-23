import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: designs, error } = await supabase
      .from("designs")
      .select(`
        *,
        brand:brands(name, design_prefix, design_separator, design_digits, design_sequence),
        size_set:size_sets(name, sizes),
        design_colours(*)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out deleted design colours on server side
    const designsWithActiveColours = designs.map((d: any) => ({
      ...d,
      design_colours: d.design_colours?.filter((c: any) => c.deleted_at === null) || [],
    }));

    return NextResponse.json({ designs: designsWithActiveColours });
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
      colours, // Array of { colour_name: string, colour_hex: string, image_url: string }
    } = body;

    if (!brand_id || !name) {
      return NextResponse.json(
        { error: "Brand and Design Name are required" },
        { status: 400 }
      );
    }

    // Fetch the brand to generate the design number if not supplied or left auto
    let finalDesignNumber = design_number;

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: "Selected Brand not found" }, { status: 404 });
    }

    if (!finalDesignNumber) {
      const prefix = brand.design_prefix || "";
      const separator = brand.design_separator || ".";
      const digits = brand.design_digits || 4;
      const seq = brand.design_sequence || 1;
      
      finalDesignNumber = `${prefix}${separator}${String(seq).padStart(digits, "0")}`;

      // Increment brand sequence
      await supabase
        .from("brands")
        .update({ design_sequence: seq + 1 })
        .eq("id", brand_id);
    }

    // Insert the design record
    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        business_id: businessId,
        brand_id,
        design_number: finalDesignNumber,
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
      .select()
      .single();

    if (designError) {
      return NextResponse.json({ error: designError.message }, { status: 500 });
    }

    // Insert colors if provided
    if (colours && Array.isArray(colours) && colours.length > 0) {
      const colourRows = colours.map((c) => ({
        business_id: businessId,
        design_id: design.id,
        colour_name: c.colour_name,
        colour_hex: c.colour_hex || null,
        image_url: c.image_url || null,
        is_active: true,
      }));

      const { error: colourError } = await supabase
        .from("design_colours")
        .insert(colourRows);

      if (colourError) {
        // Soft roll back: delete design since colors failed
        await supabase.from("designs").delete().eq("id", design.id);
        return NextResponse.json({ error: colourError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ design });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
