import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { validateInvoiceForEInvoice } from "@/lib/einvoice";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new SalesBillRepository(supabase);
    const [detail, bizRes] = await Promise.all([
      repo.getDetailById(params.id, businessId),
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    ]);

    if (!detail || !detail.bill) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (bizRes.error || !bizRes.data) {
      return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
    }

    const bill = detail.bill;
    const business = bizRes.data;

    const validation = await validateInvoiceForEInvoice(
      {
        ...bill,
        items: detail.bill.items || [],
      },
      {
        id: business.id,
        name: business.name,
        gstin: business.gstin,
        address: business.address,
        city: business.city,
        pincode: business.pincode,
        state: business.state,
        state_code: business.state_code,
        aato_bracket: business.aato_bracket,
        einvoice_applicability: business.einvoice_applicability,
      },
      { supabase }
    );

    return NextResponse.json({
      success: true,
      validation,
    });
  } catch (err: any) {
    console.error("E-Invoice local validation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to validate invoice" },
      { status: 500 }
    );
  }
}
