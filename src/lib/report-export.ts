// Lazy dynamic loader for XLSX to keep initial route bundle chunks ultra-fast (<100ms)
let _xlsxPromise: Promise<typeof import("xlsx")> | null = null;
export async function getXLSX() {
  if (!_xlsxPromise) {
    _xlsxPromise = import("xlsx");
  }
  return _xlsxPromise;
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export interface ExcelColumn {
  key: string;
  label: string;
  width?: number;
  format?: "currency" | "number" | "percent" | "date" | "text";
}

export async function exportToExcel(
  columns: ExcelColumn[],
  rows: Record<string, any>[],
  filename: string,
  sheetName = "Report"
): Promise<void> {
  const XLSX = await getXLSX();
  const header = columns.map((c) => c.label);
  const data = rows.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "";
      if (col.format === "currency") {
        return typeof val === "number" ? val : parseFloat(val) || 0;
      }
      if (col.format === "date" && val) {
        return new Date(val).toLocaleDateString("en-IN");
      }
      return val;
    })
  );

  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 18 }));

  // Style header row bold
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── Multi-sheet Excel Export ─────────────────────────────────────────────────

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, any>[];
}

export async function exportMultiSheetExcel(sheets: ExcelSheet[], filename: string): Promise<void> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.label);
    const data = sheet.rows.map((row) =>
      sheet.columns.map((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return "";
        if (col.format === "currency") return typeof val === "number" ? val : parseFloat(val) || 0;
        if (col.format === "date" && val) return new Date(val).toLocaleDateString("en-IN");
        return val;
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = sheet.columns.map((c) => ({ wch: c.width ?? 18 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF / Print ──────────────────────────────────────────────────────────────

export function printReport(): void {
  window.print();
}

// ─── Currency Format ──────────────────────────────────────────────────────────

export function fmtINR(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function fmtNum(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n || 0);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Quick Date Presets ───────────────────────────────────────────────────────

export type DatePreset = "this_month" | "last_3_months" | "last_6_months" | "last_12_months" | "this_fy" | "custom";

export function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const toStr = today.toISOString().split("T")[0];

  const sub = (months: number) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split("T")[0];
  };

  const fyStart = () => {
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${year}-04-01`;
  };

  switch (preset) {
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      return { from: start, to: toStr };
    }
    case "last_3_months":
      return { from: sub(3), to: toStr };
    case "last_6_months":
      return { from: sub(6), to: toStr };
    case "last_12_months":
      return { from: sub(12), to: toStr };
    case "this_fy":
      return { from: fyStart(), to: toStr };
    default:
      return { from: fyStart(), to: toStr };
  }
}

export const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "This Month", value: "this_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "Last 6 Months", value: "last_6_months" },
  { label: "Last 12 Months", value: "last_12_months" },
  { label: "This FY", value: "this_fy" },
];

/**
 * Safely parse an Excel worksheet into JSON rows without prototype pollution risk.
 * Filters out __proto__, constructor, and prototype keys from incoming rows.
 */
export function safeSheetToJson<T = Record<string, any>>(ws: any, opts?: any, xlsxLib?: any): T[] {
  const lib = xlsxLib || (typeof window !== "undefined" && ((window as any).XLSX || (ws as any)?._xlsx));
  if (!lib) {
    return [];
  }
  const raw = lib.utils.sheet_to_json(ws, opts);
  if (!Array.isArray(raw)) return [];

  return raw.map((row: any) => {
    if (typeof row !== "object" || row === null) return row;
    const safeObj: any = Object.create(null);
    for (const key of Object.keys(row)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      safeObj[key] = row[key];
    }
    return safeObj as T;
  });
}

// ─── Formatted Financial Multi-Sheet Exporters ────────────────────────────────

export async function exportFormattedPLExcel(data: any, from: string, to: string): Promise<void> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  // Sheet 1: Main P&L Statement
  const statementRows: (string | number)[][] = [
    ["TAS ERP — STATEMENT OF PROFIT & LOSS"],
    [`Period: ${fmtDate(from)} to ${fmtDate(to)}`],
    [],
    ["Particulars", "Reference", "Current Period (₹)"],
    ["1. REVENUE FROM OPERATIONS", "", Number(data.revenue?.total || 0)],
    ["   Sales – Manufactured Finished Goods", "", Number(data.revenue?.finished_goods || 0)],
    ["   Sales – Raw Materials / Fabric", "", Number(data.revenue?.raw_material || 0)],
    ["   Sales – Accessories & Trims", "", Number(data.revenue?.accessories || 0)],
    ["   Gross Sales", "", Number(data.revenue?.gross_revenue || 0)],
    ["   Less: Sales Returns", "", -Number(data.revenue?.returns || 0)],
    ["NET SALES", "", Number(data.revenue?.total || 0)],
    [],
    ["2. COST OF GOODS SOLD (COGS)", "", Number(data.cogs?.total || 0)],
    ["   Raw Material Consumed (Manufactured)", "", Number(data.cogs?.raw_material || 0)],
    ["   Purchased Finished Goods Sold", "", Number(data.cogs?.finished_goods || 0)],
    ["   Accessories Direct Used", "", Number(data.cogs?.accessories || 0)],
    ["   Direct Job Work / Labor Cost", "", Number(data.cogs?.job_work || 0)],
    ["   Less: Closing Stock Offset", "", -Number(data.cogs?.closing_stock?.total || 0)],
    ["TOTAL COST OF GOODS SOLD", "", Number(data.cogs?.total || 0)],
    [],
    ["GROSS PROFIT (Net Sales - COGS)", "", Number(data.gross_profit || 0)],
    [`Gross Margin %: ${data.gross_margin_pct?.toFixed(2) ?? 0}%`, "", ""],
    [],
    ["3. OPERATING EXPENSES", "", Number(data.operating_expenses?.total || 0)],
    ["   Salaries & Staff Wages", "", Number(data.operating_expenses?.salary || 0)],
    ...Object.entries(data.operating_expenses?.breakdown ?? {}).map(([cat, val]) => [
      `   ${cat}`, "", Number(val || 0)
    ]),
    ["TOTAL OPERATING EXPENSES", "", Number(data.operating_expenses?.total || 0)],
    [],
    ["OPERATING PROFIT", "", Number(data.operating_profit || 0)],
    [],
    ["4. OTHER INCOME", "", Number(data.misc_income?.total || 0)],
    ["5. OTHER EXPENSES & WRITE-OFFS", "", -Number(data.other_expenses?.total || 0)],
    [],
    [data.net_profit >= 0 ? "NET PROFIT" : "NET LOSS", "", Number(data.net_profit || 0)],
    [`Net Margin %: ${data.net_margin_pct?.toFixed(2) ?? 0}%`, "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(statementRows);
  ws["!cols"] = [{ wch: 45 }, { wch: 15 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");

  // Helper to add drilldown ledger sheets
  const addLedgerSheet = (sheetName: string, items: any[]) => {
    if (!items || items.length === 0) return;
    const header = ["Invoice / Doc No.", "Date", "Party / Customer", "Category", "Description", "Amount (₹)"];
    const rows = items.map((i) => [
      i.doc_number || "",
      i.date ? fmtDate(i.date) : "",
      i.party_name || "",
      i.category || "",
      i.description || "",
      Number(i.amount || 0),
    ]);
    const sheetWs = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheetWs["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, sheetWs, sheetName.slice(0, 31));
  };

  if (data.revenue?.drill_records?.length > 0) addLedgerSheet("Sales Ledger", data.revenue.drill_records);
  if (data.revenue?.returns_drill_records?.length > 0) addLedgerSheet("Sales Returns", data.revenue.returns_drill_records);
  if (data.cogs?.purchases_drill_records?.length > 0) addLedgerSheet("COGS Purchases", data.cogs.purchases_drill_records);
  if (data.cogs?.job_work_drill_records?.length > 0) addLedgerSheet("Job Work Labor", data.cogs.job_work_drill_records);
  if (data.operating_expenses?.drill_records?.length > 0) addLedgerSheet("Expenses Ledger", data.operating_expenses.drill_records);

  XLSX.writeFile(wb, `Profit_Loss_${from}_${to}.xlsx`);
}

export async function exportFormattedBalanceExcel(data: any, asOn: string): Promise<void> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    ["TAS ERP — BALANCE SHEET STATEMENT"],
    [`As on: ${fmtDate(asOn)}`],
    [],
    ["LIABILITIES & OWNER'S EQUITY", "Amount (₹)", "ASSETS & RESOURCES", "Amount (₹)"],
    ["A. Owner's Funds (Net Worth)", Number(data.net_position || 0), "A. Non-Current Assets", Number(data.assets?.non_current?.total || 0)],
    ["B. Non-Current Liabilities", Number(data.liabilities?.non_current?.total || 0), "B. Current Assets", Number(data.assets?.current?.total || 0)],
    ["C. Current Liabilities", Number(data.liabilities?.current?.total || 0), "   Inventory (Stock Assets)", Number(data.assets?.current?.inventory?.total || 0)],
    ["   Trade Payables (Suppliers)", Number(data.liabilities?.current?.trade_payables || 0), "     Raw Material Stock", Number(data.assets?.current?.inventory?.raw_material || 0)],
    ["     Raw Material Payables", Number(data.liabilities?.current?.rm_payables || 0), "     Finished Goods Stock", Number(data.assets?.current?.inventory?.finished_goods || 0)],
    ["     Finished Goods Payables", Number(data.liabilities?.current?.fg_payables || 0), "   Trade Receivables (Customers)", Number(data.assets?.current?.trade_receivables || 0)],
    ["   Worker & Job Work Payables", Number(data.liabilities?.current?.worker_payables || 0), "   Cash in Hand", Number(data.assets?.current?.cash_in_hand || 0)],
    ["   Outstanding Expenses", Number(data.liabilities?.current?.outstanding_expenses || 0), "   Bank Accounts", Number(data.assets?.current?.bank_accounts || 0)],
    [],
    ["TOTAL LIABILITIES & EQUITY", Number(data.assets?.total || 0), "TOTAL ASSETS", Number(data.assets?.total || 0)],
    [],
    ["Working Capital", Number(data.working_capital || 0), "Balance Status", data.is_balanced ? "BALANCED" : "OUT OF BALANCE"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 35 }, { wch: 18 }, { wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");

  const addBSDetail = (sheetName: string, items: any[]) => {
    if (!items || items.length === 0) return;
    const header = ["Doc / Account No.", "Date", "Party / Bank Name", "Description", "Amount (₹)"];
    const itemRows = items.map((i) => [
      i.doc_number || "",
      i.date ? fmtDate(i.date) : "",
      i.party_name || "",
      i.description || "",
      Number(i.amount || 0),
    ]);
    const detailWs = XLSX.utils.aoa_to_sheet([header, ...itemRows]);
    detailWs["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, detailWs, sheetName.slice(0, 31));
  };

  if (data.drill_records?.receivables?.length > 0) addBSDetail("Receivables Ledger", data.drill_records.receivables);
  if (data.drill_records?.payables?.length > 0) addBSDetail("Payables Ledger", data.drill_records.payables);
  if (data.drill_records?.worker_payables?.length > 0) addBSDetail("Worker Balances", data.drill_records.worker_payables);
  if (data.drill_records?.bank_accounts?.length > 0) addBSDetail("Bank Accounts", data.drill_records.bank_accounts);
  if (data.drill_records?.inventory_rm?.length > 0) addBSDetail("RM Stock Valuation", data.drill_records.inventory_rm);
  if (data.drill_records?.inventory_fg?.length > 0) addBSDetail("FG Stock Valuation", data.drill_records.inventory_fg);

  XLSX.writeFile(wb, `Balance_Sheet_${asOn}.xlsx`);
}

export function exportFormattedGSTExcel(data: any, from: string, to: string): void {
  exportMultiSheetExcel([
    {
      name: "GST Summary",
      columns: [
        { key: "head", label: "Tax Head / Item", width: 28 },
        { key: "taxable", label: "Taxable Value (₹)", format: "currency" as const, width: 18 },
        { key: "cgst", label: "CGST (₹)", format: "currency" as const, width: 14 },
        { key: "sgst", label: "SGST (₹)", format: "currency" as const, width: 14 },
        { key: "igst", label: "IGST (₹)", format: "currency" as const, width: 14 },
        { key: "total", label: "Total Tax (₹)", format: "currency" as const, width: 18 },
      ],
      rows: [
        { head: "Output GST (Sales)", taxable: data.output_gst?.totals?.taxable_value, cgst: data.output_gst?.totals?.cgst, sgst: data.output_gst?.totals?.sgst, igst: data.output_gst?.totals?.igst, total: data.output_gst?.totals?.total },
        { head: "Input GST (Eligible ITC)", taxable: data.input_gst?.totals?.taxable_value, cgst: data.input_gst?.totals?.cgst, sgst: data.input_gst?.totals?.sgst, igst: data.input_gst?.totals?.igst, total: data.input_gst?.totals?.total },
        { head: "RCM Liability", taxable: data.rcm?.totals?.taxable_value, cgst: data.rcm?.totals?.cgst, sgst: data.rcm?.totals?.sgst, igst: data.rcm?.totals?.igst, total: data.rcm?.totals?.total },
        { head: "Net GST Position", taxable: 0, cgst: data.summary?.net_payable?.cgst, sgst: data.summary?.net_payable?.sgst, igst: data.summary?.net_payable?.igst, total: data.summary?.net_payable?.total },
      ],
    },
    {
      name: "Output GST Sales",
      columns: [
        { key: "doc_number", label: "Invoice No.", width: 18 },
        { key: "date", label: "Date", format: "date" as const, width: 12 },
        { key: "party_name", label: "Customer", width: 28 },
        { key: "gstin", label: "GSTIN", width: 20 },
        { key: "taxable_value", label: "Taxable (₹)", format: "currency" as const, width: 16 },
        { key: "cgst", label: "CGST (₹)", format: "currency" as const, width: 14 },
        { key: "sgst", label: "SGST (₹)", format: "currency" as const, width: 14 },
        { key: "igst", label: "IGST (₹)", format: "currency" as const, width: 14 },
        { key: "total_gst", label: "GST Total (₹)", format: "currency" as const, width: 16 },
      ],
      rows: data.output_gst?.rows ?? [],
    },
    {
      name: "Input ITC Purchases",
      columns: [
        { key: "doc_number", label: "Purchase No.", width: 18 },
        { key: "date", label: "Date", format: "date" as const, width: 12 },
        { key: "party_name", label: "Supplier", width: 28 },
        { key: "gstin", label: "GSTIN", width: 20 },
        { key: "taxable_value", label: "Taxable (₹)", format: "currency" as const, width: 16 },
        { key: "cgst", label: "CGST (₹)", format: "currency" as const, width: 14 },
        { key: "sgst", label: "SGST (₹)", format: "currency" as const, width: 14 },
        { key: "igst", label: "IGST (₹)", format: "currency" as const, width: 14 },
        { key: "total_gst", label: "GST Total (₹)", format: "currency" as const, width: 16 },
      ],
      rows: [...(data.input_gst?.rows ?? []), ...(data.input_gst?.expense_rows ?? [])],
    },
    {
      name: "RCM Register",
      columns: [
        { key: "doc_number", label: "Doc No.", width: 18 },
        { key: "date", label: "Date", format: "date" as const, width: 12 },
        { key: "party_name", label: "Supplier", width: 28 },
        { key: "taxable_value", label: "Taxable (₹)", format: "currency" as const, width: 16 },
        { key: "cgst", label: "CGST (₹)", format: "currency" as const, width: 14 },
        { key: "sgst", label: "SGST (₹)", format: "currency" as const, width: 14 },
        { key: "total_gst", label: "RCM Total (₹)", format: "currency" as const, width: 16 },
      ],
      rows: data.rcm?.rows ?? [],
    },
  ], `GST_Summary_${from}_${to}`);
}

export async function exportFormattedCashFlowExcel(data: any, from: string, to: string): Promise<void> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    ["TAS ERP — CASH FLOW STATEMENT"],
    [`Period: ${fmtDate(from)} to ${fmtDate(to)}`],
    [],
    ["Particulars", "", "Amount (₹)"],
    ["OPENING CASH & BANK BALANCE", "", Number(data.opening_balance || 0)],
    [],
    ["1. CASH & BANK INFLOWS (COLLECTIONS)", "", Number(data.inflows?.total || 0)],
    ["   Customer Receipts (Sales Collections)", "", Number(data.inflows?.customer_receipts || 0)],
    ["   Direct Deposits & Misc Receipts", "", Number(data.inflows?.misc_income || 0)],
    ["TOTAL CASH INFLOWS (A)", "", Number(data.inflows?.total || 0)],
    [],
    ["2. CASH & BANK OUTFLOWS (DISBURSEMENTS)", "", Number(data.outflows?.total || 0)],
    ["   Supplier Payments (Raw Material & FG)", "", Number(data.outflows?.supplier_payments || 0)],
    ["   Worker Stage Labor Payouts", "", Number(data.outflows?.worker_payments || 0)],
    ["   Operating Expense Payments", "", Number(data.outflows?.expense_payments || 0)],
    ["TOTAL CASH OUTFLOWS (B)", "", Number(data.outflows?.total || 0)],
    [],
    ["NET CASH FLOW (A - B)", "", Number(data.net_cash_flow || 0)],
    [],
    ["CLOSING CASH & BANK BALANCE", "", Number(data.closing_balance || 0)],
    ["   Cash in Hand", "", Number(data.cash_in_hand || 0)],
    ["   Bank Accounts & Balances", "", Number(data.bank_balance || 0)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Cash Flow");

  if (data.inflows?.rows?.length > 0) {
    const inWs = XLSX.utils.aoa_to_sheet([
      ["Doc / Receipt No.", "Date", "Party / Customer", "Mode", "Amount (₹)"],
      ...data.inflows.rows.map((r: any) => [r.doc_number, fmtDate(r.date), r.party_name || "—", r.description || "—", Number(r.amount || 0)]),
    ]);
    inWs["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, inWs, "Inflow Transactions");
  }

  if (data.outflows?.rows?.length > 0) {
    const outWs = XLSX.utils.aoa_to_sheet([
      ["Doc / Voucher No.", "Date", "Payee / Supplier", "Category / Note", "Amount (₹)"],
      ...data.outflows.rows.map((r: any) => [r.doc_number, fmtDate(r.date), r.party_name || "—", r.description || "—", Number(r.amount || 0)]),
    ]);
    outWs["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, outWs, "Outflow Transactions");
  }

  XLSX.writeFile(wb, `CashFlow_${from}_${to}.xlsx`);
}

export function exportSingleLedgerExcel(title: string, items: any[], filename?: string): void {
  exportToExcel(
    [
      { key: "doc_number", label: "Doc / Invoice No.", width: 20 },
      { key: "date", label: "Date", format: "date", width: 14 },
      { key: "party_name", label: "Party Name", width: 30 },
      { key: "category", label: "Category", width: 20 },
      { key: "description", label: "Description / Remarks", width: 35 },
      { key: "amount", label: "Amount (₹)", format: "currency", width: 18 },
    ],
    items,
    filename || title.replace(/[^a-zA-Z0-9]/g, "_")
  );
}


