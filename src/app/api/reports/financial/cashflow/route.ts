import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { readReportRows, requireReportResults } from "@/lib/report-data";
import { validReportRequest } from "@/lib/report-request";
import { cashflowReportFacts } from "@/lib/cashflow-report-facts";
export async function GET(req: NextRequest) {
 const supabase = createClient();
 const businessId = await getSessionBusinessId();
 if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 const params = new URL(req.url).searchParams;
 if (!validReportRequest(params)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
 const today = new Date();
 const from = params.get("from") || `${today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1}-04-01`;
 const to = params.get("to") || today.toISOString().slice(0, 10);
 try {
  // Correctness fix only; SQL refactors remain restricted to the six audited routes.
  const results = await Promise.all([
   readReportRows(supabase.from("bank_accounts").select("id,name,type,current_balance").eq("business_id", businessId).is("deleted_at", null).order("id")),
   readReportRows(supabase.from("payments").select("id,payment_number,payment_date,amount,payment_mode,direction,bank_account_id,party:parties(id,name,company_name)").eq("business_id", businessId).in("status", ["completed", "success"]).gte("payment_date", from).order("id")),
   readReportRows(supabase.from("job_work_payments").select("*,worker:workers(name)").eq("business_id", businessId).eq("status", "success").gte("payment_date", from).order("id")),
   readReportRows(supabase.from("misc_income").select("id,income_number,income_date,amount,income_type,received_in_account_id,notes").eq("business_id", businessId).gte("income_date", from).order("id")),
   readReportRows(supabase.from("expenses").select("id,expense_number,expense_date,amount,gst_amount,paid_from_account_id,vendor_name,notes").eq("business_id", businessId).gte("expense_date", from).order("id")),
   readReportRows(supabase.from("salary_entries").select("id,payment_date,net_salary,payment_mode,bank_account_id,worker:parties(id,name,company_name)").eq("business_id", businessId).gte("payment_date", from).order("id")),
  ]);
  requireReportResults(results);
  return NextResponse.json({ from, to, ...cashflowReportFacts(from, to, results[0].data, results[1].data, results[2].data, results[3].data, results[4].data, results[5].data) });
 } catch (error) {
  console.error("[reports/financial/cashflow]", error);
  return NextResponse.json({ error: "Unable to load cash flow" }, { status: 500 });
 }
}

