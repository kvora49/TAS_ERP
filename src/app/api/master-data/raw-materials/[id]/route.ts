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
    // 1. Fetch raw material type details
    const { data: material, error: matError } = await supabase
      .from("raw_material_types")
      .select(`
        *,
        default_supplier:parties(id, name)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (matError || !material) {
      return NextResponse.json({ error: "Raw Material not found" }, { status: 404 });
    }

    // 2. Fetch live stock per godown
    const { data: stocks } = await supabase
      .from("raw_material_current_stock")
      .select(`
        id,
        current_stock,
        unit_cost,
        stock_value,
        godown:godowns(id, name, code)
      `)
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    // 3. Fetch purchase history
    const { data: purchaseItems } = await supabase
      .from("raw_material_purchase_items")
      .select(`
        id,
        quantity,
        rate,
        amount,
        purchase:raw_material_purchases(
          id,
          invoice_number,
          purchase_date,
          supplier:parties(name)
        )
      `)
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    // Unpack purchases and sort by purchase date descending
    const purchases = (purchaseItems || [])
      .map((item: any) => ({
        id: item.id,
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        purchaseId: item.purchase?.id,
        invoiceNumber: item.purchase?.invoice_number || "N/A",
        purchaseDate: item.purchase?.purchase_date || null,
        supplierName: item.purchase?.supplier?.name || "Supplier",
      }))
      .filter((p) => p.purchaseDate !== null)
      .sort((a, b) => new Date(b.purchaseDate!).getTime() - new Date(a.purchaseDate!).getTime());

    // 4. Fetch movements from stock_ledger
    const { data: movements } = await supabase
      .from("stock_ledger")
      .select(`
        id,
        transaction_type,
        quantity_delta,
        value_delta,
        created_at,
        godown:godowns(name)
      `)
      .eq("item_type", "raw_material")
      .eq("item_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Compute rollups
    const totalCurrentStock = (stocks || []).reduce((acc, curr) => acc + Number(curr.current_stock || 0), 0);
    const totalStockValue = (stocks || []).reduce((acc, curr) => acc + Number(curr.stock_value || 0), 0);

    let totalQtyPurchased = 0;
    let totalSpend = 0;
    purchases.forEach((p) => {
      totalQtyPurchased += p.quantity;
      totalSpend += p.quantity * p.rate;
    });

    const averagePurchaseCost = totalQtyPurchased > 0 ? (totalSpend / totalQtyPurchased) : 0;

    return NextResponse.json({
      material,
      stocks: stocks || [],
      purchases,
      movements: movements || [],
      rollups: {
        totalCurrentStock,
        totalStockValue,
        averagePurchaseCost,
        reorderWarning: material.reorder_level && totalCurrentStock <= Number(material.reorder_level),
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
