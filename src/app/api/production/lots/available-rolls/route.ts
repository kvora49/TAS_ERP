import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  try {
    const { data: rolls, error } = await supabase
      .from("purchase_rolls")
      .select(`
        *,
        item:raw_material_purchase_items (
          id,
          material_type:raw_material_types (id, name, category, unit),
          purchase:raw_material_purchases (
            id,
            purchase_number,
            invoice_no,
            supplier:parties (id, name, company_name)
          )
        )
      `)
      .eq("business_id", businessId)
      .gt("remaining_meters", 0);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter in-memory for search query
    const filteredRolls = (rolls || []).filter((roll: any) => {
      if (!search) return true;
      const sLower = search.toLowerCase();
      const rollNum = roll.roll_number?.toLowerCase() || "";
      const supplierName = roll.item?.purchase?.supplier?.name?.toLowerCase() || "";
      const supplierCompany = roll.item?.purchase?.supplier?.company_name?.toLowerCase() || "";
      const materialName = roll.item?.material_type?.name?.toLowerCase() || "";
      const purchaseNo = roll.item?.purchase?.purchase_number?.toLowerCase() || "";
      const invoiceNo = roll.item?.purchase?.invoice_no?.toLowerCase() || "";
      const shade = roll.shade?.toLowerCase() || "";

      return (
        rollNum.includes(sLower) ||
        supplierName.includes(sLower) ||
        supplierCompany.includes(sLower) ||
        materialName.includes(sLower) ||
        purchaseNo.includes(sLower) ||
        invoiceNo.includes(sLower) ||
        shade.includes(sLower)
      );
    });

    return NextResponse.json({ rolls: filteredRolls });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
