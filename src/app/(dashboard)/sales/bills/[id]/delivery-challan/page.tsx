"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Printer, Download, ArrowLeft } from "lucide-react";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { useDeliveryChallan } from "@/hooks/queries/useDeliveryChallan";
import { deliveryTotals, deliveryChallanInput, type DeliveryChallanInput } from "@/lib/delivery-challan";

const inputClass = "w-full min-w-0 rounded-lg px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent";

export default function DeliveryChallanPage() {
  const { id } = useParams<{ id: string }>();
  const query = useDeliveryChallan(id);
  const [form, setForm] = useState<DeliveryChallanInput | null>(null);
  const document = query.data?.document;
  const saved = !!query.data?.saved;
  useEffect(() => {
    if (!document) return;
    setForm({ sourceUpdatedAt: query.data?.sourceUpdatedAt ?? null, date: document.date, shippingName: document.shippingName, shippingAddress: document.shippingAddress, transporter: document.transporter, vehicle: document.vehicle, lrNumber: document.lrNumber, notes: document.notes, details: document.rows.map(row => ({ key: row.key, serial: row.serial, weight: row.weight, quality: row.quality, width: row.width })) });
  }, [document, query.data?.sourceUpdatedAt]);
  const save = async () => {
    const parsed = deliveryChallanInput.safeParse(form);
    if (!parsed.success) { toast.error("Enter a valid date, delivery recipient and shipping address. Check item details."); return; }
    try { await query.create.mutateAsync(parsed.data); toast.success("Delivery challan created. You can print or download it now."); }
    catch (error) { toast.error((error as Error).message); }
  };
  const exportPdf = async (print: boolean) => {
    if (!document || !saved) return;
    // Open synchronously for mobile browsers, before loading the optional PDF bundle.
    const printWindow = print ? window.open("", "_blank") : null;
    if (print && !printWindow) { toast.error("Allow pop-ups to open the printable PDF, or download it instead."); return; }
    try {
      const { buildDeliveryChallanPdf } = await import("@/lib/pdf/delivery-challan");
      const pdf = buildDeliveryChallanPdf(document, query.data?.cancelled);
      if (print && printWindow) {
        pdf.autoPrint(); const url = URL.createObjectURL(pdf.output("blob")); printWindow.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } else pdf.save(`${document.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`);
    } catch (error) { printWindow?.close(); toast.error("Unable to prepare the PDF. Please retry."); }
  };
  const set = (key: keyof Omit<DeliveryChallanInput, "details">, value: string) => setForm(current => current && ({ ...current, [key]: value }));
  return <div className="space-y-4 max-w-6xl mx-auto pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href={`/sales/bills/${id}`} className="text-sm text-[var(--primary)] inline-flex items-center gap-1"><ArrowLeft size={14} />Sales bill</Link><h1 className="text-xl font-bold text-[var(--text-primary)] mt-2">Delivery challan</h1></div>
      {saved && query.data?.canExport && <div className="flex flex-wrap gap-2"><AsyncButton variant="outline" onClick={() => exportPdf(true)}><Printer size={16} />Print</AsyncButton><AsyncButton onClick={() => exportPdf(false)}><Download size={16} />Download PDF</AsyncButton></div>}
    </div>
    <PageState isLoading={query.isLoading} isError={!!query.error} error={query.error?.message} onRetry={query.refetch} isEmpty={false} skeletonVariant="form">
      {document && form && <>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-[var(--text-primary)]">{document.number}</h2><p className="text-sm text-[var(--text-muted)]">Sales bill {document.billNumber} · {document.billDate}</p></div><strong className="text-[var(--primary)]">{saved ? "Saved delivery challan" : "Review before creating"}</strong></div>
          {query.data?.cancelled && <p className="text-red-500 font-semibold">The source invoice is cancelled. Printed copies will be marked accordingly.</p>}
          <div className="grid sm:grid-cols-2 gap-4 text-sm"><div><strong>{document.company.name}</strong><p>{document.company.address}</p><p>{document.company.gstin}</p></div><div><strong>{document.customer.company || document.customer.name}</strong><p>{document.customer.name}</p><p>Billing: {document.customer.address}</p></div></div>
          <p className="text-xs text-[var(--text-muted)]">One challan covers the full sales bill. Quantities come from the saved invoice. The delivery address is saved separately for this shipment.</p>
        </section>
        <fieldset disabled={saved || !query.data?.canCreate} className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4 disabled:opacity-100">
          <legend className="sr-only">Shipping and dispatch details</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([["date", "Challan date", "date"], ["shippingName", "Delivery recipient / company", "text"], ["transporter", "Transporter", "text"], ["vehicle", "Vehicle number", "text"], ["lrNumber", "LR / AWB number", "text"]] as const).map(([key, label, type]) => <label key={key} className="text-xs text-[var(--text-muted)] space-y-1 block">{label}<input type={type} value={form[key]} onChange={event => set(key, event.target.value)} className={inputClass} /></label>)}
          </div>
          <label className="text-xs text-[var(--text-muted)] space-y-1 block">Shipping address (confirm the actual delivery location)<textarea rows={3} maxLength={1500} value={form.shippingAddress} onChange={event => set("shippingAddress", event.target.value)} className={inputClass} /></label>
          {!saved && <button type="button" onClick={() => set("shippingAddress", document.customer.address)} className="text-sm text-[var(--primary)] underline">Use billing address for this delivery</button>}
          <label className="text-xs text-[var(--text-muted)] space-y-1 block">Delivery notes<textarea rows={2} maxLength={1500} value={form.notes} onChange={event => set("notes", event.target.value)} className={inputClass} /></label>
          <div><h2 className="font-semibold text-[var(--text-primary)]">Goods · {deliveryTotals(document.rows)}</h2><p className="text-xs text-[var(--text-muted)]">Recorded roll numbers and invoice quantities are retained. Add shipment weight, quality or garment serial details where available.</p></div>
          <div className="space-y-3">{document.rows.map((row, index) => <div key={row.key} className="rounded-lg border border-[var(--border)] p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{index + 1}. {row.name} {row.design && `(${row.design})`}</strong><span>{row.colour} {row.size && `· Size ${row.size}`} · {row.quantity} {row.unit}</span></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{(["serial", "weight", "width", "quality"] as const).map(key => <label key={key} className="text-xs text-[var(--text-muted)] space-y-1">{key === "serial" ? row.kind === "roll" ? "Roll number" : "Serial number(s)" : key === "weight" ? "Shipment weight (kg)" : key === "width" ? "Width (include unit)" : "Quality / grade"}<input type={key === "weight" ? "number" : "text"} min={key === "weight" ? 0 : undefined} step={key === "weight" ? "0.001" : undefined} disabled={key === "serial" && row.kind === "roll" && !!row.serial} value={form.details[index]?.[key] ?? ""} onChange={event => setForm(current => current && ({ ...current, details: current.details.map((detail, i) => i === index ? { ...detail, [key]: key === "weight" ? event.target.value === "" ? null : Number(event.target.value) : event.target.value } : detail) }))} className={inputClass} /></label>)}</div>
          </div>)}</div>
        </fieldset>
        {!saved && <div className="space-y-2"><p className="text-xs text-[var(--text-muted)]">Check shipping and item details before saving. The saved copy preserves these details for future reprints.</p><AsyncButton disabled={!query.data?.canCreate} onClick={save}>Create delivery challan</AsyncButton>{!query.data?.canCreate && <p className="text-sm text-[var(--text-muted)]">Your role has view access. Ask a user with Sales & Billing create permission to issue this challan.</p>}</div>}
      </>}
    </PageState>
  </div>;
}
