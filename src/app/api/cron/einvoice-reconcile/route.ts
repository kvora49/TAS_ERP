import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runEinvoiceReconcileJob } from "@/lib/cron/einvoice-reconcile";

async function handleReconciliation(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  const isCronAuth = !!(
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret)
  );

  let businessId: string | null = null;
  let supabase: any;

  if (isCronAuth) {
    supabase = createAdminClient();
  } else {
    businessId = await getSessionBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    supabase = createClient();
  }

  try {
    const result = await runEinvoiceReconcileJob({
      businessId: businessId || undefined,
      customSupabase: supabase,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Fatal error during e-invoice reconciliation:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during reconciliation." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleReconciliation(request);
}

export async function POST(request: Request) {
  return handleReconciliation(request);
}
