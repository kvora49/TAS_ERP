"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { PakkaBillTemplate } from "@/components/sales/PakkaBillTemplate";
import { KachaBillTemplate } from "@/components/sales/KachaBillTemplate";

// ────────────────────────────────────────────────────────────
// Print-page: renders the Pakka Bill GST Tax Invoice layout
// for pakka bills; falls back to legacy for kacha bills
// ────────────────────────────────────────────────────────────

export default function SaleBillPrintPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoDownload = searchParams.get("autoDownload") === "true";

  const [bill, setBill] = useState<any | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [brandConfig, setBrandConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { getEffectiveLogo, business } = useCompanyProfile();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/sales/bills/${encodeURIComponent(Array.isArray(id) ? id[0] : id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch bill details");
        return res.json();
      })
      .then((data) => {
        if (data.bill) setBill(data.bill);
        if (data.brand) setBrand(data.brand);
        if (data.brandConfig) setBrandConfig(data.brandConfig);
      })
      .catch((err) => {
        console.error("Error loading bill:", err);
        toast.error("Failed to load invoice print details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-print if ?autoDownload=true
  useEffect(() => {
    if (!loading && bill && autoDownload) {
      setTimeout(() => window.print(), 1000);
    }
  }, [loading, bill, autoDownload]);

  const handlePrint = () => window.print();

  const companyProfile = {
    name: brand?.name || business?.name || "",
    address: brand?.address || business?.address || "",
    gstin: brand?.gstin || business?.gstin || "",
    pan: brand?.pan || "",
    phone: brand?.phone || business?.phone || "",
    email: brand?.email || (business as any)?.email || "",
  };

  const logoUrl = getEffectiveLogo(brand?.logo_url);
  const exclusions = bill?.print_exclusions || {};
  const isPakka = bill?.bill_type === "pakka";

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--text-muted)]">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500 font-semibold">Failed to load invoice.</p>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* ── Screen-only toolbar (hidden when printing) ── */}
      <div className="print:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <span className="text-sm font-bold text-gray-900">{bill.bill_number}</span>
            <span className="ml-2 text-xs text-gray-500">{isPakka ? "Tax Invoice" : "Estimate"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-gray-700 border-gray-300 font-semibold"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* ── Invoice Canvas ── */}
      <div className="max-w-[210mm] mx-auto print:max-w-none print:mx-0">
        <div className="bg-white shadow-xl print:shadow-none m-4 print:m-0 p-0 print:p-0">
          {(() => {
            const rawItems = bill.items || (bill as any).sale_bill_items || (bill as any).items_data || [];
            const normalizedItems = rawItems.map((it: any, idx: number) => {
              const isFabric = it.item_type === "fabric" || !!it.material_type || !!it.material_type_id || !!it.raw_material_type_id || (it.unit && /met(er|re)|mtr/i.test(it.unit));
              const designName = it.design?.name || it.design_name || "";
              const matName = it.material_type?.name || it.material_name || "";
              const itemName = it.item_name || it.name || it.title || designName || matName || (it.description ? it.description.split("\n")[0] : `Item #${idx + 1}`);
              const articleNo = it.design?.design_number || it.design_code || it.article_no || it.design_number || "";
              const colourName = it.colour?.colour_name || it.colour_name || it.colour || it.color || "";
              const hsnCode = it.hsn_sac || it.design?.hsn_sac || it.material_type?.hsn_sac || (it.material_type as any)?.hsn_code || it.hsn || "—";
              const qty = Number(it.quantity || it.qty || 0);
              const rate = Number(it.rate || 0);
              const disc = Number(it.discount_percent || 0);
              const tax = Number(it.tax_percent || 0);
              const amt = Number(it.amount || (qty * rate * (1 - disc / 100)) || 0);

              return {
                ...it,
                id: it.id || `item-${idx}`,
                item_type: isFabric ? "fabric" : "finished_goods",
                item_name: itemName,
                design_code: articleNo,
                colour_name: colourName,
                hsn_sac: hsnCode,
                quantity: qty,
                rate: rate,
                discount_percent: disc,
                tax_percent: tax,
                amount: amt,
                unit: it.unit || (isFabric ? "MTR" : "PCS"),
                size_quantities: it.size_quantities || (it.size ? { [it.size]: qty } : null),
                rolls: it.rolls || [],
              };
            });

            const billData = {
              ...bill,
              item_total: Number(bill.item_total),
              charges_total: Number(bill.charges_total || 0),
              discount_amount: Number(bill.discount_amount || 0),
              taxable_amount: Number(bill.taxable_amount),
              cgst: Number(bill.cgst),
              sgst: Number(bill.sgst),
              igst: Number(bill.igst),
              round_off: Number(bill.round_off || 0),
              grand_total: Number(bill.grand_total),
              items: normalizedItems,
            };

            return isPakka ? (
              <PakkaBillTemplate
                bill={billData}
                company={companyProfile}
                config={brandConfig}
                exclusions={exclusions}
                logoUrl={logoUrl}
              />
            ) : (
              <KachaBillTemplate
                bill={billData}
                company={companyProfile}
                config={brandConfig}
                exclusions={exclusions}
                logoUrl={logoUrl}
              />
            );
          })()}
        </div>
      </div>

      <style global jsx>{`
        @media print {
          body { margin: 0; background: white; }
          .print\\:hidden { display: none !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Kacha / Estimate Fallback — simple clean layout
// (detailed redesign for kacha bills is a separate phase)
// ────────────────────────────────────────────────────────────

function KachaBillFallback({ bill, company, logoUrl }: { bill: any; company: any; logoUrl?: string | null }) {
  return (
    <div className="p-8 font-sans text-sm text-black">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-14 w-14 bg-gray-200 flex items-center justify-center text-lg font-extrabold text-gray-600 rounded">
              {(company.name || "").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-2xl font-extrabold">{company.name}</div>
            <div className="text-xs text-gray-600 mt-0.5">{company.address}</div>
            {company.phone && <div className="text-xs mt-0.5">Ph: {company.phone}</div>}
            {company.gstin && <div className="text-xs font-bold mt-0.5 font-mono">GSTIN: {company.gstin}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold tracking-widest text-gray-800">ESTIMATE</div>
          <div className="text-xs mt-1">No: <span className="font-bold font-mono">{bill.bill_number}</span></div>
          <div className="text-xs">Date: <span className="font-bold">{bill.bill_date}</span></div>
        </div>
      </div>

      {/* Party */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Billed To</div>
        <div className="font-bold text-base">{bill.party?.name}</div>
        {bill.billing_address && <div className="text-xs text-gray-700 mt-0.5 whitespace-pre-line">{bill.billing_address}</div>}
        {bill.gstin && <div className="text-xs font-mono mt-0.5">GSTIN: {bill.gstin}</div>}
      </div>

      {/* Items */}
      <table className="w-full border-collapse border border-gray-300 text-xs mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Sr</th>
            <th className="border border-gray-300 p-2 text-left">Item</th>
            <th className="border border-gray-300 p-2 text-center">HSN</th>
            <th className="border border-gray-300 p-2 text-right">Qty</th>
            <th className="border border-gray-300 p-2 text-right">Rate</th>
            <th className="border border-gray-300 p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items || []).map((it: any, i: number) => (
            <tr key={i}>
              <td className="border border-gray-300 p-2">{i + 1}</td>
              <td className="border border-gray-300 p-2 font-semibold">{it.item_name || it.design?.name || it.material_type?.name}</td>
              <td className="border border-gray-300 p-2 text-center font-mono">{it.hsn_sac || "—"}</td>
              <td className="border border-gray-300 p-2 text-right">{it.quantity} {it.unit}</td>
              <td className="border border-gray-300 p-2 text-right">{Number(it.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td className="border border-gray-300 p-2 text-right font-bold">{Number(it.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 text-xs space-y-1">
          <div className="flex justify-between"><span>Sub Total</span><span className="font-bold">₹{Number(bill.item_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
          {bill.cgst > 0 && <div className="flex justify-between"><span>CGST</span><span>₹{Number(bill.cgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
          {bill.sgst > 0 && <div className="flex justify-between"><span>SGST</span><span>₹{Number(bill.sgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
          {bill.igst > 0 && <div className="flex justify-between"><span>IGST</span><span>₹{Number(bill.igst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
          <div className="flex justify-between font-extrabold text-sm border-t border-gray-900 pt-1">
            <span>Grand Total</span><span>₹{Number(bill.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-300 text-center text-[9px] text-gray-400 italic">
        This is a Computer Generated Estimate
      </div>
    </div>
  );
}
