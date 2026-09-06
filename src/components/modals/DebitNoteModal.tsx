"use client";

import React from "react";
import { X, Printer, FileText } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";

// ── Helpers ───────────────────────────────────────────────────────────
function fmt(v: number, decimals = 2) {
  return (v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return d;
  }
}

const GSTIN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "32": "Kerala", "33": "Tamil Nadu", "36": "Telangana",
  "37": "Andhra Pradesh",
};

function stateFromGstin(gstin?: string | null) {
  if (!gstin || gstin.length < 2) return { name: "", code: "" };
  const code = gstin.substring(0, 2);
  return { name: GSTIN_STATES[code] || "", code };
}

// Reason checkboxes
const DEBIT_REASONS = [
  "Rate Difference",
  "Goods Returned",
  "Short Supply",
  "Quality Issue",
  "Damaged Goods",
  "GST Difference",
  "Discount Adjustment",
  "Quantity Difference",
  "Freight Adjustment",
  "Others",
] as const;

function matchReason(returnReason: string | null | undefined): string[] {
  if (!returnReason) return [];
  const r = returnReason.toLowerCase();
  const matches: string[] = [];
  if (r.includes("rate") || r.includes("price")) matches.push("Rate Difference");
  if (r.includes("return") || r.includes("goods")) matches.push("Goods Returned");
  if (r.includes("short") || r.includes("shortage")) matches.push("Short Supply");
  if (r.includes("quality") || r.includes("defect")) matches.push("Quality Issue");
  if (r.includes("damage")) matches.push("Damaged Goods");
  if (r.includes("gst") || r.includes("tax")) matches.push("GST Difference");
  if (r.includes("discount")) matches.push("Discount Adjustment");
  if (r.includes("quantity") || r.includes("qty")) matches.push("Quantity Difference");
  if (r.includes("freight") || r.includes("transport")) matches.push("Freight Adjustment");
  if (matches.length === 0) matches.push("Others");
  return matches;
}

function DispatchRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <td className="py-[1px] pl-2 pr-1 text-[9px] font-semibold text-gray-700 align-top whitespace-nowrap">{label}</td>
      <td className="py-[1px] pr-1 text-[9px] text-gray-700 align-top">:</td>
      <td className="py-[1px] pr-2 text-[9px] text-gray-900 font-bold align-top">{value || "-"}</td>
    </tr>
  );
}

// ── Types ─────────────────────────────────────────────────────────────
export interface DebitNoteCompany {
  name?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  state?: string;
  state_code?: string;
}

export interface DebitNoteBillConfig {
  terms_conditions?: string | null;
  declaration?: string | null;
  declaration_text?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account?: {
    bank_name?: string;
    account_number?: string;
    ifsc?: string;
    ifsc_code?: string;
    branch?: string;
    type?: string;
  } | null;
  footer_text?: string | null;
}

export interface DebitNoteReferenceDoc {
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  payment_made: number;
  note_amount: number;
}

interface DebitNoteModalProps {
  open: boolean;
  onClose: () => void;
  pReturn: {
    return_number: string;
    return_date: string;
    reason?: string | null;
    challan_no?: string | null;
    grand_total: number;
    total_taxable_value: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    round_off?: number;
    supplier?: {
      name: string;
      company_name?: string | null;
      gstin?: string | null;
      phone?: string | null;
      billing_address_line1?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_pincode?: string | null;
    };
    purchase?: {
      purchase_number: string;
      invoice_no: string;
      invoice_date?: string;
      grand_total?: number;
    };
    items: Array<{
      id: string;
      material_type?: { name: string; category?: string };
      design?: { name: string; design_number?: string };
      colour?: { colour_name: string };
      hsn_sac?: string | null;
      unit: string;
      returned_qty: number;
      rate: number;
      discount_percent: number;
      taxable_value: number;
      size?: string | null;
      size_quantities?: Record<string, number> | null;
      rolls?: Array<{ roll_number: string; meters: number; shade?: string }>;
      width?: string | number | null;
      gsm?: string | number | null;
      shade?: string | null;
      roll_no?: string | null;
      description?: string | null;
    }>;
  };
  company?: DebitNoteCompany;
  config?: DebitNoteBillConfig | null;
  logoUrl?: string | null;
  referenceDoc?: DebitNoteReferenceDoc | null;
}

export function DebitNoteModal({
  open,
  onClose,
  pReturn,
  company,
  config,
  logoUrl,
  referenceDoc,
}: DebitNoteModalProps) {
  if (!open) return null;

  const handlePrint = () => window.print();

  const debitNoteNumber = `DB-${new Date(pReturn.return_date || Date.now()).getFullYear()}-${pReturn.return_number.slice(-4)}`;
  const companyState = stateFromGstin(company?.gstin);
  const supplierState = stateFromGstin(pReturn.supplier?.gstin);
  const checkedReasons = matchReason(pReturn.reason);

  // Bank details
  const bankName = config?.bank_name || config?.bank_account?.bank_name || "";
  const bankAccountNo = config?.bank_account_no || config?.bank_account?.account_number || "";
  const bankIfsc = config?.bank_ifsc || config?.bank_account?.ifsc || config?.bank_account?.ifsc_code || "";
  const bankBranch = config?.bank_branch || config?.bank_account?.branch || "";
  const bankAccountType = config?.bank_account_type || config?.bank_account?.type || "Current Account";

  // Terms & Declaration
  const rawTerms = config?.terms_conditions || config?.footer_text || "Subject to our terms.";
  const termsLines = rawTerms.split("\n").map((t) => t.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean);
  const declarationText = config?.declaration || config?.declaration_text ||
    "We declare that this Debit Note is issued in accordance with the provisions of the GST Act and all particulars are true and correct.";

  const totalReturnedQty = pReturn.items.reduce((s, it) => s + it.returned_qty, 0);

  // Reference doc calculation
  const refDoc = referenceDoc || (pReturn.purchase ? {
    invoice_number: pReturn.purchase.invoice_no || pReturn.purchase.purchase_number,
    invoice_date: pReturn.purchase.invoice_date || "",
    invoice_amount: pReturn.purchase.grand_total || 0,
    payment_made: 0,
    note_amount: pReturn.grand_total,
  } : null);

  const balancePayable = refDoc
    ? refDoc.invoice_amount - refDoc.payment_made - refDoc.note_amount
    : 0;

  const taxableVal = pReturn.total_taxable_value || 0;
  const grandTot = pReturn.grand_total || 0;
  const rawTaxDiff = Math.max(0, grandTot - taxableVal);

  const isInterstate = companyState.code && supplierState.code && companyState.code !== supplierState.code;

  let cgstVal = pReturn.cgst ?? 0;
  let sgstVal = pReturn.sgst ?? 0;
  let igstVal = pReturn.igst ?? 0;

  if (cgstVal === 0 && sgstVal === 0 && igstVal === 0 && rawTaxDiff > 0) {
    if (isInterstate) {
      igstVal = rawTaxDiff;
    } else {
      cgstVal = rawTaxDiff / 2;
      sgstVal = rawTaxDiff / 2;
    }
  }

  const taxRatePercent = taxableVal > 0 ? Math.round((rawTaxDiff / taxableVal) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print-modal-overlay">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-[var(--modal-shadow)] border border-[var(--border)] w-full max-w-4xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 print-modal-content">

        {/* Header Bar (non-print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--table-header-bg)] print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">Debit Note</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] rounded-lg transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══ PRINTABLE VOUCHER ═══ */}
        <div id="debit-note-voucher" className="bg-white text-black font-sans w-full" style={{ fontSize: "10px", lineHeight: 1.3 }}>
          <table className="w-full border-collapse border-2 border-black">
            <tbody>
              {/* ═══ HEADER ═══ */}
              <tr className="border-b-2 border-black">
                <td className="border-r-2 border-black p-2.5 align-top w-[67%]">
                  <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 items-start">
                    <div className="flex items-start gap-2.5">
                      {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain flex-shrink-0" />}
                      <div>
                        <div className="text-[17px] font-black leading-tight tracking-tight uppercase">
                          {company?.name || "COMPANY NAME"}
                        </div>
                        <div className="text-[9px] text-gray-800 mt-0.5 whitespace-pre-line leading-snug font-medium">
                          {company?.address || ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-center pt-1">
                      <div className="text-[18px] font-black tracking-wide uppercase">DEBIT NOTE</div>
                      <div className="text-[7px] font-semibold text-gray-600">(Under Section 34 of GST Act)</div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-0.5 text-[9px] font-medium">
                    {company?.phone && <div>☎ {company.phone}</div>}
                    {company?.email && <div>✉ {company.email}</div>}
                    {company?.gstin && <div className="font-bold font-mono mt-1">GSTIN/UIN : {company.gstin}</div>}
                    {(company?.state || companyState.name) && (
                      <div>State Name : {company?.state || companyState.name}{company?.state_code || companyState.code ? `, Code : ${company?.state_code || companyState.code}` : ""}</div>
                    )}
                  </div>
                </td>

                {/* Right: Debit Note Details Box */}
                <td className="p-0 w-[33%]" style={{ height: "1px" }}>
                  <div style={{ height: "100%", padding: "6px", display: "flex", flexDirection: "column" }}>
                    <table className="w-full text-[9px] border-collapse">
                      <tbody>
                        <DispatchRow label="Debit Note No." value={debitNoteNumber} />
                        <DispatchRow label="Date" value={fmtDate(pReturn.return_date)} />
                        {pReturn.purchase && <DispatchRow label="Ref. Invoice No." value={pReturn.purchase.invoice_no || pReturn.purchase.purchase_number} />}
                        {pReturn.purchase?.invoice_date && <DispatchRow label="Ref. Invoice Date" value={fmtDate(pReturn.purchase.invoice_date)} />}
                        {pReturn.challan_no && <DispatchRow label="Challan No." value={pReturn.challan_no} />}
                        <tr><td colSpan={3} className="py-1"><div className="border-b border-gray-400 w-full" /></td></tr>
                        <DispatchRow label="Return Voucher" value={pReturn.return_number} />
                        <DispatchRow label="Reason" value={pReturn.reason || "Material Return"} />
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>

              {/* ═══ SUPPLIER DETAILS + REASON CHECKBOXES ═══ */}
              <tr className="border-b-2 border-black">
                <td className="border-r-2 border-black p-2.5 align-top">
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1 bg-gray-100 px-1 py-0.5 inline-block border border-gray-300">
                    SUPPLIER / PARTY DETAILS
                  </div>
                  <div className="text-[11px] font-black uppercase leading-tight">
                    {(pReturn.supplier as any)?.company_name || pReturn.supplier?.name || "—"}
                  </div>
                  {((pReturn.supplier as any)?.billing_address_line1 || (pReturn.supplier as any)?.address) && (
                    <div className="text-[9px] text-gray-800 mt-0.5">
                      {(pReturn.supplier as any).billing_address_line1 || (pReturn.supplier as any).address}
                      {(pReturn.supplier as any).billing_city || (pReturn.supplier as any).city ? `, ${(pReturn.supplier as any).billing_city || (pReturn.supplier as any).city}` : ""}
                      {(pReturn.supplier as any).billing_state || (pReturn.supplier as any).state ? `, ${(pReturn.supplier as any).billing_state || (pReturn.supplier as any).state}` : ""}
                      {(pReturn.supplier as any).billing_pincode || (pReturn.supplier as any).pincode ? ` - ${(pReturn.supplier as any).billing_pincode || (pReturn.supplier as any).pincode}` : ""}
                    </div>
                  )}
                  {pReturn.supplier?.gstin && (
                    <div className="text-[9px] font-mono font-bold mt-1">GSTIN : {pReturn.supplier.gstin}</div>
                  )}
                  {supplierState.name && (
                    <div className="text-[9px] mt-0.5">State Name : {supplierState.name}{supplierState.code ? `, Code : ${supplierState.code}` : ""}</div>
                  )}
                  {((pReturn.supplier as any)?.phone || (pReturn.supplier as any)?.email) && (
                    <div className="text-[9px] mt-0.5 space-y-0.5">
                      {(pReturn.supplier as any)?.phone && <div>Contact No. : {(pReturn.supplier as any).phone}</div>}
                      {(pReturn.supplier as any)?.email && <div>Email : {(pReturn.supplier as any).email}</div>}
                    </div>
                  )}
                </td>
                <td className="p-2.5 align-top">
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1.5">Reason for Debit Note</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {DEBIT_REASONS.map((reason) => (
                      <label key={reason} className="flex items-center gap-1 text-[8px]">
                        <input
                          type="checkbox"
                          checked={checkedReasons.includes(reason)}
                          readOnly
                          className="w-2.5 h-2.5 accent-black"
                        />
                        <span className={checkedReasons.includes(reason) ? "font-bold text-black" : "text-gray-600"}>
                          {reason}
                        </span>
                      </label>
                    ))}
                  </div>
                  {pReturn.reason && (
                    <div className="mt-1.5 text-[8px] text-gray-700 border-t border-gray-300 pt-1">
                      <span className="font-bold">Remarks :</span> {pReturn.reason}
                    </div>
                  )}
                </td>
              </tr>

              {/* ═══ ITEMS TABLE ═══ */}
              <tr>
                <td colSpan={2} className="p-0">
                  <table className="w-full border-collapse text-[9px]" style={{ tableLayout: "fixed" }}>
                    <thead>
                      <tr className="border-b-2 border-black bg-gray-100">
                        <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[5%]">Sr.<br/>No.</th>
                        <th className="border-r border-gray-400 py-1.5 px-2 text-left font-extrabold w-[28%]">Item Description</th>
                        <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[8%]">HSN/<br/>SAC</th>
                        <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[18%]">Details</th>
                        <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[10%]">Qty<br/>(Returned)</th>
                        <th className="border-r border-gray-400 py-1.5 px-1.5 text-right font-extrabold w-[9%]">Rate</th>
                        <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[8%]">Disc %</th>
                        <th className="py-1.5 px-1.5 text-right font-extrabold w-[14%]">Taxable<br/>Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pReturn.items.map((item, idx) => {
                        const name = item.material_type?.name || item.design?.name || "Material";
                        const code = item.design?.design_number || "";
                        const colour = item.colour?.colour_name || "";
                        const sizeEntries = item.size_quantities
                          ? Object.entries(item.size_quantities).filter(([, q]) => Number(q) > 0)
                          : [];

                        return (
                          <tr key={idx} className="border-b border-gray-300 align-top">
                            <td className="border-r border-gray-400 py-2 px-1 text-center font-bold">{idx + 1}</td>
                            <td className="border-r border-gray-400 py-2 px-2">
                              <div className="font-extrabold text-[10px] text-black uppercase">{name}</div>
                              {code && <div className="text-[8.5px] text-gray-700">Article No. : {code}</div>}
                              {item.material_type?.category && <div className="text-[8.5px] text-gray-700 uppercase">{item.material_type.category}</div>}
                              {colour && colour !== "Default" && <div className="text-[8.5px] text-gray-700">Color : {colour}</div>}
                            </td>
                            <td className="border-r border-gray-400 py-2 px-1 text-center font-mono text-[8px]">
                              {item.hsn_sac || (item as any).hsn_code || (item.design as any)?.hsn_code || (item.design as any)?.hsn_sac || (item.material_type as any)?.hsn_code || (item.material_type as any)?.hsn_sac || "—"}
                            </td>
                            <td className="border-r border-gray-400 p-1.5">
                              {(() => {
                                const sizeEntries = item.size_quantities
                                  ? Object.entries(item.size_quantities).filter(([, q]) => Number(q) > 0)
                                  : [];

                                const articleNo = code || item.design?.design_number || (item as any).design_code || (item as any).article_no || "";
                                const itemWidth = item.width || (item as any).fabric_width || (item as any).material_type?.width || "58\"";
                                const itemGsm = item.gsm || (item as any).material_type?.gsm || "Standard";
                                const itemShade = item.shade || (item as any).shade_no || item.colour?.colour_name || (item as any).colour_name || "Standard";
                                const itemRollNo = item.roll_no || (item as any).batch_no || (item as any).lot_no || (item as any).roll_number || (item.rolls && item.rolls[0]?.roll_number) || "RL-01";
                                const itemDesc = item.description || (item as any).remarks || (item as any).item_details;

                                if (sizeEntries.length > 0) {
                                  return (
                                    <table className="w-full border-collapse border border-black text-[8px] text-center">
                                      <thead>
                                        <tr className="bg-gray-100 border-b border-black font-extrabold">
                                          <th colSpan={sizeEntries.length + 1} className="py-0.5">Size Breakup</th>
                                        </tr>
                                        <tr className="bg-gray-50 border-b border-black font-bold">
                                          <th className="border-r border-black py-0.5 px-1">Size</th>
                                          {sizeEntries.map(([sz]) => (
                                            <th key={sz} className="border-r border-black last:border-r-0 py-0.5 px-1">{sz}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td className="border-r border-black py-0.5 px-1 font-bold bg-gray-50">Qty</td>
                                          {sizeEntries.map(([sz, q]) => (
                                            <td key={sz} className="border-r border-black last:border-r-0 py-0.5 px-1 font-semibold">{String(q)}</td>
                                          ))}
                                        </tr>
                                      </tbody>
                                    </table>
                                  );
                                }

                                if (item.rolls && item.rolls.length > 0) {
                                  return (
                                    <div className="space-y-1">
                                      <table className="w-full border-collapse border border-black text-[8px]">
                                        <thead>
                                          <tr className="bg-gray-100 border-b border-black font-extrabold text-center">
                                            <th colSpan={2} className="py-0.5">Roll Details</th>
                                          </tr>
                                          <tr className="bg-gray-50 border-b border-black font-bold">
                                            <th className="border-r border-black py-0.5 px-1 text-left">Roll No.</th>
                                            <th className="py-0.5 px-1 text-right">Qty ({item.unit})</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {item.rolls.map((r, ri) => (
                                            <tr key={ri} className="border-b border-gray-300 last:border-b-0">
                                              <td className="border-r border-black py-0.5 px-1 font-mono">{r.roll_number}</td>
                                              <td className="py-0.5 px-1 text-right">{fmt(r.meters)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div className="text-[7.5px] text-gray-700 space-y-0.2">
                                        <div><span className="font-bold">Width:</span> {itemWidth} | <span className="font-bold">GSM:</span> {itemGsm}</div>
                                        <div><span className="font-bold">Colour/Shade:</span> {itemShade}</div>
                                      </div>
                                    </div>
                                  );
                                }

                                const sq = item.size_quantities;
                                const hasSq = sq && typeof sq === "object" && Object.keys(sq).length > 0;
                                const sqEntries = hasSq ? Object.entries(sq).filter(([_, q]) => Number(q) > 0) : [];

                                if (sqEntries.length > 0) {
                                  return (
                                    <div className="space-y-1">
                                      <table className="border border-gray-400 text-[8px] w-full text-center border-collapse">
                                        <thead>
                                          <tr className="bg-gray-100 border-b border-gray-400 font-bold">
                                            <td colSpan={sqEntries.length + 1} className="py-0.5 px-1 text-center">
                                              Size Breakup (PCS)
                                            </td>
                                          </tr>
                                          <tr className="border-b border-gray-400 font-bold bg-gray-50">
                                            <td className="border-r border-gray-400 px-1 py-0.5">Size</td>
                                            {sqEntries.map(([s]) => (
                                              <td key={s} className="border-r border-gray-400 last:border-r-0 px-1 py-0.5">{s}</td>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr>
                                            <td className="border-r border-gray-400 px-1 py-0.5 font-bold">Qty</td>
                                            {sqEntries.map(([s, q]) => (
                                              <td key={s} className="border-r border-gray-400 last:border-r-0 px-1 py-0.5 font-semibold">{q}</td>
                                            ))}
                                          </tr>
                                        </tbody>
                                      </table>
                                      <div className="text-[7.5px] text-gray-700 space-y-0.2">
                                        {articleNo && articleNo !== "—" && <div><span className="font-bold">Article No:</span> {articleNo}</div>}
                                        {itemShade && itemShade !== "Standard" && <div><span className="font-bold">Color / Shade:</span> {itemShade}</div>}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-0.5 text-[8px] text-gray-800">
                                    {articleNo && articleNo !== "—" && <div><span className="font-bold">Article No:</span> {articleNo}</div>}
                                    {itemRollNo && itemRollNo !== "Standard" && <div><span className="font-bold">Roll / Lot #:</span> {itemRollNo}</div>}
                                    <div><span className="font-bold">Color / Shade:</span> {itemShade}</div>
                                    {item.size && <div><span className="font-bold">Size:</span> {item.size}</div>}
                                    {itemWidth && itemWidth !== "—" && <div><span className="font-bold">Width:</span> {itemWidth}</div>}
                                    {itemGsm && itemGsm !== "—" && <div><span className="font-bold">GSM:</span> {itemGsm}</div>}
                                    {itemDesc && <div className="italic text-gray-600 border-t border-gray-200 pt-0.5 mt-0.5">{itemDesc}</div>}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="border-r border-gray-400 py-2 px-1 text-center font-bold">{item.returned_qty} {item.unit}</td>
                            <td className="border-r border-gray-400 py-2 px-1.5 text-right font-mono font-bold">{fmt(item.rate)}</td>
                            <td className="border-r border-gray-400 py-2 px-1 text-center font-mono">{item.discount_percent}%</td>
                            <td className="py-2 px-1.5 text-right font-mono font-extrabold">{fmt(item.taxable_value)}</td>
                          </tr>
                        );
                      })}
                      {/* Spacer row */}
                      <tr className="border-b border-gray-200">
                        <td className="border-r border-gray-400 py-3 px-1" />
                        <td className="border-r border-gray-400 py-3 px-2" />
                        <td className="border-r border-gray-400 py-3 px-1" />
                        <td className="border-r border-gray-400 py-3 px-1.5" />
                        <td className="border-r border-gray-400 py-3 px-1" />
                        <td className="border-r border-gray-400 py-3 px-1.5" />
                        <td className="border-r border-gray-400 py-3 px-1" />
                        <td className="py-3 px-1.5" />
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black font-extrabold">
                        <td className="border-r border-gray-400 py-1.5 px-1" />
                        <td className="border-r border-gray-400 py-1.5 px-2 text-[9.5px]">Total Returned Quantity</td>
                        <td className="border-r border-gray-400 py-1.5 px-1" />
                        <td className="border-r border-gray-400 py-1.5 px-1" />
                        <td className="border-r border-gray-400 py-1.5 px-1 text-center font-bold">{fmt(totalReturnedQty, 0)}</td>
                        <td colSpan={2} className="border-r border-gray-400 py-1.5 px-1 text-right text-[9px] font-bold">Grand Total</td>
                        <td className="py-1.5 px-1.5 text-right font-black text-[9.5px]">{fmt(pReturn.grand_total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </td>
              </tr>

              {/* ═══ AMOUNT IN WORDS + BANK DETAILS ═══ */}
              <tr className="border-t-2 border-black">
                <td className="border-r-2 border-black p-2.5 align-top">
                  <div className="text-[9px] font-bold text-gray-700 mb-0.5">Amount in Words :</div>
                  <div className="text-[9.5px] font-black text-black">INR {numberToWords(pReturn.grand_total)}</div>

                  {(bankName || bankAccountNo) && (
                    <div className="mt-3 border border-gray-400 p-2">
                      <div className="text-[9px] font-black uppercase mb-1">Company&apos;s Bank Details</div>
                      <table className="text-[8.5px] text-gray-800 w-full">
                        <tbody>
                          <tr><td className="pr-1.5 font-bold whitespace-nowrap w-[90px]">Bank Name</td><td>: {bankName || "-"}</td></tr>
                          <tr><td className="pr-1.5 font-bold whitespace-nowrap">A/c No.</td><td>: {bankAccountNo || "-"}</td></tr>
                          <tr><td className="pr-1.5 font-bold whitespace-nowrap">Branch & IFS Code</td><td>: {bankIfsc}{bankBranch ? ` / ${bankBranch}` : ""}</td></tr>
                          <tr><td className="pr-1.5 font-bold whitespace-nowrap">Account Type</td><td>: {bankAccountType}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </td>
                <td className="p-2.5 align-top">
                  <table className="w-full text-[9px]">
                    <tbody>
                      <tr>
                        <td className="py-0.5 font-semibold text-gray-800">Taxable Value</td>
                        <td className="py-0.5 text-right font-bold font-mono">{fmt(taxableVal)}</td>
                      </tr>
                      {igstVal > 0 ? (
                        <tr>
                          <td className="py-0.5 text-gray-800">
                            IGST {taxRatePercent > 0 ? `@ ${taxRatePercent}%` : ""}
                          </td>
                          <td className="py-0.5 text-right font-mono font-semibold">{fmt(igstVal)}</td>
                        </tr>
                      ) : (
                        <>
                          {cgstVal > 0 && (
                            <tr>
                              <td className="py-0.5 text-gray-800">
                                CGST {taxRatePercent > 0 ? `@ ${taxRatePercent / 2}%` : ""}
                              </td>
                              <td className="py-0.5 text-right font-mono font-semibold">{fmt(cgstVal)}</td>
                            </tr>
                          )}
                          {sgstVal > 0 && (
                            <tr>
                              <td className="py-0.5 text-gray-800">
                                SGST {taxRatePercent > 0 ? `@ ${taxRatePercent / 2}%` : ""}
                              </td>
                              <td className="py-0.5 text-right font-mono font-semibold">{fmt(sgstVal)}</td>
                            </tr>
                          )}
                        </>
                      )}
                      {pReturn.round_off ? (
                        <tr>
                          <td className="py-0.5 text-gray-800">Round Off</td>
                          <td className="py-0.5 text-right font-mono">{fmt(pReturn.round_off)}</td>
                        </tr>
                      ) : null}
                      <tr className="border-t border-black">
                        <td className="pt-1.5 font-black text-[12px] uppercase">Grand Total</td>
                        <td className="pt-1.5 font-black text-[12px] text-right font-mono">₹ {fmt(grandTot)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* ═══ REFERENCE DOCUMENT DETAILS ═══ */}
              {refDoc && refDoc.invoice_number && (
                <tr className="border-t-2 border-black">
                  <td colSpan={2} className="p-2.5">
                    <div className="text-[9px] font-black uppercase mb-1">Reference Document Details</div>
                    <table className="w-full border-collapse border border-black text-[8.5px]">
                      <thead>
                        <tr className="bg-gray-100 border-b border-black font-bold text-center">
                          <th className="border-r border-black py-1 px-1.5">Original Invoice No.</th>
                          <th className="border-r border-black py-1 px-1.5">Invoice Date</th>
                          <th className="border-r border-black py-1 px-1.5">Invoice Amount (₹)</th>
                          <th className="border-r border-black py-1 px-1.5">Payment Made (₹)</th>
                          <th className="border-r border-black py-1 px-1.5">Debit Note Amount (₹)</th>
                          <th className="py-1 px-1.5">Balance Payable (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center font-semibold">
                          <td className="border-r border-black py-1.5 px-1.5 font-bold font-mono">{refDoc.invoice_number}</td>
                          <td className="border-r border-black py-1.5 px-1.5">{fmtDate(refDoc.invoice_date)}</td>
                          <td className="border-r border-black py-1.5 px-1.5 font-mono">{fmt(refDoc.invoice_amount)}</td>
                          <td className="border-r border-black py-1.5 px-1.5 font-mono">{fmt(refDoc.payment_made)}</td>
                          <td className="border-r border-black py-1.5 px-1.5 font-mono font-bold">{fmt(refDoc.note_amount)}</td>
                          <td className="py-1.5 px-1.5 font-mono font-bold">{fmt(balancePayable)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}

              {/* ═══ FOOTER: TERMS / DECLARATION / SIGNATORY ═══ */}
              <tr className="border-t-2 border-black">
                <td colSpan={2} className="p-0">
                  <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td className="border-r border-gray-400 p-2.5 align-top" style={{ width: "38%" }}>
                          <div className="font-black text-[9px] uppercase mb-1">Terms & Conditions</div>
                          {termsLines.map((line, i) => (
                            <div key={i} className="text-[8.5px] text-gray-800 leading-tight mb-0.5">{i + 1}. {line}</div>
                          ))}
                        </td>
                        <td className="border-r border-gray-400 p-2.5 align-top text-[8.5px] text-gray-800" style={{ width: "34%" }}>
                          <div className="font-black text-[9px] uppercase mb-1">Declaration</div>
                          <div className="leading-tight">{declarationText}</div>
                        </td>
                        <td className="p-2.5 align-top text-[9px]" style={{ width: "28%" }}>
                          <div className="flex flex-col justify-between" style={{ minHeight: "85px" }}>
                            <div className="font-extrabold text-right uppercase leading-tight text-[9px]">
                              for {company?.name || "COMPANY"}
                            </div>
                            <div className="border-t border-black text-center pt-1 font-bold text-[9px] mt-2">
                              Authorised Signatory
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer watermark */}
          <div className="text-center text-[8px] font-semibold text-gray-500 mt-1">
            This is a Computer Generated Debit Note
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          header, nav, aside, .print\\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-modal-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            display: block !important;
          }
          #debit-note-voucher {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-height: 285mm !important;
            margin: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
        }
      `}</style>
    </div>
  );
}
