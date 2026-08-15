import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PurchaseService } from "@/services/purchase.service";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("payment_status");
  const search = searchParams.get("search");

  try {
    const service = new PurchaseService(supabase);
    const purchases = await service.listPurchases(businessId, { status, paymentStatus, search });
    return NextResponse.json({ purchases });
  } catch (err: any) {
    return handleApiError(err);
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
    const { data: { user } } = await supabase.auth.getUser();
    const service = new PurchaseService(supabase);
    const purchase = await service.createPurchase(businessId, body, user?.id || null);

    // Fire-and-forget audit log
    void logAudit(businessId, "create", "raw_material_purchases", purchase?.id || "", {
      party_id: body.party_id,
      bill_amount: body.bill_amount,
      bill_date: body.bill_date,
      supplier_bill_no: body.supplier_bill_no,
    });

    return NextResponse.json({ purchase });
  } catch (err: any) {
    return handleApiError(err);
  }
}

