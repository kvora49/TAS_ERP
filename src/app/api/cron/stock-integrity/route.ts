import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runStockIntegrityCheckJob, runStockIntegritySyncJob } from "@/lib/cron/stock-integrity";

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
  const __startTime = performance.now();
  const { supabase, businessId } = await resolveAuthAndClient(request);
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchdogReport = await runStockIntegrityCheckJob(supabase, businessId);
    return NextResponse.json({
      mode: "check_only",
      report: watchdogReport,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] GET /api/cron/stock-integrity - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}

/**
 * POST /api/cron/stock-integrity
 * Full reconciliation + watchdog fix + audit log recording.
 */
export async function POST(request: Request) {
  const __startTime = performance.now();
  const body = await request.json().catch(() => ({}));
  const { supabase, businessId } = await resolveAuthAndClient(request, body);
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { design_id } = body;
    const result = await runStockIntegritySyncJob(supabase, businessId, design_id, request);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] POST /api/cron/stock-integrity - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
