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
    // 1. Parallelize fetching brand details, linked production lots, and linked designs
    const [brandRes, lotsRes, designsRes] = await Promise.all([
      supabase
        .from("brands")
        .select("*")
        .eq("id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("production_lots")
        .select(`
          id,
          lot_number,
          lot_date,
          total_quantity,
          completed_quantity,
          status,
          design:designs(id, name, code:design_number)
        `)
        .eq("brand_id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("lot_date", { ascending: false }),
      supabase
        .from("designs")
        .select("id, name, design_number, is_active, created_at")
        .eq("brand_id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    if (brandRes.error || !brandRes.data) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    if (lotsRes.error) {
      console.error("Error fetching lots for brand:", lotsRes.error);
    }

    // 2. Fetch finished stock matching these designs
    let resolvedStock: any[] = [];
    if (designsRes.data && designsRes.data.length > 0) {
      const designIds = designsRes.data.map((d) => d.id);
      const { data: stockItems, error: stockErr } = await supabase
        .from("finished_stock")
        .select(`
          id,
          total_quantity,
          cost_per_piece,
          total_value,
          size_quantities,
          godown:godowns(id, name),
          design:designs(id, name, code:design_number),
          colour:design_colours(id, colour_name)
        `)
        .eq("business_id", businessId)
        .in("design_id", designIds)
        .gt("total_quantity", 0);

      if (stockErr) {
        console.error("Error fetching stock for brand designs:", stockErr);
      }
      resolvedStock = stockItems || [];
    }

    return NextResponse.json({
      brand: brandRes.data,
      lots: lotsRes.data || [],
      designs: designsRes.data || [],
      stock: resolvedStock,
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
      logo_url,
      gstin,
      address,
      state,
      state_code,
      bill_prefix_pakka,
      bill_prefix_kacha,
      design_prefix,
      design_separator,
      design_digits,
      is_primary,
      is_active,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Brand Name is required" }, { status: 400 });
    }

    if (is_primary) {
      await supabase
        .from("brands")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    const { data: brand, error } = await supabase
      .from("brands")
      .update({
        name,
        logo_url: logo_url || null,
        gstin: gstin || null,
        address: address || null,
        state: state || null,
        state_code: state_code || null,
        bill_prefix_pakka: bill_prefix_pakka || null,
        bill_prefix_kacha: bill_prefix_kacha || null,
        design_prefix: design_prefix || null,
        design_separator: design_separator || ".",
        design_digits: Number(design_digits || 4),
        is_primary: !!is_primary,
        is_active: is_active !== false,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brand });
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
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetBrandId = searchParams.get("target_brand_id");

    // 1. Fetch brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id, name")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // 2. Query designs linked to this brand
    const { data: designs } = await supabase
      .from("designs")
      .select("id, name, design_number")
      .eq("brand_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const designIds = (designs || []).map((d) => d.id);

    // 3. Query finished stock linked to these designs
    let stockItems: any[] = [];
    if (designIds.length > 0) {
      const { data: items } = await supabase
        .from("finished_stock")
        .select("id, design_id, godown_id, total_quantity, cost_per_piece, total_value, size_quantities")
        .eq("business_id", businessId)
        .in("design_id", designIds)
        .gt("total_quantity", 0);

      stockItems = items || [];
    }

    // 4. Query production lots linked to this brand
    const { data: lots } = await supabase
      .from("production_lots")
      .select("id, lot_number, status")
      .eq("brand_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const totalStockQty = stockItems.reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
    const hasStockOrDesigns = stockItems.length > 0 || (designs && designs.length > 0) || (lots && lots.length > 0);

    // ACTION: Check stock status
    if (action === "check") {
      return NextResponse.json({
        hasStock: hasStockOrDesigns,
        stockCount: stockItems.length,
        totalQuantity: totalStockQty,
        designsCount: designs?.length || 0,
        lotsCount: lots?.length || 0,
      });
    }

    // ACTION: Transfer stock & designs to target brand
    if (action === "transfer") {
      if (!targetBrandId) {
        return NextResponse.json({ error: "Target brand is required for transfer" }, { status: 400 });
      }

      const { data: targetBrand } = await supabase
        .from("brands")
        .select("id, name")
        .eq("id", targetBrandId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetBrand) {
        return NextResponse.json({ error: "Target brand not found" }, { status: 404 });
      }

      // Re-link designs to target brand
      if (designIds.length > 0) {
        const { error: designRelinkErr } = await supabase
          .from("designs")
          .update({ brand_id: targetBrandId, updated_at: new Date().toISOString() })
          .in("id", designIds)
          .eq("business_id", businessId);

        if (designRelinkErr) throw new Error(`Failed to re-link designs: ${designRelinkErr.message}`);
      }

      // Re-link production lots to target brand
      if (lots && lots.length > 0) {
        const lotIds = lots.map((l) => l.id);
        const { error: lotRelinkErr } = await supabase
          .from("production_lots")
          .update({ brand_id: targetBrandId, updated_at: new Date().toISOString() })
          .in("id", lotIds)
          .eq("business_id", businessId);

        if (lotRelinkErr) throw new Error(`Failed to re-link production lots: ${lotRelinkErr.message}`);
      }

      // Soft-delete brand
      const { error: deleteErr } = await supabase
        .from("brands")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Brand '${brand.name}' deleted. Transferred ${designs?.length || 0} designs and active stock to '${targetBrand.name}'.`,
      });
    }

    // ACTION: Force delete (Write-off active stock & deactivate designs)
    if (action === "force") {
      // 1. Write-off current finished stock entries and log in stock_ledger
      for (const item of stockItems) {
        // Write stock_ledger adjustment entry
        await supabase.from("stock_ledger").insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: item.design_id,
          godown_id: item.godown_id,
          transaction_type: "brand_deletion_writeoff",
          quantity_delta: -Number(item.total_quantity || 0),
          value_delta: -Number(item.total_value || 0),
          reference_table: "brands",
          reference_id: id,
        });

        // Zero out current stock record
        await supabase
          .from("finished_stock")
          .update({
            total_quantity: 0,
            total_value: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }

      // 2. Mark designs as inactive (do not delete to preserve historical invoice references)
      if (designIds.length > 0) {
        await supabase
          .from("designs")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", designIds)
          .eq("business_id", businessId);
      }

      // 3. Soft-delete source brand
      const { error: deleteErr } = await supabase
        .from("brands")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Brand '${brand.name}' deleted. Active stock written off and designs deactivated. Historical cost and payment records preserved.`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
