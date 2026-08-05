import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * One-time cleanup endpoint for stale finished_stock 'manual' rows 
 * that accumulated due to the buggy reconciliation.
 * 
 * POST /api/finished-stock/cleanup
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete ALL manual rows (they were written by buggy reconciliation)
    const { data: deleted, error: delErr } = await supabase
      .from("finished_stock")
      .delete()
      .eq("business_id", businessId)
      .eq("entry_type", "manual")
      .select("id");

    if (delErr) {
      console.error("[cleanup] Delete error:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const deletedCount = (deleted || []).length;

    // Now run fresh reconciliation
    const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
    const result = await reconcileFinishedStock(supabase, businessId);

    return NextResponse.json({
      success: true,
      stale_rows_deleted: deletedCount,
      reconciliation: result,
      message: `Cleaned ${deletedCount} stale rows. Reconciliation: ${result.message}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}
