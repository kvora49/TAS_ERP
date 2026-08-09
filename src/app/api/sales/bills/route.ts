import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { SalesBillService } from "@/services/sales-bill.service";
import { logAudit } from "@/lib/audit";
import { onSalesBillCreated } from "@/lib/calendar-integration";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const partyId = searchParams.get("party_id") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const startDate = searchParams.get("start_date") || undefined;
  const endDate = searchParams.get("end_date") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const repo = new SalesBillRepository(supabase);
    const { data, total } = await repo.list(businessId, {
      page,
      limit,
      type,
      partyId,
      status,
      search,
      startDate,
      endDate,
    });

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const idempotencyKey = request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");
    if (idempotencyKey) {
      const existing = await supabase
        .from("sale_bills")
        .select("*")
        .eq("business_id", businessId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing.data) {
        return NextResponse.json({ data: existing.data });
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    if (idempotencyKey) {
      body.idempotency_key = idempotencyKey;
    }

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    if (body.type === "kacha" && !serverSettings.enable_kacha_billing) {
      return NextResponse.json(
        { error: "Kaacha (Estimate) billing is currently disabled in system settings." },
        { status: 400 }
      );
    }

    const repo = new SalesBillRepository(supabase);
    const service = new SalesBillService(repo);

    const bill = await service.validateAndCreate(body, businessId, user?.id || null);

    // Fire-and-forget audit log
    void logAudit(businessId, "create", "sale_bills", bill.id, {
      bill_number: bill.bill_number,
      grand_total: bill.grand_total,
      party_id: bill.party_id,
      type: bill.type,
    });

    // Fire-and-forget calendar integration — auto-create payment reminder
    if (bill.due_date || bill.bill_date) {
      // Fetch party name for the reminder title
      const { data: party } = await supabase
        .from("parties")
        .select("name, company_name")
        .eq("id", bill.party_id)
        .maybeSingle();
      const partyName = party?.company_name || party?.name || "Customer";
      const dueDate = bill.due_date || bill.bill_date;

      void onSalesBillCreated(supabase, {
        businessId,
        billId: bill.id,
        billNumber: bill.bill_number,
        partyName,
        dueDate,
        grandTotal: Number(bill.grand_total || 0),
        createdBy: user?.id || null,
      });
    }

    // Reconcile finished stock ground-truth after sales bill creation
    const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
    void reconcileFinishedStock(supabase, businessId).catch(err => console.error("Sales bill stock reconciliation error:", err));

    return NextResponse.json({ data: bill });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
