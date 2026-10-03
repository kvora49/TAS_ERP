import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";
import { runStockIntegrityCheck } from "@/lib/stock-integrity-watchdog";
import { logAudit } from "@/lib/audit";

export async function runStockIntegrityCheckJob(supabase: any, businessId: string, designId?: string) {
  return runStockIntegrityCheck(supabase, businessId, designId);
}

export async function runStockIntegritySyncJob(supabase: any, businessId: string, designId?: string, request?: Request) {
  const startTime = Date.now();

  // 1. Full reconciliation — Finished Goods
  const fgResult = await reconcileFinishedStock(supabase, businessId, designId);

  // 2. Full reconciliation — Raw Materials (only if not scoped to a specific design)
  let rmResult = null;
  if (!designId) {
    rmResult = await reconcileRawMaterialStock(supabase, businessId);
  }

  // 3. Watchdog check
  const watchdogReport = await runStockIntegrityCheck(supabase, businessId, designId);

  const durationMs = Date.now() - startTime;

  // 4. Log to standard audit_log table
  try {
    await logAudit(
      businessId,
      "sync_and_reconcile",
      "stock_integrity",
      designId || null,
      {
        status: watchdogReport.discrepancies_unresolved === 0 ? "healthy" : "reconciled_with_notes",
        scope: designId ? "design" : "full",
        target_design_id: designId || null,
        discrepancies_found: watchdogReport.discrepancies_found,
        discrepancies_fixed: watchdogReport.discrepancies_fixed,
        discrepancies_unresolved: watchdogReport.discrepancies_unresolved,
        duration_ms: durationMs,
        summary: watchdogReport.summary,
      },
      {},
      request,
      supabase
    );
  } catch (_auditErr) {
    console.warn("Failed to write to audit_log:", _auditErr);
  }

  return {
    success: true,
    mode: "full_sync",
    duration_ms: durationMs,
    finished_goods_reconciliation: fgResult,
    raw_materials_reconciliation: rmResult,
    watchdog_report: watchdogReport,
  };
}

export async function runScheduledStockIntegrityJob() {
  const supabase = createAdminClient();
  const { data: businesses, error: bizErr } = await supabase.from("businesses").select("id, name");
  if (bizErr) throw bizErr;

  const results = [];
  for (const biz of businesses || []) {
    try {
      const syncResult = await runStockIntegritySyncJob(supabase, biz.id);
      results.push({ businessId: biz.id, name: biz.name, ...syncResult });
    } catch (err: any) {
      console.error(`Stock integrity job failed for business ${biz.id}:`, err);
      results.push({ businessId: biz.id, name: biz.name, success: false, error: err.message });
    }
  }

  return {
    success: true,
    processedCount: results.length,
    results,
  };
}
