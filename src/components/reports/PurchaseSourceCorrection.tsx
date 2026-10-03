"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { useReportQuery } from "@/hooks/useReportQuery";
import { invalidateReports } from "@/lib/report-cache";
import RecordedTaxFields, { emptyRecordedTax, taxInputPayload } from "@/components/forms/RecordedTaxFields";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
import { fmtINR } from "@/lib/report-export";

export default function PurchaseSourceCorrection({ id, onClose }: { id: string | null; onClose: () => void }) {
  const company=useAppStore(s=>s.selectedBusinessId||s.user?.businessId);
  const queryClient=useQueryClient();
  const [billType,setBillType]=useState(""),[due,setDue]=useState(""),[tax,setTax]=useState(emptyRecordedTax);
  const {data,isLoading,error,refetch}=useReportQuery({queryKey:["purchase-source",id],enabled:!!id,queryFn:async()=>{const response=await fetch(`/api/purchases/bills/${id}`);if(!response.ok)throw new Error("Unable to load source invoice");return response.json();}});
  useEffect(()=>{if(data?.bill){setBillType(data.bill.bill_type||"");setDue(data.bill.due_date||"");setTax(Object.fromEntries(Object.keys(emptyRecordedTax).map(key=>[key,data.bill[key]==null?"":String(data.bill[key])])) as typeof emptyRecordedTax);}},[data]);
  useEffect(()=>{onClose();},[company]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async()=>{try{
    const response=await fetch(`/api/purchases/bills/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","x-report-business-id":company||""},body:JSON.stringify({bill_type:billType||null,due_date:due||null,...taxInputPayload(tax)})});
    if(!response.ok)throw new Error("Unable to save source fields. Check values and financial access.");
    await invalidateReports(queryClient);onClose();toast.success("Recorded invoice source fields updated");
  }catch(error){toast.error(error instanceof Error?error.message:"Unable to update source fields");}};
  return <Modal open={!!id} onOpenChange={open=>{if(!open)onClose();}} title="Complete recorded purchase source" maxWidth="max-w-lg">
    <PageState isLoading={isLoading} isError={!!error} error={error?.message} onRetry={refetch} isEmpty={false} skeletonVariant="form">
      {data?.bill&&<div className="space-y-4"><p className="text-sm text-[var(--text-muted)]">{data.bill.bill_number} / {fmtINR(data.bill.grand_total)}. Copy classification, due date and tax values from the verified original invoice. Leave unknown amounts blank.</p>
        <label className="block text-xs text-[var(--text-muted)]">Bill type<select value={billType} onChange={e=>setBillType(e.target.value)} className="w-full min-h-11 px-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"><option value="">Unclassified</option><option value="pakka">Pakka</option><option value="kacha">Kacha</option></select></label>
        <label className="block text-xs text-[var(--text-muted)]">Recorded due date<input type="date" value={due} onChange={e=>setDue(e.target.value)} className="w-full min-h-11 px-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"/></label>
        <RecordedTaxFields value={tax} onChange={setTax}/><AsyncButton onClick={save}>Save recorded source fields</AsyncButton>
      </div>}
    </PageState>
  </Modal>;
}
