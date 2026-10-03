import { scheduledReportRPC } from "@/lib/report-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportSubscriptionPeriod } from "@/lib/report-subscription-period";

export async function runReportSubscriptionsJob(suppliedClient?: ReturnType<typeof createAdminClient>, now = new Date()) {
  const client = suppliedClient ?? createAdminClient();
  // Delete expired private snapshots in bounded batches; never scan every company in JS.
  const { data: expired, error: retentionError } = await client.from("report_subscription_runs").select("id").lte("expires_at", now.toISOString()).order("expires_at").limit(100);
  if (retentionError) throw retentionError;
  if (expired?.length) { const { error: cleanupError } = await client.from("report_subscription_runs").delete().in("id", expired.map((row: { id: string }) => row.id)).lte("expires_at", now.toISOString()); if (cleanupError) throw cleanupError; }
  const {data:jobs,error}=await client.rpc("claim_report_subscriptions");
  if(error)throw error;
  let ready=0,failed=0;
  for(const job of jobs||[]) {
   const period=reportSubscriptionPeriod(job.cadence,new Date(job.next_run_at));
   const {data:user,error:accessError}=await client.from("users").select("id,business_id,role").eq("id",job.user_id).maybeSingle();
   // Recheck recipient access before every execution, not only when the subscription was created.
   if(accessError)throw accessError;
   if(!user||user.business_id!==job.business_id||!["owner","admin"].includes(user.role)) {
    const {error:disabled}=await client.from("report_subscriptions").update({enabled:false,lease_until:null,lease_id:null}).eq("id",job.id).eq("lease_id",job.lease_id);if(disabled)throw disabled;
    continue;
   }
   let payload=null,reason=null;
   try {
    const spec=scheduledReportRPC(job.report_key||"analysis",job.business_id,period.from,period.to,job.params||{});
    const result=await client.rpc(spec.name,spec.args);
    if(result.error||result.data==null||result.data.error)reason="Report generation failed"; else if(Buffer.byteLength(JSON.stringify(result.data))>1250000)reason="Export exceeded the supported snapshot size";else payload=result.data;
   }catch{reason="Invalid report scope or generation failure";}
   const {error:stored}=await client.from("report_subscription_runs").upsert({subscription_id:job.id,business_id:job.business_id,user_id:job.user_id,scheduled_for:job.next_run_at,report_key:job.report_key||"analysis",status:reason?"failed":"ready",from_date:period.from,to_date:period.to,payload,error:reason},{onConflict:"subscription_id,scheduled_for",ignoreDuplicates:true});
   if(stored)throw stored;
   const next=reportSubscriptionPeriod(job.cadence,now).next;
   const {error:advanced}=await client.from("report_subscriptions").update({next_run_at:next,lease_until:null,lease_id:null}).eq("id",job.id).eq("lease_id",job.lease_id);if(advanced)throw advanced;
   if(reason)failed++;else ready++;
  }
  return {ready,failed,expiredRemoved:expired?.length ?? 0};
}
