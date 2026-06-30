import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    let query = supabase
      .from("worker_attendance")
      .select("*")
      .eq("worker_id", id)
      .eq("business_id", businessId)
      .order("attendance_date", { ascending: false });

    if (startDate) {
      query = query.gte("attendance_date", startDate);
    }
    if (endDate) {
      query = query.lte("attendance_date", endDate);
    }

    const { data: attendance, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendance: attendance || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { attendance_date, status, check_in, check_out, remarks } = body;

    if (!attendance_date || !status) {
      return NextResponse.json(
        { error: "Missing required fields (attendance_date, status)" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Calculate total hours if check_in and check_out are provided
    let total_hours = null;
    if (check_in && check_out) {
      const timeIn = new Date(`1970-01-01T${check_in}`);
      const timeOut = new Date(`1970-01-01T${check_out}`);
      const diffMs = timeOut.getTime() - timeIn.getTime();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        total_hours = `${hours} hours ${minutes} minutes`;
      }
    }

    // Upsert attendance record
    const { data: record, error } = await supabase
      .from("worker_attendance")
      .upsert(
        {
          business_id: businessId,
          worker_id: id,
          attendance_date,
          status,
          check_in: check_in || null,
          check_out: check_out || null,
          total_hours: total_hours,
          remarks: remarks || null,
          created_by: userId,
        },
        { onConflict: "business_id,worker_id,attendance_date" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ record });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
