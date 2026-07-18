import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { SalesBillService } from "@/services/sales-bill.service";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new SalesBillRepository(supabase);
    
    // Fetch bill details and authenticated user in parallel
    const [detail, userResult] = await Promise.all([
      repo.getDetailById(params.id, businessId),
      supabase.auth.getUser()
    ]);

    if (!detail) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Role-gate profit data: only return it for owners/admins
    const user = userResult.data?.user || null;
    let profit = null;
    if (user) {
      const { data: member } = await supabase
        .from("business_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (member && (member.role === "owner" || member.role === "admin")) {
        profit = detail.profit;
      }
    }

    return NextResponse.json({
      bill: detail.bill,
      profit,
      brand: detail.brand,
      brandConfig: detail.brandConfig,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const repo = new SalesBillRepository(supabase);
    const service = new SalesBillService(repo);

    await service.validateAndUpdate(params.id, body, businessId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new SalesBillRepository(supabase);
    await repo.delete(params.id, businessId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
