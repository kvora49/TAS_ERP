import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";

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
    // 0. Perform real-time ground-truth stock reconciliation for this material
    try {
      await reconcileRawMaterialStock(supabase, businessId, id);
    } catch (recErr) {
      console.warn("Raw material detail reconciliation warning:", recErr);
    }

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

    // 2. Fetch live stock per godown from raw_material_current_stock
    const { data: rawStocks } = await supabase
      .from("raw_material_current_stock")
      .select(`
        id,
        current_stock,
        unit_cost,
        stock_value,
        godown_id,
        godown:godowns(id, name, code)
      `)
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    // 3. Fetch all godowns for this business to ensure complete godown mapping
    const { data: allGodowns } = await supabase
      .from("godowns")
      .select("id, name, code")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // 4. Fetch purchase history
    const { data: purchaseItems } = await supabase
      .from("raw_material_purchase_items")
      .select(`
        id,
        quantity,
        rate,
        amount,
        created_at,
        purchase:raw_material_purchases(

          id,
          invoice_no,
          invoice_date,
          godown_id,
          supplier:parties(name)
        )
      `)
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    // Map purchase history for Tab 3
    const purchases = (purchaseItems || []).map((item: any) => ({
      id: item.id,
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      amount: Number(item.amount || (Number(item.quantity || 0) * Number(item.rate || 0))),
      purchaseId: item.purchase?.id,
      invoiceNumber: item.purchase?.invoice_no || "N/A",
      purchaseDate: item.purchase?.invoice_date || item.created_at || new Date().toISOString(),
      supplierName: item.purchase?.supplier?.name || "Supplier",
    })).sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    // 5. Build Live Stock per Godown (Tab 1)
    const godownDict = new Map<string, any>((allGodowns || []).map((g) => [g.id, g]));
    const defaultGodown = allGodowns && allGodowns.length > 0 ? allGodowns[0] : null;
    const godownStockMap = new Map<string, { godown: any; current_stock: number; stock_value: number; unit_cost: number }>();

    // Seed from current_stock table (driven by stock_ledger)
    (rawStocks || []).forEach((s: any) => {
      const g = s.godown || godownDict.get(s.godown_id) || defaultGodown;
      if (!g) return;
      godownStockMap.set(g.id, {
        godown: g,
        current_stock: Number(s.current_stock || 0),
        stock_value: Number(s.stock_value || 0),
        unit_cost: Number(s.unit_cost || 0),
      });
    });

    const stocks = Array.from(godownStockMap.values())
      .filter((v) => v.current_stock > 0 || godownStockMap.size === 1)
      .map((v, idx) => ({
        id: `godown-stock-${idx}`,
        current_stock: v.current_stock,
        unit_cost: v.unit_cost,
        stock_value: v.stock_value,
        godown: v.godown,
      }));

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

    // 5. Fetch active rolls/batches for this raw material
    const { data: itemIds } = await supabase
      .from("raw_material_purchase_items")
      .select("id, rate, purchase:raw_material_purchases(invoice_no, invoice_date, supplier:parties(name))")
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    let rolls: any[] = [];
    if (itemIds && itemIds.length > 0) {
      const pItemMap = new Map(itemIds.map((it: any) => [it.id, it]));
      const pItemIdsList = itemIds.map((it: any) => it.id);

      const { data: rawRolls } = await supabase
        .from("purchase_rolls")
        .select("*")
        .eq("business_id", businessId)
        .in("purchase_item_id", pItemIdsList)
        .order("created_at", { ascending: false });

      rolls = (rawRolls || []).map((r: any) => {
        const pItem: any = pItemMap.get(r.purchase_item_id);
        return {
          id: r.id,
          roll_number: r.roll_number,
          shade: r.shade,
          total_quantity: Number(r.meters || r.total_meters || 0),
          remaining_quantity: Number(r.remaining_meters || 0),
          rate: Number(pItem?.rate || 0),
          invoice_no: pItem?.purchase?.invoice_no || "N/A",
          invoice_date: pItem?.purchase?.invoice_date || null,
          supplier_name: pItem?.purchase?.supplier?.name || "Supplier",
          created_at: r.created_at,
        };
      });
    }

    // Compute rollups
    let totalCurrentStock = (stocks || []).reduce((acc, curr) => acc + Number(curr.current_stock || 0), 0);
    let totalStockValue = (stocks || []).reduce((acc, curr) => acc + Number(curr.stock_value || 0), 0);

    // Fallback: If no current_stock entry exists yet for godown, compute from active rolls
    if (totalCurrentStock === 0 && rolls && rolls.length > 0) {
      totalCurrentStock = rolls.reduce((acc, r) => acc + Number(r.remaining_quantity || 0), 0);
      totalStockValue = rolls.reduce((acc, r) => acc + (Number(r.remaining_quantity || 0) * Number(r.rate || 0)), 0);
    }

    let totalQtyPurchased = 0;
    let totalSpend = 0;
    purchases.forEach((p) => {
      totalQtyPurchased += p.quantity;
      totalSpend += p.quantity * p.rate;
    });

    const averagePurchaseCost = totalQtyPurchased > 0 ? (totalSpend / totalQtyPurchased) : 0;

    const isFabric = material.category?.toLowerCase() === "fabric" || (rolls && rolls.length > 0);

    return NextResponse.json({
      material,
      is_fabric: isFabric,
      stocks: stocks || [],
      purchases,
      movements: movements || [],
      rolls,
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
    // 1. Check if raw material has active stock
    const { data: stockEntries } = await supabase
      .from("raw_material_current_stock")
      .select("current_stock")
      .eq("material_type_id", id)
      .eq("business_id", businessId);

    const totalStock = (stockEntries || []).reduce((acc, curr) => acc + Number(curr.current_stock || 0), 0);
    if (totalStock > 0) {
      return NextResponse.json(
        { error: `Cannot delete raw material type: ${totalStock} units still remain in stock. Adjust stock to zero first.` },
        { status: 400 }
      );
    }

    // 2. Check if purchase history exists
    const { data: purchaseItems } = await supabase
      .from("raw_material_purchase_items")
      .select("id")
      .eq("material_type_id", id)
      .eq("business_id", businessId)
      .limit(1);

    if (purchaseItems && purchaseItems.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete raw material type: Purchase transaction history exists for this item. Mark it as inactive instead." },
        { status: 400 }
      );
    }

    // 3. Soft-delete material
    const { error: deleteErr } = await supabase
      .from("raw_material_types")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 4. Record Audit Log
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action: "delete_raw_material_type",
      table_name: "raw_material_types",
      record_id: id,
      old_values: { id },
      new_values: { is_active: false, deleted_at: new Date().toISOString() },
      ip_address: "127.0.0.1",
      user_agent: "NextJS Server",
    });

    return NextResponse.json({ success: true, message: "Raw Material type successfully deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}
