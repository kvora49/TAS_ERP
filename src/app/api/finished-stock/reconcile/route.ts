import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";
import { runStockIntegrityCheck } from "@/lib/stock-integrity-watchdog";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { targetDesignId } = body;

    // 1. Run ground-truth reconciliation
    const result = await reconcileFinishedStock(supabase, businessId, targetDesignId);

    // 2. Run watchdog check to detect and auto-fix any discrepancies
    const watchdogReport = await runStockIntegrityCheck(supabase, businessId, targetDesignId);

    return NextResponse.json({
      ...result,
      watchdog: watchdogReport,
      summary: watchdogReport.summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reconcile finished stock" },
      { status: 500 }
    );
  }
}
