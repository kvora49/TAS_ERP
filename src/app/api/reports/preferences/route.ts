import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

const view = z.object({ name: z.string().trim().min(1).max(80), href: z.string().max(2000).refine(value => /^\/reports(?:\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value)), favourite: z.boolean().optional() });
const preferences = z.object({ views: z.array(view).max(30), recent: z.array(view).max(8) }).strict();
async function context() {
  const client = createClient(), business = await getSessionBusinessId(), { data: { user } } = await client.auth.getUser();
  return { client, business, user };
}
export async function GET(req: NextRequest) {
  const { client, business, user } = await context();
  if (!business || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("x-report-business-id") !== business) return NextResponse.json({ error: "Company changed; reload your report" }, { status: 409 });
  const { data, error } = await client.from("report_preferences").select("preferences").eq("business_id", business).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load saved report views" }, { status: 500 });
  return NextResponse.json({ preferences: data?.preferences || null });
}
export async function PUT(req: NextRequest) {
  const { client, business, user } = await context();
  if (!business || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("x-report-business-id") !== business) return NextResponse.json({ error: "Company changed; reload your report" }, { status: 409 });
  const raw = await req.text();
  if (raw.length > 32768) return NextResponse.json({ error: "Report preferences are too large" }, { status: 400 });
  let parsed;
  try { parsed = preferences.safeParse(JSON.parse(raw)); } catch { return NextResponse.json({ error: "Invalid report preferences" }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: "Invalid report preferences" }, { status: 400 });
  const { error } = await client.from("report_preferences").upsert({ business_id: business, user_id: user.id, preferences: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "business_id,user_id" });
  if (error) return NextResponse.json({ error: "Unable to save report views" }, { status: 500 });
  return NextResponse.json({ success: true });
}
