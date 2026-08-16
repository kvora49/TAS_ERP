import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";
import { runStockIntegrityCheck } from "@/lib/stock-integrity-watchdog";
import { logAudit } from "@/lib/audit";

async function resolveAuthAndClient(request: Request, body?: any) {
  let supabase = createClient();
  let businessId = await getSessionBusinessId();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isServiceAuth = !!(
    authHeader &&
    ((serviceKey && authHeader === `Bearer ${serviceKey}`) ||
     (cronSecret && authHeader === `Bearer ${cronSecret}`))
  );

  if (isServiceAuth) {
    supabase = createAdminClient();
    if (!businessId) {
      const url = new URL(request.url);
      businessId = body?.business_id || url.searchParams.get("business_id");
    }
  }

  return { supabase, businessId };
}

/**
 * GET /api/cron/stock-integrity
 * Read-only watchdog health inspection.
 */
export async function GET(request: Request) {
  const { supabase, businessId } = await resolveAuthAndClient(request);
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchdogReport = await runStockIntegrityCheck(supabase, businessId);
    return NextResponse.json({
      mode: "check_only",
      report: watchdogReport,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/cron/stock-integrity
 * Full reconciliation + watchdog fix + audit log recording.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { supabase, businessId } = await resolveAuthAndClient(request, body);
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { design_id } = body;

    const startTime = Date.now();

    // 1. Full reconciliation — Finished Goods
    const fgResult = await reconcileFinishedStock(supabase, businessId, design_id);

    // 2. Full reconciliation — Raw Materials (only if not scoped to a specific design)
    let rmResult = null;
    if (!design_id) {
      rmResult = await reconcileRawMaterialStock(supabase, businessId);
    }

    // 3. Watchdog check
    const watchdogReport = await runStockIntegrityCheck(supabase, businessId, design_id);

    const durationMs = Date.now() - startTime;

    // 4. Log to standard audit_log table
    // NOTE: record_id is UUID type in DB — pass null for full-company syncs,
    // or the design_id UUID for design-scoped runs.
    try {
      await logAudit(
        businessId,
        "sync_and_reconcile",
        "stock_integrity",
        design_id || null,   // ← null for full sync (not a plain string — column is UUID)
        {
          status: watchdogReport.discrepancies_unresolved === 0 ? "healthy" : "reconciled_with_notes",
          scope: design_id ? "design" : "full",
          target_design_id: design_id || null,
          discrepancies_found: watchdogReport.discrepancies_found,
          discrepancies_fixed: watchdogReport.discrepancies_fixed,
          discrepancies_unresolved: watchdogReport.discrepancies_unresolved,
          duration_ms: durationMs,
          summary: watchdogReport.summary,
        },
        {},
        request,
        supabase  // pass authenticated client so session is resolved for user_id
      );
    } catch (_auditErr) {
      console.warn("Failed to write to audit_log:", _auditErr);
    }

    return NextResponse.json({
      success: true,
      mode: "full_sync",
      duration_ms: durationMs,
      finished_goods_reconciliation: fgResult,
      raw_materials_reconciliation: rmResult,
      integrity_report: watchdogReport,
      summary: watchdogReport.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
