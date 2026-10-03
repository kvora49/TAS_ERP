"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { useReportQuery } from "@/hooks/useReportQuery";
import { invalidateReports } from "@/lib/report-cache";
import { openingAccountKinds, openingDraftSchema, openingTotals, type OpeningDraft } from "@/lib/report-opening-balances";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import ReportTable from "@/components/reports/ReportTable";
import { fmtDate, fmtINR } from "@/lib/report-export";

const inputClass = "w-full min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 min-h-10 text-sm transition-colors";
const newLine = () => ({kind:"cash" as const,label:"",debit:0,credit:0,quantity:null,unit:"",reference:""});
const newDraft = (): OpeningDraft => ({as_of:new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Kolkata"}),title:"Opening position",notes:"",lines:[newLine()]});
export default function OpeningBalancesPage() {
  const company = useAppStore(s => s.selectedBusinessId || s.user?.businessId), user = useAppStore(s => s.user);
  const allowed = ["owner","admin","accountant"].includes(user?.role || "");
  const queryClient = useQueryClient();
  const [page,setPage] = useState(0), [entry,setEntry] = useState<any>(null), [open,setOpen] = useState(false);
  const [complete,setComplete] = useState(false);
  const [draft,setDraft] = useState<OpeningDraft>(newDraft), [review,setReview] = useState("");
  const {data,isLoading,error,refetch} = useReportQuery({queryKey:["report-opening-balances",page],enabled:allowed,queryFn:async()=>{
    const result=await fetch(`/api/reports/opening-balances?page=${page}`,{headers:{"x-report-business-id":company||""}});if(!result.ok)throw new Error("Unable to load opening entries. Check access and apply the opening-balance migration.");return result.json();
  }});
  useEffect(()=>{setOpen(false);setEntry(null);setPage(0);setDraft(newDraft());setReview("");setComplete(false);},[company]);
  const [history,setHistory] = useState<any>(null);
  const openEntry = async(row:any)=>{try{const result=await queryClient.fetchQuery({queryKey:["opening-entry",row.id,row.version,"report-company",company,user?.id],staleTime:300000,queryFn:async()=>{const response=await fetch(`/api/reports/opening-balances?id=${row.id}`,{headers:{"x-report-business-id":company||""}});if(!response.ok)throw new Error("Unable to load entry");return response.json();}});const active=useAppStore.getState();if((active.selectedBusinessId||active.user?.businessId)!==company)return;setEntry(result.entry);setHistory(result);setDraft({as_of:result.entry.as_of,title:result.entry.title,notes:result.entry.notes,lines:result.entry.lines});setReview("");setComplete(false);setOpen(true);}catch{toast.error("Unable to load opening entry");}};
  const totals = openingTotals(draft.lines);
  const unsaved = !!entry && JSON.stringify(draft)!==JSON.stringify({as_of:entry.as_of,title:entry.title,notes:entry.notes,lines:entry.lines});
  const editable = !entry || (entry.prepared_by===user?.id && ["draft","rejected"].includes(entry.status));
  const action = async (value: "save"|"submit"|"approve"|"reject"|"revise") => {
    if(value==="save" && !openingDraftSchema.safeParse(draft).success){toast.error("Check account labels, amounts and dates");return;}
    try {
      const response=await fetch("/api/reports/opening-balances",{method:"POST",headers:{"Content-Type":"application/json","x-report-business-id":company||""},body:JSON.stringify({id:entry?.id||null,version:entry?.version||0,action:value,...(value==="save"?{draft}:{}),review_note:review,complete_position:complete})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      const active=useAppStore.getState();if((active.selectedBusinessId||active.user?.businessId)!==company)return;
      setEntry(result.entry);setDraft({as_of:result.entry.as_of,title:result.entry.title,notes:result.entry.notes,lines:result.entry.lines});
      await invalidateReports(queryClient);await openEntry(result.entry);toast.success(`Entry ${value==='save'?'saved':value==='submit'?'submitted':value==='approve'?'approved':value==='revise'?'correction draft created':'rejected'}`);
    }catch(error){toast.error(error instanceof Error?error.message:"Unable to update entry");}
  };
  const changeLine = (index:number, field:string, value:unknown) => setDraft(current=>({...current,lines:current.lines.map((line,i)=>i===index?{...line,[field]:value}:line)}));
  if(!allowed)return <p className="p-6 text-[var(--text-muted)]">Opening positions require owner, admin or accountant access.</p>;
  return <div className="p-3 sm:p-6 min-w-0 space-y-4">
    <Link className="text-sm text-[var(--primary)]" href="/reports/financial?tab=balance">Back to Financial reports</Link>
    <h1 className="text-xl font-semibold text-[var(--text-primary)]">Reviewed opening balances</h1>
    <p className="text-sm text-[var(--text-muted)]">Enter a dated trial balance from verified records, including equity, fixed assets/depreciation and WIP. A different owner, admin or accountant must review it. Approved positions are immutable and apply to their exact date; they do not change payment vouchers or current stock.</p>
    <AsyncButton onClick={()=>{setEntry(null);setHistory(null);setDraft(newDraft());setReview("");setComplete(false);setOpen(true);}}>New opening entry</AsyncButton>
    <PageState isLoading={isLoading} isError={!!error} error={error?.message} onRetry={refetch} isEmpty={!isLoading&&!error&&(data?.rows?.length||0)===0} emptyTitle="No reviewed positions yet" emptyDescription="Create a dated position from verified accounting records, then submit it for independent review." emptyAction={<AsyncButton onClick={()=>{setEntry(null);setHistory(null);setDraft(newDraft());setOpen(true);}}>Create opening entry</AsyncButton>} skeletonVariant="table" skeletonRows={5} skeletonColumns={6}>
      <ReportTable className="w-full text-xs"><thead><tr>{["As of","Title","Status","Debit","Credit","Source / review"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{(data?.rows||[]).map((row:any)=>{
        const sum={debit:row.debit_total,credit:row.credit_total};return <tr key={row.id}><td>{fmtDate(row.as_of)}</td><td>{row.title}</td><td>{row.status}</td><td>{fmtINR(sum.debit)}</td><td>{fmtINR(sum.credit)}</td><td><AsyncButton variant="ghost" onClick={()=>openEntry(row)}>Open entry</AsyncButton></td></tr>;
      })}</tbody></ReportTable>
      <div className="flex flex-wrap gap-3 items-center text-xs"><button className="min-h-11" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>{data?.total||0} entries / page {page+1}</span><button className="min-h-11" disabled={(page+1)*20 >= (data?.total||0)} onClick={()=>setPage(page+1)}>Next</button></div>
    </PageState>
    <Modal open={open} onOpenChange={setOpen} title={entry?`${entry.title} / ${entry.status}`:"New opening position"} maxWidth="max-w-5xl">
      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs text-[var(--text-muted)]">As of<input disabled={!editable} type="date" className={inputClass} value={draft.as_of} onChange={e=>setDraft({...draft,as_of:e.target.value})}/></label><label className="text-xs text-[var(--text-muted)]">Title<input disabled={!editable} className={inputClass} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label></div>
        <label className="block text-xs text-[var(--text-muted)]">Basis / accounting notes<textarea disabled={!editable} className={inputClass} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
        <p className="text-xs text-[var(--text-muted)]">Use debit for asset balances and credit for liabilities/equity. Record depreciation as a credit under fixed assets. Every line needs a document/reference before submission. Stock/WIP quantities need their actual units.</p>
        <div className="space-y-3">{draft.lines.map((line,index)=><fieldset key={index} className="min-w-0 border border-[var(--border)] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <legend className="text-xs text-[var(--text-muted)] px-1">Line {index+1}</legend>
          <label className="text-xs">Account kind<select disabled={!editable} className={inputClass} value={line.kind} onChange={e=>changeLine(index,"kind",e.target.value)}>{openingAccountKinds.map(kind=><option key={kind} value={kind}>{kind.replaceAll('_',' ')}</option>)}</select></label>
          <label className="text-xs">Account / lot / stock label<input disabled={!editable} className={inputClass} value={line.label} onChange={e=>changeLine(index,"label",e.target.value)}/></label>
          {(["debit","credit"] as const).map(field=><label key={field} className="text-xs">{field}<input disabled={!editable} type="number" min="0" step="0.01" className={inputClass} value={line[field]} onChange={e=>changeLine(index,field,Number(e.target.value))}/></label>)}
          <label className="text-xs">Quantity (if recorded)<input disabled={!editable} type="number" min="0" step="0.001" className={inputClass} value={line.quantity??""} onChange={e=>changeLine(index,"quantity",e.target.value===""?null:Number(e.target.value))}/></label>
          <label className="text-xs">Unit<input disabled={!editable} className={inputClass} value={line.unit||""} onChange={e=>changeLine(index,"unit",e.target.value)}/></label>
          <label className="text-xs sm:col-span-2">Source reference<input disabled={!editable} className={inputClass} value={line.reference} onChange={e=>changeLine(index,"reference",e.target.value)}/></label>
          {editable&&<button className="text-xs min-h-11 text-[var(--text-muted)]" disabled={draft.lines.length===1} onClick={()=>setDraft({...draft,lines:draft.lines.filter((_,i)=>i!==index)})}>Remove line</button>}
        </fieldset>)}</div>
        {editable&&<button className="min-h-11 text-xs text-[var(--primary)]" disabled={draft.lines.length>=100} onClick={()=>setDraft({...draft,lines:[...draft.lines,newLine()]})}>Add account line</button>}
        <p className="text-sm text-[var(--text-primary)]">Debit {fmtINR(totals.debit)} / Credit {fmtINR(totals.credit)} / Difference {fmtINR(totals.difference)}</p>
        {history&&<section className="text-xs text-[var(--text-muted)] space-y-2"><p>Audit history: latest {history.audit.length} of {history.auditTotal} actions</p>{history.audit.map((event:any,index:number)=><p key={index}>{event.action} / version {event.version} / {fmtDate(event.created_at)} {event.note||""}</p>)}</section>}
        {entry?.review_note&&<p className="text-xs text-[var(--text-muted)]">Recorded review: {entry.review_note}</p>}
        <div className="flex flex-wrap gap-3">
          {editable&&<AsyncButton onClick={()=>action("save")}>Save draft</AsyncButton>}
          {entry?.status==="draft"&&entry.prepared_by===user?.id&&<AsyncButton variant="outline" disabled={unsaved} onClick={()=>action("submit")}>{unsaved?"Save changes before submission":"Submit saved draft for review"}</AsyncButton>}
          {entry?.status==="approved"&&<AsyncButton variant="outline" onClick={()=>action("revise")}>Create controlled correction</AsyncButton>}
        </div>
        {entry?.status==="submitted"&&entry.prepared_by!==user?.id&&<div className="space-y-3"><label className="block text-xs">Review explanation<textarea className={inputClass} placeholder="Explain verification of source records, valuation and depreciation basis" value={review} onChange={e=>setReview(e.target.value)}/></label><label className="flex gap-2 items-start text-xs text-[var(--text-muted)]"><input type="checkbox" checked={complete} onChange={e=>setComplete(e.target.checked)}/>I verified this is the complete company-wide position for this date, including stock/WIP, equity, liabilities and net assets, using the referenced source records.</label><div className="flex flex-wrap gap-3"><AsyncButton disabled={!complete||review.trim().length<10} onClick={()=>action("approve")}>Approve verified position</AsyncButton><AsyncButton variant="outline" disabled={review.trim().length<10} onClick={()=>action("reject")}>Return for correction</AsyncButton></div></div>}
      </div>
    </Modal>
  </div>;
}
