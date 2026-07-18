import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const formData = searchParams.get("form_data");

  try {
    if (formData === "true") {
      const [workersResult, banksResult] = await Promise.all([
        supabase
          .from("parties")
          .select("id, name, company_name, type")
          .eq("business_id", businessId)
          .contains("type", ["worker"])
          .is("deleted_at", null),
        supabase
          .from("bank_accounts")
          .select("id, account_name, bank_name")
          .eq("business_id", businessId)
          .is("deleted_at", null),
      ]);
      return NextResponse.json({
        workers: workersResult.data || [],
        bankAccounts: banksResult.data || [],
      });
    }

    const { data: salaries, error } = await supabase
      .from("salary_entries")
      .select(`
        id,
        salary_month,
        salary_year,
        base_salary,
        allowances,
        deductions,
        net_salary,
        payment_mode,
        payment_date,
        reference_no,
        remarks,
        worker:parties(id, name)
      `)
      .eq("business_id", businessId)
      .order("salary_year", { ascending: false })
      .order("salary_month", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ salaries: salaries || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      worker_id, salary_month, salary_year,
      base_salary, allowances, deductions,
      payment_mode, payment_date, bank_account_id, reference_no, remarks,
    } = body;

    if (!worker_id || !salary_month || !salary_year || !base_salary || !payment_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const net = Number(base_salary) + Number(allowances || 0) - Number(deductions || 0);

    // Check for duplicate
    const { data: existing } = await supabase
      .from("salary_entries")
      .select("id")
      .eq("business_id", businessId)
      .eq("worker_id", worker_id)
      .eq("salary_month", salary_month)
      .eq("salary_year", salary_year)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Salary for this worker and month already exists." },
        { status: 409 }
      );
    }

    const { data: entry, error } = await supabase
      .from("salary_entries")
      .insert({
        business_id: businessId,
        worker_id,
        salary_month: Number(salary_month),
        salary_year: Number(salary_year),
        base_salary: Number(base_salary),
        allowances: Number(allowances || 0),
        deductions: Number(deductions || 0),
        net_salary: net,
        payment_mode,
        payment_date,
        bank_account_id: payment_mode === "cash" ? null : bank_account_id || null,
        reference_no: reference_no || null,
        remarks: remarks || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
