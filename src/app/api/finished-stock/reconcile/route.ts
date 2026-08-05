import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { targetDesignId } = body;

    const result = await reconcileFinishedStock(supabase, businessId, targetDesignId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reconcile finished stock" },
      { status: 500 }
    );
  }
}
