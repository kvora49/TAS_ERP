import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PurchaseService } from "@/services/purchase.service";

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
    const { data: { user } } = await supabase.auth.getUser();
    const service = new PurchaseService(supabase);
    const purchase = await service.createPurchase(businessId, body, user?.id || null);
    return NextResponse.json({ purchase });
  } catch (err: any) {
    const status = err.message?.includes("required") ? 400 : 500;
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status }
    );
  }
}
