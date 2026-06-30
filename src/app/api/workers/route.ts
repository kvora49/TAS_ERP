import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") === "true";
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("workers")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,worker_id.ilike.%${search}%,phone.ilike.%${search}%,specialization.ilike.%${search}%`
      );
    }

    const { data: workers, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workers: workers || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      worker_id,
      type,
      phone,
      email,
      address,
      city,
      state,
      gstin,
      pan,
      aadhaar,
      specialization,
      preferred_stage_id,
      default_rate,
      max_capacity_per_day,
      payment_mode,
      payment_cycle,
      working_since,
      bank_name,
      account_number,
      ifsc_code,
      account_holder_name,
      remarks,
      is_active,
    } = body;

    if (!name || !worker_id || !type) {
      return NextResponse.json(
        { error: "Missing required fields (name, worker_id, type)" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const { data: worker, error } = await supabase
      .from("workers")
      .insert({
        business_id: businessId,
        name,
        worker_id,
        type,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        gstin: gstin || null,
        pan: pan || null,
        aadhaar: aadhaar || null,
        specialization: specialization || null,
        preferred_stage_id: preferred_stage_id || null,
        default_rate: default_rate ? parseFloat(default_rate) : 0,
        max_capacity_per_day: max_capacity_per_day ? parseInt(max_capacity_per_day, 10) : null,
        payment_mode: payment_mode || "bank_transfer",
        payment_cycle: payment_cycle || "weekly",
        working_since: working_since || null,
        bank_name: bank_name || null,
        account_number: account_number || null,
        ifsc_code: ifsc_code || null,
        account_holder_name: account_holder_name || null,
        remarks: remarks || null,
        is_active: is_active !== false,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log audit trail
    await logAudit(businessId, "create", "workers", worker.id, worker);

    return NextResponse.json({ worker });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
