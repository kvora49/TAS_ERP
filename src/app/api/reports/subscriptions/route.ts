import { NextRequest, NextResponse } from "next/server";
import { subscriptionSchema } from "@/lib/report-snapshot";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { reportSubscriptionPeriod } from "@/lib/report-subscription-period";

async function context(req: NextRequest) {
  const client=createClient(), business=await getSessionBusinessId(), {data:{user}}=await client.auth.getUser();
  if (!business || !user || req.headers.get("x-report-business-id")!==business) return null;
  const {data:profile,error}=await client.from("users").select("role,business_id").eq("id",user.id).maybeSingle();
  if(error || profile?.business_id!==business || !["owner","admin"].includes(profile.role)) return null;
  return {client,business,user};
}
export async function GET(req: NextRequest) {
  const ctx=await context(req); if(!ctx) return NextResponse.json({error:"Owner/admin company access required"},{status:403});
  const [subscriptions,runs]=await Promise.all([
    ctx.client.from("report_subscriptions").select("id,cadence,enabled,next_run_at,report_key,params").eq("business_id",ctx.business).eq("user_id",ctx.user.id).order("created_at"),
    ctx.client.from("report_subscription_runs").select("id,status,from_date,to_date,created_at,error,expires_at,report_key").eq("business_id",ctx.business).eq("user_id",ctx.user.id).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(30),
  ]);
  if(subscriptions.error || runs.error) return NextResponse.json({error:"Scheduled exports are unavailable"},{status:500});
  return NextResponse.json({subscriptions:subscriptions.data,runs:runs.data,recipient:ctx.user.email,delivery:"Private in-app export inbox"});
}
export async function POST(req: NextRequest) {
  const ctx=await context(req); if(!ctx) return NextResponse.json({error:"Owner/admin company access required"},{status:403});
  const body=await req.json().catch(()=>null), parsed=subscriptionSchema.safeParse(body);
  if(!parsed.success) return NextResponse.json({error:"Invalid export schedule"},{status:400});
  if(parsed.data.report_key==="ledger"){const {data:party,error}=await ctx.client.from("parties").select("id").eq("id",parsed.data.party_id!).eq("business_id",ctx.business).is("deleted_at",null).maybeSingle();if(error)return NextResponse.json({error:"Unable to validate party"},{status:500});if(!party)return NextResponse.json({error:"Ledger party not found"},{status:404});}
  const now=new Date(), next=reportSubscriptionPeriod(parsed.data.cadence,now).next;
  const {error}=await ctx.client.from("report_subscriptions").upsert({business_id:ctx.business,user_id:ctx.user.id,cadence:parsed.data.cadence,report_key:parsed.data.report_key,params:parsed.data.party_id?{party_id:parsed.data.party_id}:{},enabled:parsed.data.enabled,next_run_at:next},{onConflict:"business_id,user_id,cadence,report_key"});
  if(error) return NextResponse.json({error:"Unable to save export schedule"},{status:500});
  return NextResponse.json({success:true});
}
