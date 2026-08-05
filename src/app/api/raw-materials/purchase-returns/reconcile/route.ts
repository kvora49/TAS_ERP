import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { targetMaterialTypeId } = body;

    const result = await reconcileRawMaterialStock(supabase, businessId, targetMaterialTypeId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute stock reconciliation" },
      { status: 500 }
    );
  }
}
