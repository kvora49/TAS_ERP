"use client";

import React from "react";
import { numberToWords } from "@/lib/utils/numberToWords";

// ── GSTIN State Code Lookup ───────────────────────────────────────────
const GSTIN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli & Daman & Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
  "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar",
  "36": "Telangana", "37": "Andhra Pradesh",
};

function stateFromGstin(gstin?: string | null): { name: string; code: string } {
  if (!gstin || gstin.length < 2) return { name: "", code: "" };
  const code = gstin.substring(0, 2);
  return { name: GSTIN_STATES[code] || "", code };
}

function deriveStateDetails(
  address?: string | null,
  gstin?: string | null,
  explicitState?: string | null,
  explicitCode?: string | null
): { name: string; code: string } {
  if (explicitState && explicitCode) return { name: explicitState, code: explicitCode };

  if (gstin && gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    if (GSTIN_STATES[code]) {
      return { name: explicitState || GSTIN_STATES[code], code: explicitCode || code };
    }
  }

  if (address) {
    const match = address.match(/State\s*(?:Name)?\s*:?\s*([^,\n]+),?\s*Code\s*:?\s*(\d+)/i);
    if (match) return { name: match[1].trim(), code: match[2].trim() };

    for (const [code, stateName] of Object.entries(GSTIN_STATES)) {
      if (address.toLowerCase().includes(stateName.toLowerCase())) {
        return { name: stateName, code };
      }
    }
  }

  return { name: explicitState || "", code: explicitCode || "" };
}

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface PakkaBillItem {
  id?: string;
  item_type?: string | null;
  item_name?: string | null;
  design?: { id?: string; design_number?: string; name?: string; hsn_sac?: string } | null;
  design_id?: string | null;
  design_code?: string;
  design_name?: string;
  colour?: { id?: string; colour_name?: string } | null;
  colour_id?: string | null;
  colour_name?: string;
  material_type?: { id?: string; name?: string; unit?: string; hsn_sac?: string; hsn_code?: string; category?: string } | null;
  size?: string | null;
  size_quantities?: Record<string, number> | null;
  quantity: number;
  rate: number;
  discount_percent?: number;
  tax_percent?: number;
  amount?: number;
  hsn_sac?: string | null;
  unit?: string | null;
  description?: string | null;
  rolls?: Array<{ roll_number: string; meters: number; shade?: string; width?: number; comment?: string }> | null;
}

export interface PakkaBillCharge {
  charge_name: string;
  charge_type: string;
  amount: number;
  is_taxable: boolean;
}

export interface PakkaBillData {
  bill_number: string;
  bill_date: string;
  due_date?: string | null;
  payment_terms?: string | null;
  billing_address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  gst_treatment?: string;
  // Dispatch
  buyer_order_no?: string | null;
  buyer_order_date?: string | null;
  dispatch_doc_no?: string | null;
  delivery_note?: string | null;
  delivery_note_date?: string | null;
  dispatched_through?: string | null;
  destination?: string | null;
  terms_of_delivery?: string | null;
  mode_of_payment?: string | null;
  // Consignee
  ship_to_same_as_bill_to?: boolean;
  consignee_name?: string | null;
  consignee_address?: string | null;
  consignee_gstin?: string | null;
  consignee_state?: string | null;
  consignee_state_code?: string | null;
  // Totals
  item_total: number;
  charges_total?: number;
  discount_amount?: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off?: number;
  grand_total: number;
  party?: { name?: string; company_name?: string | null; gstin?: string | null; phone?: string | null; billing_address_line1?: string | null; state?: string | null; billing_state?: string | null };
  items?: PakkaBillItem[];
  charges?: PakkaBillCharge[];
}

export interface CompanyProfile {
  name?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  state?: string;
  state_code?: string;
  logo_url?: string | null;
}

export interface BillConfig {
  terms_conditions?: string | null;
  declaration?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account?: { bank_name?: string; account_number?: string; account_no?: string; ifsc?: string; ifsc_code?: string; branch?: string; upi_id?: string; type?: string } | null;
  footer_text?: string | null;
  declaration_text?: string | null;
  signature_name?: string | null;
  signature_designation?: string | null;
}

export interface PrintExclusions {
  excludeBuyerOrderNo?: boolean;
  excludeBuyerOrderDate?: boolean;
  excludeDispatchDocNo?: boolean;
  excludeDeliveryNote?: boolean;
  excludeDispatchedThrough?: boolean;
  excludeDestination?: boolean;
  excludeTermsOfDelivery?: boolean;
  excludeModeOfPayment?: boolean;
  excludeHsnTable?: boolean;
  excludeTermsConditions?: boolean;
  excludeBankDetails?: boolean;
  excludeDeclaration?: boolean;
  excludeSignatory?: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

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

function fmtPaymentTerms(terms?: string | null): string {
  if (!terms || terms === "-") return "-";
  const s = terms.trim();
  if (s === "15_days" || s === "15days") return "15 Days";
  if (s === "30_days" || s === "30days") return "30 Days";
  if (s === "45_days" || s === "45days") return "45 Days";
  if (s === "60_days" || s === "60days") return "60 Days";
  if (s === "Immediate" || s === "immediate") return "Immediate";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse size breakup from item */
function parseSizeBreakup(item: PakkaBillItem): Array<{ size: string; qty: number }> {
  const result: Array<{ size: string; qty: number }> = [];

  const sq = item.size_quantities;
  if (sq && typeof sq === "object") {
    Object.entries(sq).forEach(([sz, q]) => {
      const num = Number(q || 0);
      if (num > 0) result.push({ size: sz, qty: num });
    });
    if (result.length > 0) return result;
  }

  const sizeStr = item.size || "";
  if (typeof sizeStr === "string" && sizeStr.includes(":")) {
    sizeStr.split(",").forEach((s) => {
      const [sz, q] = s.split(":");
      if (sz && q) {
        const num = parseInt(q.trim(), 10) || 0;
        if (num > 0) result.push({ size: sz.trim(), qty: num });
      }
    });
    if (result.length > 0) return result;
  }

  if (typeof sizeStr === "string" && sizeStr.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(sizeStr);
      Object.entries(parsed).forEach(([sz, q]) => {
        const num = Number(q || 0);
        if (num > 0) result.push({ size: sz, qty: num });
      });
      if (result.length > 0) return result;
    } catch {}
  }

  if (sizeStr && sizeStr !== "—" && sizeStr.trim().length > 0) {
    result.push({ size: sizeStr.trim(), qty: Number(item.quantity || 0) });
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────
// Grouping logic for items (Combines sizes into single article row)
// ────────────────────────────────────────────────────────────────────

interface GroupedBillItem {
  id: string;
  item_name: string;
  article_no: string;
  colour_name: string;
  hsn_sac: string;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
  total_qty: number;
  total_amount: number;
  is_finished: boolean;
  is_fabric: boolean;
  size_breakup: Array<{ size: string; qty: number }>;
  rolls: Array<{ roll_number: string; meters: number; shade?: string; width?: number; comment?: string }>;
  description: string;
}

function groupBillItems(items: PakkaBillItem[]): GroupedBillItem[] {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];
  const groups: Map<string, GroupedBillItem> = new Map();

  list.forEach((it, idx) => {
    const isFabric = it.item_type === "fabric" || !!it.material_type || !!(it as any).material_type_id || !!(it as any).raw_material_type_id || (it as any).unit?.toLowerCase().includes("meter");
    const isFinished = !isFabric;

    const articleNo = it.design?.design_number || it.design_code || (it as any).article_no || (it as any).design_number || "";
    const itemName = it.item_name || (it as any).name || (it as any).title || it.design?.name || it.design_name || it.material_type?.name || (it as any).description || "Item";
    const colourName = it.colour?.colour_name || it.colour_name || (it as any).colour || (it as any).color || "";
    const hsnCode = it.hsn_sac || (it as any).hsn_code || (it.design as any)?.hsn_code || (it.design as any)?.hsn_sac || (it.material_type as any)?.hsn_code || (it.material_type as any)?.hsn_sac || (it as any).hsn || "—";
    const rawUnit = it.unit || (isFabric ? "MTR" : "PCS");
    const unit = /met(er|re)/i.test(rawUnit) ? "MTR" : /piece|pcs/i.test(rawUnit) ? "PCS" : rawUnit.toUpperCase();

    const qty = Number(it.quantity || (it as any).qty || 0);
    const rate = Number(it.rate || 0);
    const disc = Number(it.discount_percent || 0);
    const netAmt = Number(it.amount || (qty * rate * (1 - disc / 100)) || 0);

    const groupKey = (isFinished && articleNo)
      ? `${articleNo}_${colourName}_${rate}`
      : `${it.id || idx}_${itemName}_${idx}`;

    if (isFinished && groups.has(groupKey)) {
      const existing = groups.get(groupKey)!;
      existing.total_qty += qty;
      existing.total_amount += netAmt;

      const sizes = parseSizeBreakup(it);
      sizes.forEach((s) => {
        const found = existing.size_breakup.find((x) => x.size === s.size);
        if (found) {
          found.qty += s.qty;
        } else {
          existing.size_breakup.push(s);
        }
      });
    } else {
      const sizeBreakup = isFinished ? parseSizeBreakup(it) : [];
      const rolls = it.rolls || [];
      groups.set(groupKey, {
        id: it.id || `g-${idx}`,
        item_name: itemName,
        article_no: articleNo,
        colour_name: colourName,
        hsn_sac: hsnCode,
        unit,
        rate,
        tax_percent: Number(it.tax_percent || 0),
        discount_percent: disc,
        total_qty: qty,
        total_amount: netAmt,
        is_finished: isFinished,
        is_fabric: isFabric,
        size_breakup: [...sizeBreakup],
        rolls: [...rolls],
        description: it.description || "",
      });
    }
  });

  return Array.from(groups.values());
}

/** Build HSN/SAC summary grouped by HSN code */
function buildHsnSummary(items: PakkaBillItem[], isInterstate: boolean) {
  const list = Array.isArray(items) ? items : [];
  const map: Record<string, { taxable: number; rate: number; cgst: number; sgst: number; igst: number }> = {};
  for (const it of list) {
    const hsn = it.hsn_sac || (it as any).hsn_code || (it.design as any)?.hsn_code || (it.design as any)?.hsn_sac || (it.material_type as any)?.hsn_code || (it.material_type as any)?.hsn_sac || "NA";
    const qty = Number(it.quantity || 0);
    const rateVal = Number(it.rate || 0);
    const disc = Number(it.discount_percent || 0);
    const net = Number(it.amount || (qty * rateVal * (1 - disc / 100)) || 0);
    const rate = Number(it.tax_percent || 0);
    const tax = net * (rate / 100);
    if (!map[hsn]) map[hsn] = { taxable: 0, rate, cgst: 0, sgst: 0, igst: 0 };
    map[hsn].taxable += net;
    if (isInterstate) {
      map[hsn].igst += tax;
    } else {
      map[hsn].cgst += tax / 2;
      map[hsn].sgst += tax / 2;
    }
  }
  return Object.entries(map).map(([hsn, v]) => ({ hsn, ...v }));
}

/** Aggregate total quantity by unit */
function aggregateQty(items: PakkaBillItem[]) {
  const list = Array.isArray(items) ? items : [];
  const totals: Record<string, number> = {};
  let rollCount = 0;
  let fabricMeters = 0;

  for (const it of list) {
    const isFabric = it.item_type === "fabric" || !!it.material_type;
    const qty = Number(it.quantity || 0);
    if (isFabric && it.rolls && it.rolls.length > 0) {
      rollCount += it.rolls.length;
      fabricMeters += it.rolls.reduce((s, r) => s + (Number(r.meters) || 0), 0);
    } else if (isFabric) {
      fabricMeters += qty;
    } else {
      const unit = (it.unit || "Pcs").toUpperCase();
      totals[unit] = (totals[unit] || 0) + qty;
    }
  }

  const parts: string[] = [];
  Object.entries(totals).forEach(([u, q]) => parts.push(`${fmt(q, 0)} ${u}`));
  if (fabricMeters > 0) parts.push(`${fmt(fabricMeters, 2)} MTR`);
  if (rollCount > 0) parts.push(`${rollCount} Rolls`);

  return parts;
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function DispatchRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <td className="py-[1.5px] pr-1 text-[9px] font-semibold text-gray-700 align-top whitespace-nowrap">{label}</td>
      <td className="py-[1.5px] pr-1 text-[9px] text-gray-700 align-top">:</td>
      <td className="py-[1.5px] text-[9px] text-gray-900 font-bold align-top">{value || "-"}</td>
    </tr>
  );
}

function ItemRowGroup({ group, idx }: { group: GroupedBillItem; idx: number }) {
  const descLines: string[] = [];
  if (group.article_no && group.article_no !== "—") {
    descLines.push(`Article No. : ${group.article_no}`);
  }
  if (group.colour_name && group.colour_name !== "Default" && group.colour_name !== "—") {
    descLines.push(`Color : ${group.colour_name}`);
  }
  if (group.description) {
    descLines.push(group.description);
  }
  if (group.is_fabric && group.rolls.some((roll) => roll.width)) {
    const widths = Array.from(new Set(group.rolls.map((roll) => roll.width).filter(Boolean)));
    descLines.push(`Width : ${widths.map((width) => `${width}\"`).join(", ")}`);
  }

  const hasRolls = group.is_fabric && group.rolls && group.rolls.length > 0;

  return (
    <tr className="border-b border-gray-300 align-top">
      {/* 1. Sr. No. */}
      <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-bold">{idx + 1}</td>

      {/* 2. Description of Goods */}
      <td className="border-r border-gray-400 px-2 py-1.5 text-[9px]">
        <span className="font-extrabold text-[10px] uppercase block tracking-tight">{group.item_name}</span>
        {descLines.map((l, i) => (
          <span key={i} className="block text-gray-700 text-[8.5px] leading-tight">{l}</span>
        ))}
      </td>

      {/* 3. HSN/SAC */}
      <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-mono font-semibold">{group.hsn_sac}</td>

      {/* 4. Details (Size Breakup / Roll Details / Spec) */}
      <td className="border-r border-gray-400 px-1.5 py-1.5 text-[9px]">
        {/* Size breakup matrix table for finished goods */}
        {group.is_finished && group.size_breakup.length > 0 ? (
          <div className="my-0.5">
            <table className="border border-gray-400 text-[8px] w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-400">
                  <td colSpan={group.size_breakup.length + 1} className="font-bold py-0.5 px-1 text-center">
                    Size Breakup (PCS)
                  </td>
                </tr>
                <tr className="border-b border-gray-400 font-bold bg-gray-50">
                  <td className="border-r border-gray-400 px-1 py-0.5">Size</td>
                  {group.size_breakup.map((s) => (
                    <td key={s.size} className="border-r border-gray-400 last:border-r-0 px-1.5 py-0.5">{s.size}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-r border-gray-400 px-1 py-0.5 font-bold">Qty (PCS)</td>
                  {group.size_breakup.map((s) => (
                    <td key={s.size} className="border-r border-gray-400 last:border-r-0 px-1.5 py-0.5 font-semibold">{s.qty}</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-400 bg-gray-50">
                  <td colSpan={group.size_breakup.length + 1} className="px-1 py-0.5 font-bold text-center">
                    Total PCS : {group.size_breakup.reduce((a, s) => a + s.qty, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : group.is_fabric && hasRolls ? (
          <div className="my-0.5">
            <table className="border border-gray-400 text-[8px] w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-400">
                  <td colSpan={4} className="font-bold py-0.5 px-1 text-center">Roll Details</td>
                </tr>
                <tr className="border-b border-gray-400 font-bold bg-gray-50">
                  <td className="border-r border-gray-400 px-1 py-0.5 text-left">Roll No.</td>
                  <td className="border-r border-gray-400 px-1 py-0.5 text-left">Colour</td>
                  <td className="border-r border-gray-400 px-1 py-0.5 text-right">Width</td>
                  <td className="px-1 py-0.5 text-right">Meters</td>
                </tr>
              </thead>
              <tbody>
                {group.rolls.map((r, ri) => (
                  <tr key={ri} className="border-b border-gray-300 last:border-b-0">
                    <td className="border-r border-gray-400 px-1 py-0.5 font-mono">{r.roll_number}</td>
                    <td className="border-r border-gray-400 px-1 py-0.5">{r.shade || "-"}</td>
                    <td className="border-r border-gray-400 px-1 py-0.5 text-right">{r.width ? `${r.width}\"` : "-"}</td>
                    <td className="px-1 py-0.5 text-right font-semibold">{fmt(r.meters)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-400 font-bold bg-gray-50">
                  <td colSpan={3} className="border-r border-gray-400 px-1 py-0.5">Total Meters</td>
                  <td className="px-1 py-0.5 text-right font-bold">
                    {fmt(group.rolls.reduce((s, r) => s + (Number(r.meters) || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="space-y-0.5 text-[8.5px] text-gray-800">
            {group.article_no && group.article_no !== "—" && <div><span className="font-bold">Article No:</span> {group.article_no}</div>}
            {group.colour_name && group.colour_name !== "Default" && group.colour_name !== "—" && <div><span className="font-bold">Color / Shade:</span> {group.colour_name}</div>}
            {group.description && <div className="italic text-gray-600">{group.description}</div>}
            {!group.article_no && !group.colour_name && !group.description && (
              <div><span className="font-bold">Specification:</span> Standard {group.unit}</div>
            )}
          </div>
        )}
      </td>

      {/* 5. Quantity */}
      <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-bold">
        {group.is_fabric && hasRolls ? (
          <div>
            <div>{group.rolls.length} Rolls</div>
            <div className="text-[8px] font-normal text-gray-600">({fmt(group.total_qty)} MTR)</div>
          </div>
        ) : (
          <div>
            <div>{fmt(group.total_qty, 0)}</div>
            <div className="text-[8px] font-normal text-gray-600">{group.unit}</div>
          </div>
        )}
      </td>

      {/* 6. Rate */}
      <td className="border-r border-gray-400 px-1.5 py-1.5 text-[9px] text-right font-semibold">{fmt(group.rate)}</td>

      {/* 7. per */}
      <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center text-gray-700">{group.unit}</td>

      {/* 8. GST % */}
      <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-semibold">{group.tax_percent || 0}%</td>

      {/* 9. Amount */}
      <td className="px-1.5 py-1.5 text-[9px] text-right font-extrabold">{fmt(group.total_amount)}</td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────

interface PakkaBillTemplateProps {
  bill: PakkaBillData;
  company: CompanyProfile;
  config?: BillConfig | null;
  exclusions?: PrintExclusions;
  logoUrl?: string | null;
}

export function PakkaBillTemplate({ bill, company, config, exclusions = {}, logoUrl }: PakkaBillTemplateProps) {
  const itemList = (bill.items && bill.items.length > 0)
    ? bill.items
    : (bill as any).sale_bill_items || (bill as any).items_data || [];

  const isInterstate = Number(bill.igst || 0) > 0;
  const hsnSummary = buildHsnSummary(itemList, isInterstate);
  const qtyParts = aggregateQty(itemList);
  const groupedItems = groupBillItems(itemList);

  // State derivation for company header
  const companyState = deriveStateDetails(company.address, company.gstin, company.state, company.state_code);

  // Bill To details
  const partyName = bill.party?.company_name || bill.party?.name || (bill as any).party_name || "—";
  const billingAddress = bill.billing_address || (bill.party as any)?.billing_address_line1 || (bill.party as any)?.address || "";
  const partyGstin = bill.gstin || bill.party?.gstin || "";
  const partyPhone = bill.phone || bill.party?.phone || "";
  const billToState = deriveStateDetails(
    billingAddress,
    partyGstin,
    (bill.party as any)?.state || (bill.party as any)?.billing_state,
    (bill.party as any)?.state_code || (bill.party as any)?.billing_state_code
  );

  // Ship To details
  const consigneeName = bill.ship_to_same_as_bill_to !== false
    ? partyName
    : (bill.consignee_name || partyName);
  const consigneeAddress = bill.ship_to_same_as_bill_to !== false
    ? billingAddress
    : (bill.consignee_address || billingAddress);
  const consigneeGstin = bill.ship_to_same_as_bill_to !== false
    ? partyGstin
    : (bill.consignee_gstin || partyGstin);
  const consigneeState = bill.ship_to_same_as_bill_to !== false
    ? billToState
    : deriveStateDetails(consigneeAddress, consigneeGstin, bill.consignee_state, bill.consignee_state_code);

  // Bank details resolution across all possible property aliases
  const rawBankName =
    (config?.bank_account as any)?.bank_name ||
    config?.bank_name ||
    (config?.bank_account as any)?.name ||
    (company as any)?.bank_name ||
    "";
  const bankName = /cash/i.test(rawBankName) ? "" : rawBankName;

  const bankAccountNo =
    (config?.bank_account as any)?.account_number ||
    (config?.bank_account as any)?.account_no ||
    config?.bank_account_no ||
    (config?.bank_account as any)?.upi_id ||
    (company as any)?.bank_account_no ||
    (company as any)?.account_no ||
    "";

  const bankIfsc =
    (config?.bank_account as any)?.ifsc ||
    (config?.bank_account as any)?.ifsc_code ||
    config?.bank_ifsc ||
    (company as any)?.bank_ifsc ||
    (company as any)?.ifsc ||
    "";

  const bankBranch =
    (config?.bank_account as any)?.branch ||
    config?.bank_branch ||
    (company as any)?.bank_branch ||
    "";

  const rawAccountType =
    config?.bank_account_type ||
    (config?.bank_account as any)?.type ||
    (config?.bank_account as any)?.account_type ||
    (company as any)?.bank_account_type ||
    "Current Account";
  const bankAccountType = /cash/i.test(rawAccountType) ? "Current Account" : rawAccountType;

  // Terms & Conditions lines (Clean leading digits like "1. ")
  const termsText = config?.terms_conditions || config?.footer_text || (company as any)?.terms_conditions || "Goods once sold will not be taken back.";
  const termsLines = termsText
    .split("\n")
    .map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);

  // Declaration
  const declaration = config?.declaration || config?.declaration_text || (company as any)?.declaration || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";

  const showBank = !exclusions.excludeBankDetails;
  const showTerms = !exclusions.excludeTermsConditions && termsLines.length > 0;
  const showDeclaration = !exclusions.excludeDeclaration;
  const showHsnTable = !exclusions.excludeHsnTable;
  const showSignatory = !exclusions.excludeSignatory;

  // Dispatch info rows
  const dispatchRows = [
    { key: "buyerOrderNo", label: "Buyer's Order No.", value: bill.buyer_order_no, exclude: exclusions.excludeBuyerOrderNo },
    { key: "buyerOrderDate", label: "Buyer Order Date", value: fmtDate(bill.buyer_order_date), exclude: exclusions.excludeBuyerOrderDate },
    { key: "dispatchDocNo", label: "Dispatch Doc No.", value: bill.dispatch_doc_no, exclude: exclusions.excludeDispatchDocNo },
    { key: "deliveryNoteDate", label: "Delivery Note Date", value: fmtDate(bill.delivery_note_date), exclude: exclusions.excludeDeliveryNote },
    { key: "dispatchedThrough", label: "Dispatched through", value: bill.dispatched_through, exclude: exclusions.excludeDispatchedThrough },
    { key: "destination", label: "Destination", value: bill.destination, exclude: exclusions.excludeDestination },
    { key: "termsOfDelivery", label: "Terms of Delivery", value: bill.terms_of_delivery, exclude: exclusions.excludeTermsOfDelivery },
  ].filter((r) => !r.exclude);

  return (
    <div
      id="pakka-bill-print-canvas"
      className="bg-white text-black font-sans w-full"
      style={{ width: "100%", fontSize: "10px", lineHeight: 1.3 }}
    >
      {/* ═══ HEADER ═══ */}
      <table className="w-full border-collapse border-2 border-black">
        <tbody>
          <tr className="border-b-2 border-black">
            {/* Company info + Header Title (Top-Left & Middle 67%) */}
            <td className="border-r-2 border-black p-2.5 align-top w-[67%]">
              <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 items-start">
                <div className="flex items-start gap-2.5">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain flex-shrink-0" />
                  ) : null}
                  <div>
                    <div className="text-[17px] font-black leading-tight tracking-tight uppercase">
                      {company.name || "COMPANY NAME"}
                    </div>
                    <div className="text-[9px] text-gray-800 mt-0.5 whitespace-pre-line leading-snug font-medium">
                      {company.address || ""}
                    </div>
                  </div>
                </div>

                {/* TAX INVOICE Header Title (Centered in Top Header) */}
                <div className="text-center text-[18px] font-black tracking-wide uppercase whitespace-nowrap pt-1">
                  TAX INVOICE
                </div>
              </div>

              <div className="mt-2 space-y-0.5 text-[9px] font-medium">
                {company.phone && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600 font-bold">☎</span>
                    <span>{company.phone}</span>
                  </div>
                )}
                {(company as any).email && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600 font-bold">✉</span>
                    <span>{(company as any).email}</span>
                  </div>
                )}
                {company.gstin && (
                  <div className="font-bold font-mono mt-1">GSTIN/UIN : {company.gstin}</div>
                )}
                {companyState.name && (
                  <div>State Name : {companyState.name}{companyState.code ? `, Code : ${companyState.code}` : ""}</div>
                )}
              </div>
            </td>

            {/* Right Side Dispatch & Invoice Info Box (33%) */}
            <td className="p-0 w-[33%]" style={{ height: "1px" }}>
              <div style={{ height: "100%", padding: "6px", display: "flex", flexDirection: "column" }}>
                <table className="w-full text-[9px] border-collapse">
                  <tbody>
                    <DispatchRow label="Invoice No." value={bill.bill_number} />
                    <DispatchRow label="Invoice Date" value={fmtDate(bill.bill_date)} />
                    <DispatchRow label="Delivery Note" value={bill.delivery_note} />
                    {!exclusions.excludeModeOfPayment && <DispatchRow label="Mode/Terms of Payment" value={fmtPaymentTerms(bill.mode_of_payment || bill.payment_terms)} />}

                    {/* Horizontal Divider Line matching reference image */}
                    <tr>
                      <td colSpan={3} className="py-1">
                        <div className="border-b border-gray-400 w-full" />
                      </td>
                    </tr>

                    {dispatchRows.map((r) => (
                      <DispatchRow key={r.key} label={r.label} value={r.value} />
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          {/* ═══ BILL TO / SHIP TO (50-50 SPLIT) ═══ */}
          <tr className="border-b-2 border-black">
            <td colSpan={2} className="p-0">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <tbody>
                  <tr>
                    {/* Bill To (50%) */}
                    <td className="w-1/2 border-r-2 border-black p-2.5 align-top">
                      <div className="text-[9px] font-black uppercase tracking-wider mb-1 bg-gray-100 px-1 py-0.5 inline-block border border-gray-300">
                        BILL TO
                      </div>
                      <div className="text-[11px] font-extrabold">{partyName}</div>
                      {billingAddress && <div className="text-[9px] text-gray-800 whitespace-pre-line mt-0.5 leading-snug">{billingAddress}</div>}
                      {partyGstin && <div className="text-[9px] font-bold mt-1 font-mono">GSTIN/UIN : {partyGstin}</div>}
                      {billToState.name && (
                        <div className="text-[9px] font-medium mt-0.5">
                          State Name : {billToState.name}{billToState.code ? `, Code : ${billToState.code}` : ""}
                        </div>
                      )}
                      {partyPhone && <div className="text-[9px] font-medium mt-0.5">Contact No. : {partyPhone}</div>}
                    </td>

                    {/* Ship To (50%) */}
                    <td className="w-1/2 p-2.5 align-top">
                      <div className="text-[9px] font-black uppercase tracking-wider mb-1 bg-gray-100 px-1 py-0.5 inline-block border border-gray-300">
                        SHIP TO
                      </div>
                      <div className="text-[11px] font-extrabold">{consigneeName}</div>
                      {consigneeAddress && <div className="text-[9px] text-gray-800 whitespace-pre-line mt-0.5 leading-snug">{consigneeAddress}</div>}
                      {consigneeGstin && <div className="text-[9px] font-bold mt-1 font-mono">GSTIN/UIN : {consigneeGstin}</div>}
                      {consigneeState.name && (
                        <div className="text-[9px] font-medium mt-0.5">
                          State Name : {consigneeState.name}{consigneeState.code ? `, Code : ${consigneeState.code}` : ""}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ═══ ITEMS TABLE ═══ */}
          <tr>
            <td colSpan={2} className="p-0">
              <table className="w-full border-collapse text-[9px]" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[4%]">Sr.<br/>No.</th>
                    <th className="border-r border-gray-400 py-1.5 px-2 text-left font-extrabold w-[25%]">Description of Goods</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[8%]">HSN/<br/>SAC</th>
                    <th className="border-r border-gray-400 py-1.5 px-1.5 text-center font-extrabold w-[27%]">Details</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[8%]">Quantity</th>
                    <th className="border-r border-gray-400 py-1.5 px-1.5 text-right font-extrabold w-[8%]">Rate</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[4%]">per</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[4%]">GST<br/>%</th>
                    <th className="py-1.5 px-1.5 text-right font-extrabold w-[12%]">Amount<br/>(₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.length > 0 ? (
                    groupedItems.map((group, idx) => (
                      <ItemRowGroup key={group.id || idx} group={group} idx={idx} />
                    ))
                  ) : itemList.length > 0 ? (
                    itemList.map((it: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-300 align-top">
                        <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-bold">{idx + 1}</td>
                        <td className="border-r border-gray-400 px-2 py-1.5 text-[9px]">
                          <span className="font-extrabold text-[10px] uppercase block tracking-tight">
                            {it.item_name || it.name || it.design?.name || it.material_type?.name || "Item"}
                          </span>
                        </td>
                        <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-mono font-semibold">
                          {it.hsn_sac || (it as any).hsn_code || (it.design as any)?.hsn_code || (it.design as any)?.hsn_sac || (it.material_type as any)?.hsn_code || (it.material_type as any)?.hsn_sac || "—"}
                        </td>
                        <td className="border-r border-gray-400 px-1.5 py-1.5 text-[9px] text-gray-600 italic">—</td>
                        <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-bold">
                          {fmt(Number(it.quantity || 0), 0)} {it.unit || "PCS"}
                        </td>
                        <td className="border-r border-gray-400 px-1.5 py-1.5 text-[9px] text-right font-semibold">{fmt(Number(it.rate || 0))}</td>
                        <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center text-gray-700">{it.unit || "PCS"}</td>
                        <td className="border-r border-gray-400 px-1 py-1.5 text-[9px] text-center font-semibold">{it.tax_percent || 0}%</td>
                        <td className="px-1.5 py-1.5 text-[9px] text-right font-extrabold">{fmt(Number(it.amount || 0))}</td>
                      </tr>
                    ))
                  ) : null}
                  {/* Minimal spacer row — prevents table from collapsing when few items */}
                  <tr className="border-b border-gray-200">
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="border-r border-gray-400 py-3 px-2" />
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="border-r border-gray-400 py-3 px-1.5" />
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="border-r border-gray-400 py-3 px-1.5" />
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="py-3 px-1.5" />
                  </tr>
                </tbody>

                {/* Total Quantity Footer Row */}
                <tfoot>
                  <tr className="border-t-2 border-black font-extrabold">
                    <td className="border-r border-gray-400 py-1.5 px-1" />
                    <td className="border-r border-gray-400 py-1.5 px-2 text-[9.5px]">Total Quantity</td>
                    <td className="border-r border-gray-400 py-1.5 px-1" />
                    <td className="border-r border-gray-400 py-1.5 px-1.5" />
                    <td className="border-r border-gray-400 py-1.5 px-1 text-[8.5px] font-bold text-center leading-tight">
                      {qtyParts.map((p, i) => <div key={i}>{p}</div>)}
                    </td>
                    <td colSpan={3} className="border-r border-gray-400 py-1.5 px-1 text-right text-[9px] font-bold">
                      Sub Total
                    </td>
                    <td className="py-1.5 px-1.5 text-[9.5px] text-right font-black">
                      {fmt(bill.taxable_amount || bill.item_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          {/* ═══ AMOUNT IN WORDS + FINANCIAL TOTALS ═══ */}
          <tr className="border-t-2 border-black">
            <td className="border-r-2 border-black p-2.5 align-top">
              <div className="text-[9px] font-bold text-gray-700 mb-0.5">Amount in Words :</div>
              <div className="text-[9.5px] font-black text-black">INR {numberToWords(bill.grand_total)}</div>
            </td>
            <td className="p-2.5 align-top">
              <table className="w-full text-[9px]">
                <tbody>
                  <tr>
                    <td className="py-0.5 font-semibold text-gray-800">Sub Total</td>
                    <td className="py-0.5 text-right font-bold">{fmt(bill.item_total)}</td>
                  </tr>
                  {(bill.discount_amount || 0) > 0 && (
                    <tr>
                      <td className="py-0.5 font-semibold text-gray-800">Discount</td>
                      <td className="py-0.5 text-right font-bold">-{fmt(bill.discount_amount!)}</td>
                    </tr>
                  )}
                  {(bill.charges_total || 0) > 0 && (
                    <tr>
                      <td className="py-0.5 font-semibold text-gray-800">Other Charges</td>
                      <td className="py-0.5 text-right font-bold">{fmt(bill.charges_total!)}</td>
                    </tr>
                  )}
                  {isInterstate ? (
                    <tr>
                      <td className="py-0.5 font-semibold text-gray-800">
                        IGST @ {itemList[0]?.tax_percent || 5}%
                      </td>
                      <td className="py-0.5 text-right font-bold">{fmt(bill.igst)}</td>
                    </tr>
                  ) : (
                    <>
                      {bill.cgst > 0 && (
                        <tr>
                          <td className="py-0.5 font-semibold text-gray-800">
                            CGST @ {((bill.cgst / (bill.taxable_amount || 1)) * 100).toFixed(2)}%
                          </td>
                          <td className="py-0.5 text-right font-bold">{fmt(bill.cgst)}</td>
                        </tr>
                      )}
                      {bill.sgst > 0 && (
                        <tr>
                          <td className="py-0.5 font-semibold text-gray-800">
                            SGST @ {((bill.sgst / (bill.taxable_amount || 1)) * 100).toFixed(2)}%
                          </td>
                          <td className="py-0.5 text-right font-bold">{fmt(bill.sgst)}</td>
                        </tr>
                      )}
                    </>
                  )}
                  {Math.abs(bill.round_off || 0) > 0 && (
                    <tr>
                      <td className="py-0.5 font-semibold text-gray-800">Round Off</td>
                      <td className="py-0.5 text-right font-bold">{fmt(bill.round_off || 0)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-black">
                    <td className="pt-1.5 font-black text-[12px] uppercase">Grand Total</td>
                    <td className="pt-1.5 font-black text-[12px] text-right">₹ {fmt(bill.grand_total)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ═══ HSN / SAC TABLE ═══ */}
          {showHsnTable && hsnSummary.length > 0 && (
            <tr className="border-t-2 border-black">
              <td colSpan={2} className="p-2">
                <table className="w-full text-[8.5px] border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-gray-100 font-extrabold border-b border-gray-400">
                      <th className="border-r border-gray-400 px-1.5 py-1 text-left">HSN/SAC</th>
                      <th className="border-r border-gray-400 px-1.5 py-1 text-right">Taxable Value</th>
                      {isInterstate ? (
                        <>
                          <th className="border-r border-gray-400 px-1.5 py-1 text-center" colSpan={2}>IGST</th>
                        </>
                      ) : (
                        <>
                          <th className="border-r border-gray-400 px-1.5 py-1 text-center" colSpan={2}>CGST</th>
                          <th className="border-r border-gray-400 px-1.5 py-1 text-center" colSpan={2}>SGST</th>
                        </>
                      )}
                      <th className="px-1.5 py-1 text-right">Total Tax Amount</th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-400 text-[8px] font-bold">
                      <th className="border-r border-gray-400" />
                      <th className="border-r border-gray-400" />
                      {isInterstate ? (
                        <>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-center">Rate</th>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-right">Amount</th>
                        </>
                      ) : (
                        <>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-center">Rate</th>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-right">Amount</th>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-center">Rate</th>
                          <th className="border-r border-gray-400 px-1 py-0.5 text-right">Amount</th>
                        </>
                      )}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {hsnSummary.map((h, i) => {
                      const totalTax = h.igst + h.cgst + h.sgst;
                      return (
                        <tr key={i} className="border-b border-gray-300 font-mono text-[8.5px]">
                          <td className="border-r border-gray-400 px-1.5 py-1 font-bold text-left">{h.hsn}</td>
                          <td className="border-r border-gray-400 px-1.5 py-1 text-right">{fmt(h.taxable)}</td>
                          {isInterstate ? (
                            <>
                              <td className="border-r border-gray-400 px-1 py-1 text-center">{h.rate}%</td>
                              <td className="border-r border-gray-400 px-1.5 py-1 text-right">{fmt(h.igst)}</td>
                            </>
                          ) : (
                            <>
                              <td className="border-r border-gray-400 px-1 py-1 text-center">{(h.rate / 2).toFixed(2)}%</td>
                              <td className="border-r border-gray-400 px-1.5 py-1 text-right">{fmt(h.cgst)}</td>
                              <td className="border-r border-gray-400 px-1 py-1 text-center">{(h.rate / 2).toFixed(2)}%</td>
                              <td className="border-r border-gray-400 px-1.5 py-1 text-right">{fmt(h.sgst)}</td>
                            </>
                          )}
                          <td className="px-1.5 py-1 text-right font-bold">{fmt(totalTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-[8.5px] border-t border-gray-400">
                      <td className="border-r border-gray-400 px-1.5 py-1 text-left">Total</td>
                      <td className="border-r border-gray-400 px-1.5 py-1 text-right font-mono font-bold">
                        {fmt(hsnSummary.reduce((s, h) => s + h.taxable, 0))}
                      </td>
                      {isInterstate ? (
                        <>
                          <td className="border-r border-gray-400" />
                          <td className="border-r border-gray-400 px-1.5 py-1 text-right font-mono font-bold">
                            {fmt(hsnSummary.reduce((s, h) => s + h.igst, 0))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-gray-400" />
                          <td className="border-r border-gray-400 px-1.5 py-1 text-right font-mono font-bold">
                            {fmt(hsnSummary.reduce((s, h) => s + h.cgst, 0))}
                          </td>
                          <td className="border-r border-gray-400" />
                          <td className="border-r border-gray-400 px-1.5 py-1 text-right font-mono font-bold">
                            {fmt(hsnSummary.reduce((s, h) => s + h.sgst, 0))}
                          </td>
                        </>
                      )}
                      <td className="px-1.5 py-1 text-right font-mono font-black">
                        {fmt(hsnSummary.reduce((s, h) => s + h.igst + h.cgst + h.sgst, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </td>
            </tr>
          )}

          {/* ═══ FOOTER: BANK DETAILS / TERMS / SIGNATORY ═══ */}
          <tr className="border-t-2 border-black">
            <td colSpan={2} className="p-0">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <tbody>
                  <tr>
                    {/* Bank details */}
                    {showBank && (
                      <td
                        className="border-r border-gray-400 p-2.5 align-top"
                        style={{
                          width: showTerms && showSignatory ? "38%" : showTerms || showSignatory ? "65%" : "100%",
                        }}
                      >
                        <div className="text-[9px] font-black uppercase mb-1">Company&apos;s Bank Details</div>
                        <table className="text-[8.5px] text-gray-800 w-full">
                          <tbody>
                            <tr><td className="pr-1.5 font-bold whitespace-nowrap w-[90px]">Bank Name</td><td>: {bankName || "-"}</td></tr>
                            <tr><td className="pr-1.5 font-bold whitespace-nowrap">A/c No.</td><td>: {bankAccountNo || "-"}</td></tr>
                            <tr><td className="pr-1.5 font-bold whitespace-nowrap">Branch &amp; IFS Code</td><td>: {bankIfsc}{bankBranch ? ` / ${bankBranch}` : ""}</td></tr>
                            <tr><td className="pr-1.5 font-bold whitespace-nowrap">Account Type</td><td>: {bankAccountType}</td></tr>
                          </tbody>
                        </table>
                      </td>
                    )}

                    {/* Terms & Conditions */}
                    {showTerms && (
                      <td
                        className={`p-2.5 align-top text-[8.5px] text-gray-800 ${showSignatory ? "border-r border-gray-400" : ""}`}
                        style={{
                          width: showBank && showSignatory ? "34%" : showBank || showSignatory ? "65%" : "100%",
                        }}
                      >
                        <div className="font-black text-[9px] uppercase mb-1">Terms &amp; Conditions</div>
                        {termsLines.map((line: string, i: number) => (
                          <div key={i} className="leading-tight mb-0.5">{i + 1}. {line}</div>
                        ))}
                      </td>
                    )}

                    {/* Signatory */}
                    {showSignatory && (
                      <td
                        className="p-2.5 align-top text-[9px]"
                        style={{
                          width: showBank && showTerms ? "28%" : showBank || showTerms ? "35%" : "100%",
                        }}
                      >
                        <div className="flex flex-col justify-between" style={{ minHeight: "85px" }}>
                          <div className="font-extrabold text-left uppercase leading-tight text-[9px]">
                            FOR {company.name || "COMPANY"}
                          </div>
                          <div className="border-t border-black text-center pt-1 font-bold text-[9px] mt-2">
                            Authorised Signatory
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ═══ DECLARATION ═══ */}
          {showDeclaration && (
            <tr className="border-t border-gray-400">
              <td colSpan={2} className="px-2.5 py-1 text-[8.5px]">
                <span className="font-bold">Declaration : </span>
                <span className="italic text-gray-700">{declaration}</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Watermark Footer */}
      <div className="text-center text-[8px] font-semibold text-gray-500 mt-1">
        This is a Computer Generated Invoice
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { margin: 0; }
          #pakka-bill-print-canvas { max-width: 210mm; margin: 0 auto; page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}
