"use client";
import { useEffect, useState } from "react";
import { useReportQuery } from "@/hooks/useReportQuery";
import PageState from "@/components/shared/PageState";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import AsyncButton from "@/components/shared/AsyncButton";
import { reportSnapshotSheets, scheduledReportKeys } from "@/lib/report-snapshot";
import { exportMultiSheetExcel, fmtDate } from "@/lib/report-export";

export default function ReportSubscriptions() {
 const company=useAppStore(s=>s.selectedBusinessId||s.user?.businessId), role=useAppStore(s=>s.user?.role);
 const [expanded,setExpanded]=useState(false),[cadence,setCadence]=useState("monthly");
 const [reportKey,setReportKey]=useState("analysis"),[partyId,setPartyId]=useState("");
 useEffect(()=>{setPartyId("");setReportKey("analysis");},[company]);
 const {data:partyData}=useReportQuery({queryKey:["subscription-ledger-parties"],enabled:expanded&&reportKey==="ledger",queryFn:async()=>{const response=await fetch("/api/parties");if(!response.ok)throw new Error("Unable to load parties");return response.json();}});
 const permitted=role==="owner"||role==="admin";
 const {data,error,isLoading,refetch}=useReportQuery({ queryKey:["report-subscriptions"], enabled:permitted&&expanded, queryFn:async()=>{const response=await fetch("/api/reports/subscriptions",{headers:{"x-report-business-id":company||""}});if(!response.ok)throw new Error("Scheduled exports are unavailable. Check company access and apply the subscriptions migration.");return response.json();} });
 const save=async(value:string,enabled:boolean,key=reportKey,party=partyId)=>{try{const response=await fetch("/api/reports/subscriptions",{method:"POST",headers:{"Content-Type":"application/json","x-report-business-id":company||""},body:JSON.stringify({cadence:value,enabled,report_key:key,...(key==="ledger"?{party_id:party}:{})})});if(!response.ok)throw new Error("Unable to save subscription");await refetch();toast.success(enabled?"Private export schedule saved":"Export schedule paused");}catch{toast.error("Unable to save export schedule");}};
 const download=async(id:string)=>{try{const response=await fetch(`/api/reports/subscriptions/${id}`);if(!response.ok)throw new Error("Export unavailable");const result=await response.json(),p=result.payload;
 const sheets=reportSnapshotSheets(p);
 sheets.push({name:"Context",columns:[{key:"field",label:"Field",width:24},{key:"value",label:"Value",width:70}],rows:[{field:"Period",value:`${result.from_date} to ${result.to_date}`},{field:"Generated report",value:`${result.report_key||"analysis"}; original snapshot, not recalculated at download`},{field:"Scope",value:result.report_key==="stock"?"Current stock captured at execution; not historical stock":result.report_key==="ledger"?"Complete posted ledger captured at execution, including all voucher dates; not a period statement":"Company-wide report for the scheduled completed period/cutoff"},{field:"Basis",value:JSON.stringify(p.metadata||{})}]});
 await exportMultiSheetExcel(sheets,`${result.report_key||"analysis"}_snapshot_${result.from_date}_${result.to_date}`);
 }catch{toast.error("Unable to download scheduled export");}};
 if(!permitted)return null;
 return <section className="border border-[var(--border)] rounded-lg p-3 text-xs min-w-0">
  <AsyncButton variant="ghost" onClick={()=>setExpanded(!expanded)} className="min-h-11">Scheduled private reports {expanded?"−":"+"}</AsyncButton>
  {expanded&&<div className="space-y-3">
   <p className="text-[var(--text-muted)]">Owner/admin private inbox. Period reports cover yesterday, the last completed seven days, or the previous month. Balance uses the completed-period cutoff. Stock and full party ledgers are current snapshots captured at execution. Snapshots expire after 30 days. No email or public delivery is enabled. Automatic execution uses the hourly Worker job once the migrations and Worker are deployed.</p>
   <PageState isLoading={isLoading} isError={!!error} error={error?.message} onRetry={refetch} isEmpty={false} skeletonVariant="table" skeletonRows={3} skeletonColumns={3}>
   {data&&<><p>Recipient: {data.recipient} · {data.delivery}</p><div className="flex flex-wrap gap-2"><select aria-label="Executive export cadence" value={cadence} onChange={e=>setCadence(e.target.value)} className="min-h-11 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)]">{["daily","weekly","monthly"].map(c=><option key={c} value={c}>{c}</option>)}</select><select aria-label="Scheduled report" value={reportKey} onChange={e=>setReportKey(e.target.value)} className="min-h-11 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)]">{scheduledReportKeys.map(key=><option key={key} value={key}>{key==="pl"?"Profit and Loss":key}</option>)}</select>{reportKey==="ledger"&&<select aria-label="Ledger party" value={partyId} onChange={e=>setPartyId(e.target.value)} className="min-h-11 max-w-full px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)]"><option value="">Choose party</option>{(partyData?.parties||[]).map((party:any)=><option key={party.id} value={party.id}>{party.company_name||party.name}</option>)}</select>}<AsyncButton variant="outline" disabled={reportKey==="ledger"&&!partyId} onClick={()=>save(cadence,true)} className="min-h-11">Enable private export</AsyncButton></div>
   <div className="space-y-2">{data.subscriptions.map((s:any)=><div key={s.id} className="flex flex-wrap items-center gap-2"><span>{s.report_key} / {s.cadence} · {s.enabled?"Enabled":"Paused"} · Next eligible run: {new Date(s.next_run_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</span><AsyncButton variant="ghost" onClick={()=>save(s.cadence,!s.enabled,s.report_key,s.params?.party_id||"")} className="min-h-11">{s.enabled?"Pause":"Resume"}</AsyncButton></div>)}</div>
   <p className="font-semibold">Execution history · Latest 30 unexpired runs</p><div className="space-y-2">{data.runs.map((r:any)=><div key={r.id} className="flex flex-wrap gap-2 items-center"><span>{r.report_key} / {fmtDate(r.from_date)}–{fmtDate(r.to_date)} · {r.status}{r.error?` · ${r.error}`:""}</span>{r.status==="ready"&&<AsyncButton variant="outline" onClick={()=>download(r.id)} className="min-h-11">Download Excel snapshot</AsyncButton>}</div>)}{!data.runs.length&&<p className="text-[var(--text-muted)]">No exports generated yet.</p>}</div></>}
   </PageState>
  </div>}
 </section>;
}
