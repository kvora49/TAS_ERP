"use client";

import React from "react";
import { numberToWords } from "@/lib/utils/numberToWords";
import type { BillConfig, CompanyProfile, PakkaBillData, PakkaBillItem, PrintExclusions } from "./PakkaBillTemplate";

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

/** Group identical article + colour items into matrix */
function groupBillItems(items: PakkaBillItem[]) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const groups: Array<{
    id: string;
    item_name: string;
    article_no: string;
    fabric_type: string;
    colour: string;
    unit: string;
    rate: number;
    sizes: Record<string, number>;
    rolls: Array<{ roll_number: string; meters: number; shade?: string; width?: number }>;
    total_qty: number;
    total_amount: number;
    description?: string;
    is_fabric: boolean;
  }> = [];

  for (const it of list) {
    const isFabric = it.item_type === "fabric" || !!it.material_type || !!(it as any).material_type_id || !!(it as any).raw_material_type_id || (it as any).unit?.toLowerCase().includes("meter");
    const articleNo = it.design?.design_number || it.design_code || (it as any).article_no || (it as any).design_number || "";
    const itemName = it.item_name || (it as any).name || (it as any).title || it.design?.name || it.design_name || it.material_type?.name || (it as any).description || "Item";
    const colourName = it.colour?.colour_name || it.colour_name || (it as any).colour || (it as any).color || "";
    const unitName = (it.unit || (isFabric ? "MTR" : "PCS")).toUpperCase();

    const qty = Number(it.quantity || (it as any).qty || 0);
    const rateVal = Number(it.rate || 0);
    const netAmt = Number(it.amount || (qty * rateVal) || 0);

    const existing = isFabric
      ? null
      : groups.find(
          (g) =>
            !g.is_fabric &&
            g.article_no === articleNo &&
            g.colour === colourName &&
            g.rate === rateVal &&
            articleNo !== ""
        );

    if (existing) {
      existing.total_qty += qty;
      existing.total_amount += netAmt;
      if (it.size_quantities) {
        Object.entries(it.size_quantities).forEach(([sz, q]) => {
          existing.sizes[sz] = (existing.sizes[sz] || 0) + Number(q || 0);
        });
      } else if (it.size) {
        existing.sizes[it.size] = (existing.sizes[it.size] || 0) + qty;
      }
    } else {
      const sizes: Record<string, number> = {};
      if (it.size_quantities) {
        Object.entries(it.size_quantities).forEach(([sz, q]) => {
          if (Number(q) > 0) sizes[sz] = Number(q);
        });
      } else if (it.size) {
        sizes[it.size] = qty;
      }

      groups.push({
        id: it.id || `k-${groups.length}`,
        item_name: itemName,
        article_no: articleNo,
        fabric_type: it.description || "",
        colour: colourName,
        unit: unitName,
        rate: rateVal,
        sizes,
        rolls: (it.rolls || []) as any,
        total_qty: qty,
        total_amount: netAmt,
        description: it.description || undefined,
        is_fabric: isFabric,
      });
    }
  }

  return groups;
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

interface Props {
  bill: PakkaBillData;
  company: CompanyProfile;
  config?: BillConfig | null;
  exclusions?: PrintExclusions;
  logoUrl?: string | null;
}

export function KachaBillTemplate({ bill, company, config, exclusions = {}, logoUrl }: Props) {
  const itemList = (bill.items && bill.items.length > 0)
    ? bill.items
    : (bill as any).sale_bill_items || (bill as any).items_data || [];

  const groupedItems = groupBillItems(itemList);

  const companyState = deriveStateDetails(company.address, company.gstin, company.state, company.state_code);

  const shipSame = bill.ship_to_same_as_bill_to !== false;

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

  const consigneeName = shipSame ? partyName : (bill.consignee_name || partyName);
  const consigneeAddress = shipSame ? billingAddress : (bill.consignee_address || billingAddress);
  const consigneeGstin = shipSame ? partyGstin : (bill.consignee_gstin || partyGstin);
  const consigneeState = shipSame
    ? billToState
    : deriveStateDetails(consigneeAddress, consigneeGstin, bill.consignee_state, bill.consignee_state_code);

  const showBank = !exclusions.excludeBankDetails;
  const showTerms = !exclusions.excludeTermsConditions;
  const showDeclaration = !exclusions.excludeDeclaration;
  const showSignatory = !exclusions.excludeSignatory;

  const rawTerms = config?.terms_conditions || config?.footer_text || (company as any)?.terms_conditions || "Goods once sold will not be taken back.";
  const termsLines = rawTerms
    .split("\n")
    .map((t: string) => t.trim().replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean);

  const declarationText =
    config?.declaration ||
    config?.declaration_text ||
    (company as any)?.declaration ||
    "We declare that this Kaccha Bill shows the actual details of the goods described and that all particulars are true and correct.";

  // Bank details resolution
  const bankName =
    (config?.bank_account as any)?.bank_name ||
    config?.bank_name ||
    (config?.bank_account as any)?.name ||
    (company as any)?.bank_name ||
    "";

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

  const bankAccountType =
    config?.bank_account_type ||
    (config?.bank_account as any)?.type ||
    (config?.bank_account as any)?.account_type ||
    (company as any)?.bank_account_type ||
    "Current Account";

  const totalQtyByUnit: Record<string, number> = {};
  groupedItems.forEach((g) => {
    totalQtyByUnit[g.unit] = (totalQtyByUnit[g.unit] || 0) + g.total_qty;
  });

  const qtyParts = Object.entries(totalQtyByUnit).map(([u, q]) => `${fmt(q, 0)} ${u}`);

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
      id="kacha-bill-print-canvas"
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

                {/* KACCHA BILL Header Title (Centered in Top Header) */}
                <div className="text-center text-[18px] font-black tracking-wide uppercase whitespace-nowrap pt-1">
                  KACCHA BILL
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
                    <DispatchRow label="Bill No." value={bill.bill_number} />
                    <DispatchRow label="Bill Date" value={fmtDate(bill.bill_date)} />
                    <DispatchRow label="Delivery Note" value={bill.delivery_note} />
                    {!exclusions.excludeModeOfPayment && <DispatchRow label="Mode/Terms of Payment" value={fmtPaymentTerms(bill.mode_of_payment || bill.payment_terms)} />}

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

          {/* ═══ ITEMS TABLE (No GST / No HSN) ═══ */}
          <tr>
            <td colSpan={2} className="p-0">
              <table className="w-full border-collapse text-[9px]" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[5%]">Sr.<br/>No.</th>
                    <th className="border-r border-gray-400 py-1.5 px-2 text-left font-extrabold w-[35%]">Description of Goods</th>
                    <th className="border-r border-gray-400 py-1.5 px-1.5 text-center font-extrabold w-[32%]">Details</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[10%]">Quantity</th>
                    <th className="border-r border-gray-400 py-1.5 px-1.5 text-right font-extrabold w-[9%]">Rate</th>
                    <th className="border-r border-gray-400 py-1.5 px-1 text-center font-extrabold w-[4%]">per</th>
                    <th className="py-1.5 px-1.5 text-right font-extrabold w-[13%]">Amount<br/>(₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.length > 0 ? (
                    groupedItems.map((group, idx) => {
                      const sizeEntries = Object.entries(group.sizes);
                      const hasSizes = sizeEntries.length > 0;
                      const hasRolls = group.rolls.length > 0;

                      return (
                        <tr key={group.id || idx} className="border-b border-gray-300 align-top">
                          <td className="border-r border-gray-400 py-2 px-1 text-center font-bold">{idx + 1}</td>
                          <td className="border-r border-gray-400 py-2 px-2">
                            <div className="font-extrabold text-[10px] text-black uppercase">{group.item_name}</div>
                            {group.article_no && <div className="text-[8.5px] font-semibold text-gray-700">Article No. : {group.article_no}</div>}
                            {group.is_fabric && group.fabric_type && <div className="text-[8.5px] text-gray-700">Fabric Type : {group.fabric_type}</div>}
                            {group.colour && group.colour !== "Default" && <div className="text-[8.5px] text-gray-700">Color : {group.colour}</div>}
                            {!group.is_fabric && group.description && <div className="text-[8.5px] text-gray-700">{group.description}</div>}
                          </td>
                          <td className="border-r border-gray-400 p-1.5">
                            {hasSizes ? (
                              <table className="w-full border-collapse border border-black text-[8px] text-center">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-black font-extrabold">
                                    <th colSpan={sizeEntries.length + 1} className="py-0.5">Size Breakup (PCS)</th>
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
                                    <td className="border-r border-black py-0.5 px-1 font-bold bg-gray-50">Qty (PCS)</td>
                                    {sizeEntries.map(([sz, q]) => (
                                      <td key={sz} className="border-r border-black last:border-r-0 py-0.5 px-1 font-semibold">{q}</td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            ) : hasRolls ? (
                              <table className="w-full border-collapse border border-black text-[8px]">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-black font-extrabold text-center">
                                    <th colSpan={2} className="py-0.5">Roll Details</th>
                                  </tr>
                                  <tr className="bg-gray-50 border-b border-black font-bold">
                                    <th className="border-r border-black py-0.5 px-1 text-left">Roll No.</th>
                                    <th className="py-0.5 px-1 text-right">Meters</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rolls.map((r, ri) => (
                                    <tr key={ri} className="border-b border-gray-300 last:border-b-0">
                                      <td className="border-r border-black py-0.5 px-1 font-mono font-semibold">{r.roll_number}</td>
                                      <td className="py-0.5 px-1 text-right font-semibold">{fmt(r.meters)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="space-y-0.5 text-[8.5px] text-gray-800">
                                {group.article_no && group.article_no !== "—" && <div><span className="font-bold">Article No:</span> {group.article_no}</div>}
                                {group.colour && group.colour !== "Default" && group.colour !== "—" && <div><span className="font-bold">Color / Shade:</span> {group.colour}</div>}
                                {group.description && <div className="italic text-gray-600">{group.description}</div>}
                                {!group.article_no && !group.colour && !group.description && (
                                  <div><span className="font-bold">Specification:</span> Standard {group.unit}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="border-r border-gray-400 py-2 px-1 text-center font-bold text-[9.5px]">
                            {fmt(group.total_qty, 0)} {group.unit}
                          </td>
                          <td className="border-r border-gray-400 py-2 px-1.5 text-right font-mono text-[9px] font-bold">
                            {fmt(group.rate)}
                          </td>
                          <td className="border-r border-gray-400 py-2 px-1 text-center font-semibold text-[9px]">
                            {group.unit}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono font-extrabold text-[9.5px]">
                            {fmt(group.total_amount)}
                          </td>
                        </tr>
                      );
                    })
                  ) : itemList.length > 0 ? (
                    itemList.map((it: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-300 align-top">
                        <td className="border-r border-gray-400 py-2 px-1 text-center font-bold">{idx + 1}</td>
                        <td className="border-r border-gray-400 py-2 px-2">
                          <div className="font-extrabold text-[10px] text-black uppercase">
                            {it.item_name || it.name || it.design?.name || it.material_type?.name || "Item"}
                          </div>
                        </td>
                        <td className="border-r border-gray-400 p-1.5 text-[8.5px] text-gray-700 italic">—</td>
                        <td className="border-r border-gray-400 py-2 px-1 text-center font-bold text-[9.5px]">
                          {fmt(Number(it.quantity || 0), 0)} {it.unit || "PCS"}
                        </td>
                        <td className="border-r border-gray-400 py-2 px-1.5 text-right font-mono text-[9px] font-bold">
                          {fmt(Number(it.rate || 0))}
                        </td>
                        <td className="border-r border-gray-400 py-2 px-1 text-center font-semibold text-[9px]">
                          {it.unit || "PCS"}
                        </td>
                        <td className="py-2 px-1.5 text-right font-mono font-extrabold text-[9.5px]">
                          {fmt(Number(it.amount || 0))}
                        </td>
                      </tr>
                    ))
                  ) : null}
                  <tr className="border-b border-gray-200">
                    <td className="border-r border-gray-400 py-3 px-1" />
                    <td className="border-r border-gray-400 py-3 px-2" />
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
                    <td className="border-r border-gray-400 py-1.5 px-2 text-[9.5px]">Total Quantity</td>
                    <td className="border-r border-gray-400 py-1.5 px-1.5" />
                    <td className="border-r border-gray-400 py-1.5 px-1 text-[8.5px] font-bold text-center leading-tight">
                      {qtyParts.map((p, i) => <div key={i}>{p}</div>)}
                    </td>
                    <td colSpan={2} className="border-r border-gray-400 py-1.5 px-1 text-right text-[9px] font-bold">
                      Sub Total
                    </td>
                    <td className="py-1.5 px-1.5 text-[9.5px] text-right font-black">
                      {fmt(bill.item_total)}
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

          {/* ═══ FOOTER: BANK / TERMS / SIGNATORY ═══ */}
          <tr className="border-t-2 border-black">
            <td colSpan={2} className="p-0">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <tbody>
                  <tr>
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
            <tr className="border-t border-black">
              <td colSpan={2} className="px-2.5 py-1 text-[8px] text-gray-700">
                <span className="font-bold uppercase">Declaration : </span>
                {declarationText}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer watermark */}
      <div className="text-center text-[8px] font-semibold text-gray-500 mt-1">
        This is a Computer Generated Kaccha Bill
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { margin: 0; }
          #kacha-bill-print-canvas { max-width: 210mm; margin: 0 auto; page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}
