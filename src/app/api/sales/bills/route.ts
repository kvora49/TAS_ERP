import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { SalesBillService } from "@/services/sales-bill.service";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "pakka";
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
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    
    const repo = new SalesBillRepository(supabase);
    const service = new SalesBillService(repo);

    const bill = await service.validateAndCreate(body, businessId, user?.id || null);

    return NextResponse.json({ data: bill });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
