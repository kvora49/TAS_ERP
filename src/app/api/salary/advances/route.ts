import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET: List unsettled employee advances for a worker or all workers
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get("worker_id");

  try {
    let query = supabase
      .from("employee_advances")
      .select(`
        id, advance_date, amount, payment_mode, notes, is_settled, created_at,
        worker:parties(id, name)
      `)
      .eq("business_id", businessId)
      .order("advance_date", { ascending: false });

    if (workerId) query = query.eq("worker_id", workerId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const advances = (data || []).map((a: any) => ({
      ...a,
      worker: Array.isArray(a.worker) ? a.worker[0] : a.worker,
    }));

    return NextResponse.json({ advances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Record a new employee advance
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { worker_id, advance_date, amount, payment_mode, notes } = await request.json();
    if (!worker_id || !advance_date || !amount) {
      return NextResponse.json({ error: "worker_id, advance_date and amount are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("employee_advances")
      .insert({
        business_id: businessId,
        worker_id,
        advance_date,
        amount: Number(amount),
        payment_mode: payment_mode || "cash",
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, advance: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
