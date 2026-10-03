import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { z } from "zod";
import { openingActionSchema } from "@/lib/report-opening-balances";

async function context(request: NextRequest) {
  const client = createClient(), business = await getSessionBusinessId();
  const { data: { user } } = await client.auth.getUser();
  if (!business || !user || request.headers.get("x-report-business-id") !== business) return null;
  const { data: member, error: memberError } = await client
    .from("company_members")
    .select("role,company_id,status")
    .eq("user_id", user.id)
    .eq("company_id", business)
    .eq("status", "active")
    .maybeSingle();
  if (!memberError && member?.company_id === business && ["owner", "admin", "accountant"].includes(member.role)) return { client, business, user };
  const { data, error } = await client.from("users").select("role,business_id").eq("id", user.id).maybeSingle();
  return !error && data?.business_id === business && ["owner", "admin", "accountant"].includes(data.role) ? { client, business, user } : null;
}
export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ error: "Financial company access required" }, { status: 403 });
  const entryId=request.nextUrl.searchParams.get("id");
  if(entryId){
    if(!z.string().uuid().safeParse(entryId).success)return NextResponse.json({error:"Invalid entry"},{status:400});
    const [entry,audit]=await Promise.all([ctx.client.from("report_opening_balances").select("*").eq("id",entryId).eq("business_id",ctx.business).maybeSingle(),ctx.client.from("report_opening_balance_audit").select("action,version,note,created_at",{count:"exact"}).eq("entry_id",entryId).eq("business_id",ctx.business).order("created_at",{ascending:false}).limit(50)]);
    if(entry.error||audit.error)return NextResponse.json({error:"Unable to load entry history"},{status:500});
    if(!entry.data)return NextResponse.json({error:"Entry not found"},{status:404});
    return NextResponse.json({entry:entry.data,audit:audit.data,auditTotal:audit.count});
  }
  const page = Number(request.nextUrl.searchParams.get("page") || 0);
  if (!Number.isInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const { data, error, count } = await ctx.client.from("report_opening_balances").select("id,as_of,title,status,debit_total,credit_total,prepared_by,reviewed_by,reviewed_at,review_note,version", { count: "exact" }).eq("business_id", ctx.business).order("as_of", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
  if (error) {
    console.error("opening-balances:list", { code: error.code, message: error.message });
    return NextResponse.json({ error: error.code === "42P01" ? "Opening-balance migration has not been applied" : "Unable to load opening entries" }, { status: 500 });
  }
  return NextResponse.json({ rows: data, total: count, page, pageSize: 20 });
}
export async function POST(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ error: "Financial company access required" }, { status: 403 });
  const text = await request.text();
  if (text.length > 131072) return NextResponse.json({ error: "Entry is too large" }, { status: 400 });
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid entry" }, { status: 400 }); }
  const parsed = openingActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry fields or review explanation" }, { status: 400 });
  const input = parsed.data;
  const operation = input.action === "revise"
    ? ctx.client.rpc("revise_report_opening_balance", { p_business_id: ctx.business, p_id: input.id, p_version: input.version })
    : ctx.client.rpc("write_report_opening_balance", { p_business_id: ctx.business, p_id: input.id, p_version: input.version, p_action: input.action, p_draft: input.action === "approve" ? { complete_position: input.complete_position } : input.draft || null, p_review_note: input.review_note || null });
  const { data, error } = await operation;
  if (error) {
    const messages: Record<string, [number, string]> = { "40001": [409, "Entry changed; reload before saving"], "42501": [403, "Only the preparer can edit/submit; a different financial user must review"], "23505": [409, "An approved position or active correction already exists for that date"], "22023": [400, "Check that the entry balances, every line has a source reference, and the review explanation is complete"], P0002: [404, "Entry not found"] };
    const [status, message] = messages[error.code] || [500, "Unable to update opening entry"];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ entry: data });
}
