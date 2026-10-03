import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDeliveryDocument, deliveryChallanInput, finalizeDeliveryDocument } from "@/lib/delivery-challan";

type Context = { params: { id: string } };
async function access(id: string, action: "can_view" | "can_add") {
  const businessId = await getSessionBusinessId();
  if (!businessId) return { response: NextResponse.json({ error: "Sign in to access delivery challans." }, { status: 401 }) };
  if (!z.uuid().safeParse(id).success) return { response: NextResponse.json({ error: "Invalid sales bill ID." }, { status: 400 }) };
  const client = createClient();
  const [{ data: { user } }, permission] = await Promise.all([
    client.auth.getUser(),
    client.rpc("sales_delivery_challan_permission", { p_business_id: businessId, p_action: action }),
  ]);
  if (!user) return { response: NextResponse.json({ error: "Sign in to access delivery challans." }, { status: 401 }) };
  if (permission.error) throw permission.error;
  if (!permission.data) return { response: NextResponse.json({ error: "Your role does not have permission for this delivery challan action." }, { status: 403 }) };
  return { client, businessId, user };
}

async function loadDraft(client: ReturnType<typeof createClient>, businessId: string, bill: any) {
  const [items, rolls, company, brand] = await Promise.all([
    client.from("sale_bill_items").select("*,design:designs(id,name,design_number),colour:design_colours(id,colour_name),material_type:raw_material_types(id,name,unit)").eq("business_id", businessId).eq("bill_id", bill.id).order("id").range(0, 1000),
    client.from("sale_rolls").select("*,item:sale_bill_items!inner(bill_id)").eq("business_id", businessId).eq("item.bill_id", bill.id).order("created_at").order("id").range(0, 1000),
    client.from("businesses").select("name,address,gstin,phone,email").eq("id", businessId).single(),
    bill.brand_id
      ? client.from("brands").select("name,address,gstin").eq("business_id", businessId).eq("id", bill.brand_id).maybeSingle()
      : client.from("brands").select("name,address,gstin").eq("business_id", businessId).eq("is_primary", true).is("deleted_at", null).maybeSingle(),
  ]);
  for (const result of [items, rolls, company, brand]) if (result.error) throw result.error;
  if ((items.data?.length || 0) > 1000 || (rolls.data?.length || 0) > 1000) throw new Error("This invoice exceeds the supported challan item limit.");
  return buildDeliveryDocument(bill, { ...company.data, ...Object.fromEntries(Object.entries(brand.data || {}).filter(([, value]) => !!value)) }, items.data || [], rolls.data || []);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const ctx = await access(params.id, "can_view");
    if (ctx.response) return ctx.response;
    const { client, businessId } = ctx;
    const [bill, saved, add, exp] = await Promise.all([
      client.from("sale_bills").select("*,party:parties(name,company_name,phone,gstin,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_pincode,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_pincode)").eq("business_id", businessId).eq("id", params.id).is("deleted_at", null).maybeSingle(),
      client.from("sales_delivery_challans").select("id,document,created_at").eq("business_id", businessId).eq("bill_id", params.id).maybeSingle(),
      client.rpc("sales_delivery_challan_permission", { p_business_id: businessId, p_action: "can_add" }),
      client.rpc("sales_delivery_challan_permission", { p_business_id: businessId, p_action: "can_export" }),
    ]);
    for (const result of [bill, saved, add, exp]) if (result.error) throw result.error;
    if (!bill.data) return NextResponse.json({ error: "Sales bill not found." }, { status: 404 });
    if (!saved.data && bill.data.status !== "active") return NextResponse.json({ error: "Create a delivery challan from an active sales bill." }, { status: 409 });
    let document;
    try { document = saved.data?.document || await loadDraft(client, businessId, bill.data); }
    catch (error) {
      if (error instanceof Error && /quantit|Roll meters|item limit/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 422 });
      throw error;
    }
    return NextResponse.json({ document, sourceUpdatedAt: bill.data.updated_at ?? null, saved: !!saved.data, cancelled: bill.data.status === "cancelled", canCreate: !!add.data, canExport: !!exp.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("delivery-challan:get", error);
    return NextResponse.json({ error: "Unable to load the delivery challan. Please retry." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const ctx = await access(params.id, "can_add");
    if (ctx.response) return ctx.response;
    const { client, businessId, user } = ctx;
    const parsed = deliveryChallanInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the date, shipping address and item details." }, { status: 400 });
    const [bill, existing] = await Promise.all([
      client.from("sale_bills").select("*,party:parties(*)").eq("business_id", businessId).eq("id", params.id).is("deleted_at", null).maybeSingle(),
      client.from("sales_delivery_challans").select("id,document").eq("business_id", businessId).eq("bill_id", params.id).maybeSingle(),
    ]);
    if (bill.error) throw bill.error;
    if (existing.error) throw existing.error;
    if (!bill.data) return NextResponse.json({ error: "Sales bill not found." }, { status: 404 });
    if (bill.data.status !== "active") return NextResponse.json({ error: "Only active sales bills can create a delivery challan." }, { status: 409 });
    if (existing.data) return NextResponse.json({ document: existing.data.document, saved: true });
    if ((bill.data.updated_at ?? null) !== parsed.data.sourceUpdatedAt) return NextResponse.json({ error: "The sales bill changed. Reload and review before creating the challan." }, { status: 409 });
    const draft = await loadDraft(client, businessId, bill.data);
    let document;
    try { document = finalizeDeliveryDocument(draft, parsed.data); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
    const result = await createAdminClient().from("sales_delivery_challans").insert({ business_id: businessId, bill_id: params.id, created_by: user.id, source_updated_at: bill.data.updated_at, document }).select("id").single();
    if (result.error?.code === "23514") return NextResponse.json({ error: "The sales bill changed. Reload and review before creating the challan." }, { status: 409 });
    if (result.error?.code === "23505") {
      const saved = await client.from("sales_delivery_challans").select("document").eq("business_id", businessId).eq("bill_id", params.id).single();
      if (saved.error) throw saved.error;
      return NextResponse.json({ document: saved.data.document, saved: true });
    }
    if (result.error) throw result.error;
    return NextResponse.json({ document, saved: true }, { status: 201 });
  } catch (error) {
    console.error("delivery-challan:create", error);
    return NextResponse.json({ error: "Unable to create the delivery challan. Reload the bill and retry." }, { status: 500 });
  }
}
