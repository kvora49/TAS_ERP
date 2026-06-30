import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. Get worker details
    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select(`
        *,
        preferred_stage:production_stages(id, name)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (workerError) {
      return NextResponse.json({ error: workerError.message }, { status: 404 });
    }

    // 2. Get Job Work Stats (Total Job Work Amount, Paid Amount)
    const { data: stageEntries, error: seError } = await supabase
      .from("stage_entries")
      .select("total_job_work_amount, qty_out")
      .eq("worker_id", id)
      .eq("business_id", businessId);

    const { data: payments, error: pmError } = await supabase
      .from("job_work_payments")
      .select("paid_amount")
      .eq("worker_id", id)
      .eq("business_id", businessId)
      .eq("status", "success");

    let totalJobWorkAmount = 0;
    let totalQtyCompleted = 0;
    if (stageEntries) {
      stageEntries.forEach((entry) => {
        totalJobWorkAmount += parseFloat(entry.total_job_work_amount as any || 0);
        totalQtyCompleted += parseInt(entry.qty_out as any || 0, 10);
      });
    }

    let totalPaidAmount = 0;
    if (payments) {
      payments.forEach((payment) => {
        totalPaidAmount += parseFloat(payment.paid_amount as any || 0);
      });
    }

    const currentOutstanding = totalJobWorkAmount - totalPaidAmount;

    // 3. Get Attendance stats
    const { data: attendance, error: attError } = await supabase
      .from("worker_attendance")
      .select("status")
      .eq("worker_id", id)
      .eq("business_id", businessId);

    let totalDays = 0;
    let presentDays = 0;
    if (attendance) {
      totalDays = attendance.length;
      presentDays = attendance.filter((a) => a.status === "present" || a.status === "half_day").length;
    }

    // 4. Get documents
    const { data: documents } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("worker_id", id)
      .eq("business_id", businessId);

    return NextResponse.json({
      worker,
      stats: {
        totalJobWorkAmount,
        totalPaidAmount,
        currentOutstanding,
        totalQtyCompleted,
        attendance: {
          totalDays,
          presentDays,
          attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
        },
      },
      documents: documents || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
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

  const { id } = params;

  try {
    const body = await request.json();
    const {
      name,
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

    if (!name || !type) {
      return NextResponse.json(
        { error: "Missing required fields (name, type)" },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const { data: oldWorker } = await supabase
      .from("workers")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    const { data: worker, error } = await supabase
      .from("workers")
      .update({
        name,
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log audit trail
    await logAudit(businessId, "update", "workers", id, worker, oldWorker || {});

    return NextResponse.json({ worker });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
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

  const { id } = params;

  try {
    const { data: oldWorker } = await supabase
      .from("workers")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    const { error } = await supabase
      .from("workers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log audit trail
    await logAudit(businessId, "delete", "workers", id, null, oldWorker || {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
