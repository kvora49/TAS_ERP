import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    let query = supabase
      .from("designs")
      .select(`
        *,
        brand:brands(name, design_prefix, design_separator, design_digits, design_sequence),
        size_set:size_sets(name, sizes),
        design_colours(*)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: designs, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch finished_stock totals for each design
    const { data: stockSummary } = await supabase
      .from("finished_stock")
      .select("design_id, total_quantity, total_value, cost_per_piece")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const stockMap: Record<string, { total_quantity: number; total_value: number }> = {};
    (stockSummary || []).forEach((row: any) => {
      const dId = row.design_id;
      if (!dId) return;
      if (!stockMap[dId]) stockMap[dId] = { total_quantity: 0, total_value: 0 };
      const qty = Number(row.total_quantity || 0);
      const val = Number(row.total_value || (qty * Number(row.cost_per_piece || 0)));
      stockMap[dId].total_quantity += qty;
      stockMap[dId].total_value += val;
    });

    // Fetch active BOM costing fallbacks
    const { data: designCostings } = await supabase
      .from("design_costings")
      .select("design_id, total_cost_per_piece")
      .eq("business_id", businessId)
      .eq("is_active", true);

    const bomCostMap = new Map<string, number>();
    (designCostings || []).forEach((c: any) => {
      if (c.total_cost_per_piece && Number(c.total_cost_per_piece) > 0) {
        bomCostMap.set(c.design_id, Number(c.total_cost_per_piece));
      }
    });

    // Filter out deleted design colours on server side and attach stock info
    const designsWithStock = (designs || []).map((d: any) => {
      const stk = stockMap[d.id] || { total_quantity: 0, total_value: 0 };
      const salePrice = Number(d.sale_price || 0);
      const bomCost = bomCostMap.get(d.id) || 0;
      const estUnitCost = bomCost > 0 ? bomCost : (salePrice > 0 ? Math.round(salePrice * 0.6) : 150);
      
      const computedValue = stk.total_value > 0 
        ? stk.total_value 
        : (stk.total_quantity > 0 ? Math.round(stk.total_quantity * estUnitCost) : 0);

      return {
        ...d,
        design_colours: d.design_colours?.filter((c: any) => c.deleted_at === null) || [],
        total_quantity: stk.total_quantity,
        total_value: computedValue,
      };
    });

    return NextResponse.json({ designs: designsWithStock });
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

    let targetBrandId = brand_id;
    if (!targetBrandId) {
      const { data: firstBrand } = await supabase
        .from("brands")
        .select("id")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstBrand) {
        targetBrandId = firstBrand.id;
      }
    }

    if (!targetBrandId || !name) {
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
      .eq("id", targetBrandId)
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
        .eq("id", targetBrandId);
    }

    // Insert the design record
    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        business_id: businessId,
        brand_id: targetBrandId,
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
        sale_price: sale_price !== undefined && sale_price !== null && sale_price !== "" ? Number(sale_price) : null,
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

    // Re-fetch created design with full relations (brand, size_set, design_colours)
    const { data: fullDesign } = await supabase
      .from("designs")
      .select(`
        *,
        brand:brands(name, design_prefix, design_separator, design_digits, design_sequence),
        size_set:size_sets(name, sizes),
        design_colours(*)
      `)
      .eq("id", design.id)
      .single();

    const activeDesign = fullDesign
      ? {
          ...fullDesign,
          design_colours: fullDesign.design_colours?.filter((c: any) => c.deleted_at === null) || [],
        }
      : design;

    return NextResponse.json({ design: activeDesign });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
