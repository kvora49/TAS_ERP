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
    const result = await reconcileRawMaterialStock(supabase, businessId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/raw-materials/stock/reconcile] ERROR:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during reconciliation" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileRawMaterialStock(supabase, businessId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/raw-materials/stock/reconcile] ERROR:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during reconciliation" },
      { status: 500 }
    );
  }
}

