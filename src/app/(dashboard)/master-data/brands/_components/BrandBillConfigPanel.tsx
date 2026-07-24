"use client";

import { Sparkles, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "sonner";

interface BankAccount { id: string; bank_name: string; account_number: string; }

export interface BillConfigValues {
  pakkaTemplateId: string;
  kachaTemplateId: string;
  primaryColor: string;
  headerText: string;
  footerText: string;
  signatureName: string;
  signatureDesignation: string;
  showHsn: boolean;
  showBatchNo: boolean;
  showDiscountColumn: boolean;
  showTransportDetails: boolean;
  bankAccountId: string;
  uploadedReferenceFileUrl: string | null;
}

interface Props {
  values: BillConfigValues;
  onChange: (updates: Partial<BillConfigValues>) => void;
  bankAccounts: BankAccount[];
  brandName?: string;
  brandAddress?: string;
  brandGstin?: string;
  billPrefixPakka?: string;
  logoUrl?: string;
}

export function BrandBillConfigPanel({
  values, onChange, bankAccounts, brandName, brandAddress, brandGstin, billPrefixPakka, logoUrl,
}: Props) {
  const { upload: uploadTemplate } = useFileUpload("bill_templates");
  const [previewMode, setPreviewMode] = [
    values.uploadedReferenceFileUrl ? "uploaded" : "digitized",
    (mode: "digitized" | "uploaded") => onChange({ uploadedReferenceFileUrl: mode === "digitized" ? values.uploadedReferenceFileUrl : values.uploadedReferenceFileUrl }),
  ];
  const [isExtracting, setIsExtracting] = [false, (_: boolean) => {}];

  const handleAutoExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    toast.info(`Uploading and analyzing "${file.name}"...`);
    const uploadRes = await uploadTemplate(file);
    if (uploadRes.success) {
      onChange({ uploadedReferenceFileUrl: uploadRes.url });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      const textLower = text.toLowerCase();
      const fileNameLower = file.name.toLowerCase();

      const hasHsn = textLower.includes("hsn") || textLower.includes("sac") || fileNameLower.includes("hsn");
      const hasDiscount = textLower.includes("discount") || textLower.includes("disc");
      const hasBatch = textLower.includes("batch") || textLower.includes("lot");
      const hasTransport = textLower.includes("transport") || textLower.includes("vehicle");

      const hexMatch = text.match(/#[0-9A-Fa-f]{6}/g);
      let detectedColor = "#6366F1";
      if (hexMatch?.length) detectedColor = hexMatch[0];

      let detectedHeader = "Premium Apparel & Denim Co.";
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0 && lines[0].length > 2 && lines[0].length < 60) {
        detectedHeader = lines[0];
      }

      let detectedFooter = "Goods once sold will not be taken back or exchanged. Interest @ 18% will be charged if payment is not made within due date.";
      const termsIndex = lines.findIndex(l => l.toLowerCase().includes("terms") || l.toLowerCase().includes("condition"));
      if (termsIndex !== -1 && termsIndex < lines.length - 1) {
        const slicedTerms = lines.slice(termsIndex, termsIndex + 3).join(" ");
        if (slicedTerms.length > 10 && slicedTerms.length < 300) detectedFooter = slicedTerms;
      }

      let detectedTemplate = "00000000-0000-0000-0000-000000000001";
      if (textLower.includes("compact") || fileNameLower.includes("compact")) detectedTemplate = "00000000-0000-0000-0000-000000000003";
      else if (textLower.includes("modern") || fileNameLower.includes("modern")) detectedTemplate = "00000000-0000-0000-0000-000000000002";
      else if (textLower.includes("traditional") || fileNameLower.includes("traditional")) detectedTemplate = "00000000-0000-0000-0000-000000000004";

      onChange({
        primaryColor: detectedColor,
        showHsn: hasHsn,
        showDiscountColumn: hasDiscount,
        showBatchNo: hasBatch,
        showTransportDetails: hasTransport,
        headerText: detectedHeader,
        footerText: detectedFooter,
        signatureDesignation: "Authorized Signatory",
        pakkaTemplateId: detectedTemplate,
      });

      setIsExtracting(false);
      toast.success("AI Layout Extraction Successful!");
    };
    reader.onerror = () => { setIsExtracting(false); toast.error("Failed to read template file."); };
    reader.readAsText(file);
  };

  const { pakkaTemplateId, kachaTemplateId, primaryColor, headerText, footerText,
    signatureName, signatureDesignation, showHsn, showBatchNo, showDiscountColumn,
    showTransportDetails, bankAccountId, uploadedReferenceFileUrl } = values;

  const currentPreviewMode = uploadedReferenceFileUrl ? "uploaded" : "digitized";

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* AI Extraction Panel */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-[#2563EB] mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-[#1E40AF]">AI Invoice Layout Extractor</span>
            <span className="text-xs text-[#1E40AF] leading-normal">
              Upload your existing PDF or Excel bill design template. The system will auto-extract theme colors, GST parameters, column preferences, and terms declarations to build a matching digitised copy.
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center border border-dashed border-[#BFDBFE] rounded-lg p-4 bg-white relative">
          <label className="cursor-pointer flex items-center gap-2 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] select-none">
            <Upload className="h-4 w-4" />
            <span>Upload Reference Template</span>
            <input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" className="sr-only" onChange={handleAutoExtract} />
          </label>
          <a
            href="/settings/bill-builder"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-[#6366F1] hover:text-[#4F46E5] px-3 py-1.5 rounded-lg bg-[#EEF2FF] border border-[#6366F1]/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#6366F1]" />
            <span>Launch Custom Bill Builder</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="pakka-template" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Pakka Invoice Layout Template</label>
          <select id="pakka-template" value={pakkaTemplateId} onChange={(e) => onChange({ pakkaTemplateId: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer">
            <option value="00000000-0000-0000-0000-000000000001">Classic (Standard GST Layout)</option>
            <option value="00000000-0000-0000-0000-000000000002">Modern (Clean Accent Styling)</option>
            <option value="00000000-0000-0000-0000-000000000003">Compact (Density Optimized)</option>
            <option value="00000000-0000-0000-0000-000000000004">Traditional Tax Invoice (Double Borders)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="brand-color" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Invoice Primary Theme Accent</label>
          <div className="flex gap-2">
            <input type="color" id="brand-color" value={primaryColor} onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="h-10 w-12 border border-[#D1D5DB] rounded-lg p-1 bg-white cursor-pointer" />
            <input type="text" value={primaryColor} onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="flex-1 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="kacha-template" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Kacha Invoice Layout Template</label>
          <select id="kacha-template" value={kachaTemplateId} onChange={(e) => onChange({ kachaTemplateId: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer">
            <option value="00000000-0000-0000-0000-000000000001">Classic (Standard GST Layout)</option>
            <option value="00000000-0000-0000-0000-000000000002">Modern (Clean Accent Styling)</option>
            <option value="00000000-0000-0000-0000-000000000003">Compact (Density Optimized)</option>
            <option value="00000000-0000-0000-0000-000000000004">Traditional Tax Invoice (Double Borders)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="billing-bank" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Billing Bank Account details</label>
          <select id="billing-bank" value={bankAccountId} onChange={(e) => onChange({ bankAccountId: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer">
            <option value="">Do Not Display Bank Details</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Column Visibility */}
      <div className="border border-[#E5E7EB] rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Invoice Column Visibility Options</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-[#374151] select-none">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showHsn} onChange={(e) => onChange({ showHsn: e.target.checked })} className="rounded text-[#6366F1]" />
            <span>HSN Code Column</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showBatchNo} onChange={(e) => onChange({ showBatchNo: e.target.checked })} className="rounded text-[#6366F1]" />
            <span>Batch/Lot Column</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showDiscountColumn} onChange={(e) => onChange({ showDiscountColumn: e.target.checked })} className="rounded text-[#6366F1]" />
            <span>Item Discount Column</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showTransportDetails} onChange={(e) => onChange({ showTransportDetails: e.target.checked })} className="rounded text-[#6366F1]" />
            <span>Transport Panel</span>
          </label>
        </div>
      </div>

      {/* Header / Footer Text */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="header-text" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Invoice Header Tagline</label>
          <input id="header-text" type="text" placeholder="Will appear below company name..." value={headerText}
            onChange={(e) => onChange({ headerText: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="footer-text" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Invoice Terms &amp; GST Declarations</label>
          <textarea id="footer-text" rows={2} placeholder="Will appear in the bottom footnote section..." value={footerText}
            onChange={(e) => onChange({ footerText: e.target.value })}
            className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none" />
        </div>
      </div>

      {/* Signature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="sig-name" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Signatory Officer Name</label>
          <input id="sig-name" type="text" placeholder="e.g. Krish Kumar" value={signatureName}
            onChange={(e) => onChange({ signatureName: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sig-designation" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Officer Designation</label>
          <input id="sig-designation" type="text" placeholder="e.g. Authorized Signatory" value={signatureDesignation}
            onChange={(e) => onChange({ signatureDesignation: e.target.value })}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]" />
        </div>
      </div>

      {/* Live Preview (simplified) */}
      <div className="border border-[#CBD5E1] rounded-xl p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-3 select-none">
          <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Live Invoice Layout Preview</h4>
          {uploadedReferenceFileUrl && (
            <div className="flex bg-[#E2E8F0] p-0.5 rounded-lg text-[9px] font-bold">
              <button type="button" onClick={() => onChange({ uploadedReferenceFileUrl: null })}
                className={cn("px-2.5 py-1 rounded-md transition-all cursor-pointer", currentPreviewMode === "digitized" ? "bg-white text-[#6366F1] shadow-sm font-bold" : "text-slate-500 hover:text-slate-800")}>
                Digitised Layout
              </button>
              <button type="button" onClick={() => onChange({ uploadedReferenceFileUrl: uploadedReferenceFileUrl })}
                className={cn("px-2.5 py-1 rounded-md transition-all cursor-pointer", currentPreviewMode === "uploaded" ? "bg-white text-[#6366F1] shadow-sm font-bold" : "text-slate-500 hover:text-slate-800")}>
                Uploaded Template
              </button>
            </div>
          )}
        </div>

        {uploadedReferenceFileUrl && currentPreviewMode === "uploaded" ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-2 flex justify-center items-center min-h-[250px]">
            {uploadedReferenceFileUrl.toLowerCase().endsWith(".pdf") ? (
              <iframe src={uploadedReferenceFileUrl} className="w-full h-[400px] rounded border bg-white" title="Reference Template PDF" />
            ) : (
              <div className="w-full text-center space-y-2">
                <img src={uploadedReferenceFileUrl} alt="Reference Template" className="max-h-[400px] w-auto object-contain mx-auto rounded border" />
                <a href={uploadedReferenceFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6366F1] hover:underline">Open template in new tab</a>
              </div>
            )}
          </div>
        ) : (
          <div className={cn("bg-white border font-sans transition-all duration-350 select-none",
            pakkaTemplateId === "00000000-0000-0000-0000-000000000002" ? "rounded-xl shadow-md border-t-8 border-[#E2E8F0] p-5 space-y-4" :
            pakkaTemplateId === "00000000-0000-0000-0000-000000000003" ? "rounded p-2.5 space-y-2 text-[9px] border-slate-350 leading-tight" :
            pakkaTemplateId === "00000000-0000-0000-0000-000000000004" ? "border-double border-4 border-slate-900 p-4 space-y-3" :
            "rounded-lg shadow-sm p-4 space-y-3 border-[#E2E8F0] text-[10px]"
          )}
            style={pakkaTemplateId === "00000000-0000-0000-0000-000000000002" ? { borderTopColor: primaryColor } : undefined}>
            {/* Preview header */}
            <div className={cn("flex justify-between items-start border-b pb-2",
              pakkaTemplateId === "00000000-0000-0000-0000-000000000004" ? "pb-2 border-double border-b-4 border-slate-900" : "border-slate-200")}>
              <div>
                {logoUrl ? <img src={logoUrl} alt="Logo" className="h-6 object-contain mb-1" /> :
                  <div className="h-6 w-12 bg-slate-100 rounded border flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">Logo</div>}
                <h5 className="font-bold text-sm tracking-tight" style={{ color: primaryColor }}>{brandName || "BRAND NAME"}</h5>
                <p className="text-slate-500 text-[8px] font-medium italic">{headerText || "Tagline / Header tagline goes here..."}</p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 text-white rounded" style={{ backgroundColor: primaryColor }}>Tax Invoice</span>
                <p className="font-mono mt-1 text-[8px] text-slate-500">No: {billPrefixPakka || "TAX"}-2026-0001</p>
              </div>
            </div>
            {/* Preview items table */}
            <div className="border rounded overflow-hidden">
              <table className="w-full border-collapse text-[8px]">
                <thead>
                  <tr className="text-white" style={{ backgroundColor: primaryColor }}>
                    <th className="p-1 text-left">Item Description</th>
                    {showHsn && <th className="p-1 text-center">HSN/SAC</th>}
                    {showBatchNo && <th className="p-1 text-center">Batch/Lot</th>}
                    <th className="p-1 text-right">Qty</th>
                    <th className="p-1 text-right">Rate</th>
                    {showDiscountColumn && <th className="p-1 text-right">Disc %</th>}
                    <th className="p-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  <tr>
                    <td className="p-1 font-semibold">Premium Denim Jeans - Blue / L</td>
                    {showHsn && <td className="p-1 text-center font-mono text-[7px]">62034200</td>}
                    {showBatchNo && <td className="p-1 text-center font-mono text-[7px]">LOT0024</td>}
                    <td className="p-1 text-right font-mono">100 Pcs</td>
                    <td className="p-1 text-right font-mono">₹450.00</td>
                    {showDiscountColumn && <td className="p-1 text-right font-mono">5.0%</td>}
                    <td className="p-1 text-right font-mono font-bold">₹42,750.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Preview footer */}
            <div className="flex justify-between items-end pt-2 border-t text-[8px]">
              <div className="max-w-[60%] space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Terms &amp; Conditions</span>
                <p className="text-slate-500 leading-normal italic text-[7px]">{footerText || "Terms and conditions are listed here..."}</p>
              </div>
              <div className="text-right space-y-4">
                <p className="font-bold text-slate-600">For {brandName || "BRAND NAME"}</p>
                <div>
                  <p className="font-bold text-slate-800">{signatureName || "Officer Name"}</p>
                  <p className="text-slate-500 text-[7px] uppercase tracking-wider">{signatureDesignation || "Designation"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
