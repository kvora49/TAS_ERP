import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { readReportRows, requireReportResults } from "@/lib/report-data";
import { validReportRequest } from "@/lib/report-request";
import { gstReportFacts } from "@/lib/gst-report-facts";
export async function GET(req: NextRequest) {
 const supabase = createClient(), businessId = await getSessionBusinessId();
 if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 const params = new URL(req.url).searchParams;
 if (!validReportRequest(params)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
 const today = new Date(), from = params.get("from") || `${today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1}-04-01`, to = params.get("to") || today.toISOString().slice(0,10);
 try {
  const results = await Promise.all([
   readReportRows(supabase.from("sale_bills").select("*,party:parties(name,company_name,gstin)").eq("business_id",businessId).eq("status","active").eq("bill_type","pakka").is("deleted_at",null).gte("bill_date",from).lte("bill_date",to).order("id")),
   readReportRows(supabase.from("raw_material_purchases").select("*,party:parties(name,company_name,gstin)").eq("business_id",businessId).neq("status","cancelled").is("deleted_at",null).neq("gst_type","without_gst").gte("invoice_date",from).lte("invoice_date",to).order("id")),
   readReportRows(supabase.from("expenses").select("*,expense_type:expense_types(name)").eq("business_id",businessId).gt("gst_amount",0).gte("expense_date",from).lte("expense_date",to).order("id")),
   readReportRows(supabase.from("purchase_bills").select("*,party:parties(name,company_name,gstin)").eq("business_id",businessId).neq("status","cancelled").gte("invoice_date",from).lte("invoice_date",to).order("id")),
   readReportRows(supabase.from("sales_returns").select("*,party:parties(name,company_name,gstin),bill:sale_bills(bill_type)").eq("business_id",businessId).eq("status","approved").gte("return_date",from).lte("return_date",to).order("id")),
   readReportRows(supabase.from("purchase_returns").select("*,party:parties(name,company_name,gstin),purchase:raw_material_purchases(gst_type)").eq("business_id",businessId).eq("status","completed").is("deleted_at",null).gte("return_date",from).lte("return_date",to).order("id")),
   readReportRows(supabase.from("credit_notes").select("*,party:parties(name,company_name,gstin),linked_return:sales_returns(status)").eq("business_id",businessId).gte("cn_date",from).lte("cn_date",to).order("id")),
   readReportRows(supabase.from("debit_notes").select("*,party:parties(name,company_name,gstin),linked_return:purchase_returns(status)").eq("business_id",businessId).gte("dn_date",from).lte("dn_date",to).order("id")),
  ]);
  requireReportResults(results);
  return NextResponse.json({from,to,...gstReportFacts(...results.map(r=>r.data) as [any[],any[],any[],any[],any[],any[],any[],any[]])});
 } catch(error) {
  console.error("[reports/financial/gst]",error);
  return NextResponse.json({error:"Unable to load tax source report"},{status:500});
 }
}

