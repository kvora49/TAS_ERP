import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate } from "@/lib/report-export";

// â”€â”€â”€ PDF-safe currency formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// jsPDF's built-in Helvetica/Times fonts do NOT support the Unicode Rupee
// symbol Rs. (U+20B9) "” it renders as the superscript Â¹ or similar garbage.
// We use "Rs." as the PDF-safe prefix instead.
function pdfINR(n: number | null | undefined): string {
  const val = n || 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.abs(val));
  return val < 0 ? `(Rs. ${formatted})` : `Rs. ${formatted}`;
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReportPDFOptions {
  from?: string;
  to?: string;
  asOn?: string;
  billType?: string;
  companyName?: string;
  reportSubtitle?: string;
}

export interface DrillItem {
  id: string;
  doc_number: string;
  date: string;
  party_name?: string;
  description?: string;
  category?: string;
  amount: number;
  badge?: string;
}

// â”€â”€â”€ Common Helper: Header & Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function addDocumentHeader(
  doc: jsPDF,
  title: string,
  options: ReportPDFOptions
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const company = options.companyName || "TAS ERP - Garment Manufacturing";

  // Top banner accent
  doc.setFillColor(79, 70, 229); // Brand primary Indigo (#4F46E5)
  doc.rect(0, 0, pageWidth, 5, "F");

  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(company, 14, 16);

  // Document Title
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229);
  doc.text(title.toUpperCase(), 14, 24);

  // Metadata block (right aligned)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500

  let periodText = "";
  if (options.from && options.to) {
    periodText = `Period: ${fmtDate(options.from)} to ${fmtDate(options.to)}`;
  } else if (options.asOn) {
    periodText = `As on: ${fmtDate(options.asOn)}`;
  }

  const generatedDate = `Generated: ${new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  doc.text(periodText, pageWidth - 14, 15, { align: "right" });
  if (options.billType && options.billType !== "all") {
    doc.text(`View: ${options.billType.toUpperCase()}`, pageWidth - 14, 20, { align: "right" });
  }
  doc.text(generatedDate, pageWidth - 14, 25, { align: "right" });

  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 28, pageWidth - 14, 28);
}

function addDocumentFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400

    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.text("TAS ERP Â· Confidential Financial Document", 14, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }
}

// â”€â”€â”€ 1. Profit & Loss PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function exportPLStatementPDF(
  data: any,
  options: ReportPDFOptions
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  addDocumentHeader(doc, "Statement of Profit & Loss", options);

  const tableBody: any[] = [];

  // 1. REVENUE
  tableBody.push([
    { content: "1. REVENUE FROM OPERATIONS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 253, 244], textColor: [22, 101, 52] } },
    { content: pdfINR(data.revenue.total), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 253, 244], textColor: [22, 101, 52] } },
  ]);
  tableBody.push(["    Sales - Manufactured Finished Goods", "", pdfINR(data.revenue.finished_goods)]);
  tableBody.push(["    Sales - Raw Materials / Fabric", "", pdfINR(data.revenue.raw_material)]);
  tableBody.push(["    Sales - Accessories & Trims", "", pdfINR(data.revenue.accessories)]);
  if (data.revenue.others > 0) {
    tableBody.push(["    Sales - Others", "", pdfINR(data.revenue.others)]);
  }
  tableBody.push(["    Gross Sales", "", { content: pdfINR(data.revenue.gross_revenue), styles: { fontStyle: "bold" } }]);
  tableBody.push(["    Less: Sales Returns", "", { content: `(${pdfINR(data.revenue.returns)})`, styles: { textColor: [225, 29, 72] } }]);
  tableBody.push([
    { content: "NET SALES (A)", styles: { fontStyle: "bold" } },
    "",
    { content: pdfINR(data.revenue.total), styles: { fontStyle: "bold", halign: "right", textColor: [22, 101, 52] } },
  ]);

  // 2. COGS
  tableBody.push([
    { content: "2. COST OF GOODS SOLD (COGS)", colSpan: 2, styles: { fontStyle: "bold", fillColor: [255, 241, 242], textColor: [159, 18, 57] } },
    { content: pdfINR(data.cogs.total), styles: { fontStyle: "bold", halign: "right", fillColor: [255, 241, 242], textColor: [159, 18, 57] } },
  ]);
  tableBody.push(["    A. Raw Material Consumed (Manufactured)", "", pdfINR(data.cogs.raw_material)]);
  tableBody.push(["    B. Purchased Finished Goods Sold", "", pdfINR(data.cogs.finished_goods)]);
  tableBody.push(["    C. Accessories Direct Used", "", pdfINR(data.cogs.accessories)]);
  if (data.cogs.job_work > 0) {
    tableBody.push(["    D. Direct Job Work / Production Labor Cost", "", pdfINR(data.cogs.job_work)]);
  }
  tableBody.push([
    "    Less: Closing Stock Valuation Offset (RM + FG)",
    "",
    { content: `(${pdfINR(data.cogs.closing_stock.total)})`, styles: { textColor: [217, 119, 6] } },
  ]);
  tableBody.push([
    { content: "TOTAL COST OF GOODS SOLD (B)", styles: { fontStyle: "bold" } },
    "",
    { content: pdfINR(data.cogs.total), styles: { fontStyle: "bold", halign: "right", textColor: [159, 18, 57] } },
  ]);

  // GROSS PROFIT
  tableBody.push([
    { content: `GROSS PROFIT (A - B)  [Margin: ${data.gross_margin_pct?.toFixed(2) ?? 0}%]`, colSpan: 2, styles: { fontStyle: "bold", fillColor: [238, 242, 255], textColor: [67, 56, 202] } },
    { content: pdfINR(data.gross_profit), styles: { fontStyle: "bold", halign: "right", fillColor: [238, 242, 255], textColor: [67, 56, 202] } },
  ]);

  // 3. OPERATING EXPENSES
  tableBody.push([
    { content: "3. OPERATING EXPENSES", colSpan: 2, styles: { fontStyle: "bold", fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
    { content: pdfINR(data.operating_expenses.total), styles: { fontStyle: "bold", halign: "right", fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
  ]);
  tableBody.push(["    Salaries & Staff Wages", "", pdfINR(data.operating_expenses.salary)]);
  Object.entries(data.operating_expenses.breakdown ?? {}).forEach(([cat, val]) => {
    tableBody.push([`    ${cat}`, "", pdfINR(val as number)]);
  });
  tableBody.push([
    { content: "TOTAL OPERATING EXPENSES (C)", styles: { fontStyle: "bold" } },
    "",
    { content: pdfINR(data.operating_expenses.total), styles: { fontStyle: "bold", halign: "right", textColor: [146, 64, 14] } },
  ]);

  // OPERATING PROFIT
  tableBody.push([
    { content: "OPERATING PROFIT", colSpan: 2, styles: { fontStyle: "bold", fillColor: [248, 250, 252] } },
    { content: pdfINR(data.operating_profit), styles: { fontStyle: "bold", halign: "right", textColor: [15, 23, 42] } },
  ]);

  // 4. OTHER INCOME
  if (data.misc_income?.total > 0) {
    tableBody.push([
      { content: "4. OTHER INCOME", colSpan: 2, styles: { fontStyle: "bold" } },
      { content: pdfINR(data.misc_income.total), styles: { fontStyle: "bold", halign: "right" } },
    ]);
    Object.entries(data.misc_income.breakdown ?? {}).forEach(([type, val]) => {
      tableBody.push([`    ${type}`, "", pdfINR(val as number)]);
    });
  }

  // 5. OTHER EXPENSES
  if (data.other_expenses?.total > 0) {
    tableBody.push([
      { content: "5. OTHER EXPENSES & WRITE-OFFS", colSpan: 2, styles: { fontStyle: "bold" } },
      { content: pdfINR(data.other_expenses.total), styles: { fontStyle: "bold", halign: "right" } },
    ]);
    tableBody.push(["    Bad Debts Written Off", "", pdfINR(data.other_expenses.bad_debts)]);
  }

  // FINAL NET PROFIT
  const isNetProfit = data.net_profit >= 0;
  tableBody.push([
    {
      content: isNetProfit ? `NET PROFIT [Net Margin: ${data.net_margin_pct?.toFixed(2) ?? 0}%]` : `NET LOSS [Net Margin: ${data.net_margin_pct?.toFixed(2) ?? 0}%]`,
      colSpan: 2,
      styles: {
        fontStyle: "bold",
        fontSize: 10,
        fillColor: isNetProfit ? [220, 252, 231] : [254, 226, 226],
        textColor: isNetProfit ? [22, 101, 52] : [159, 18, 57],
      },
    },
    {
      content: pdfINR(data.net_profit),
      styles: {
        fontStyle: "bold",
        fontSize: 10,
        halign: "right",
        fillColor: isNetProfit ? [220, 252, 231] : [254, 226, 226],
        textColor: isNetProfit ? [22, 101, 52] : [159, 18, 57],
      },
    },
  ]);

  autoTable(doc, {
    startY: 32,
    head: [["Particulars", "Ref", "Amount (Rs.)"]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 122 },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 44, halign: "right" },
    },
    tableWidth: 182,
  });

  // Attach Granular Drilldown Schedules if present
  let currentY = (doc as any).lastAutoTable.finalY + 8;

  const appendSchedule = (scheduleTitle: string, records: DrillItem[]) => {
    if (!records || records.length === 0) return;

    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(scheduleTitle, 14, currentY);
    currentY += 4;

    const rows = records.map((r) => [
      r.doc_number || "-",
      fmtDate(r.date),
      r.party_name || "-",
      r.category || r.description || "-",
      pdfINR(r.amount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Doc / Invoice", "Date", "Party / Customer", "Category / Note", "Amount (Rs.)"]],
      body: rows,
      foot: [["Total", "", "", `${records.length} records`, pdfINR(records.reduce((s, r) => s + (r.amount || 0), 0))]],
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20 },
        2: { cellWidth: 64 },
        3: { cellWidth: 42 },
        4: { cellWidth: 28, halign: "right" },
      },
      tableWidth: 182,
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  };

  if (data.revenue?.drill_records?.length > 0) {
    appendSchedule("Schedule A: Revenue & Sales Breakdown", data.revenue.drill_records);
  }
  if (data.cogs?.purchases_drill_records?.length > 0) {
    appendSchedule("Schedule B: Purchases & COGS Materials", data.cogs.purchases_drill_records);
  }
  if (data.cogs?.job_work_drill_records?.length > 0) {
    appendSchedule("Schedule C: Job Work & Worker Labor Costs", data.cogs.job_work_drill_records);
  }
  if (data.operating_expenses?.drill_records?.length > 0) {
    appendSchedule("Schedule D: Operating Expenses & Overheads", data.operating_expenses.drill_records);
  }

  addDocumentFooter(doc);
  const fname = `PL_Statement_${options.from || ""}_${options.to || ""}.pdf`;
  doc.save(fname);
}

// â”€â”€â”€ 2. Balance Sheet PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function exportBalanceSheetPDF(
  data: any,
  options: ReportPDFOptions
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  addDocumentHeader(doc, "Balance Sheet Statement", options);

  const liabilitiesBody: any[] = [
    [{ content: "A. OWNER'S FUNDS / EQUITY", colSpan: 2, styles: { fontStyle: "bold", fillColor: [238, 242, 255], textColor: [67, 56, 202] } }],
    ["    Net Position / Retained Reserves", pdfINR(data.net_position)],
    [{ content: "B. NON-CURRENT LIABILITIES", colSpan: 2, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }],
    ["    Long-term Borrowings & Loans", pdfINR(data.liabilities.non_current.total)],
    [{ content: "C. CURRENT LIABILITIES", colSpan: 2, styles: { fontStyle: "bold", fillColor: [255, 241, 242], textColor: [159, 18, 57] } }],
    ["    Trade Payables (Suppliers)", pdfINR(data.liabilities.current.trade_payables)],
    ["      Raw Material Suppliers", pdfINR(data.liabilities.current.rm_payables)],
    ["      Finished Goods Suppliers", pdfINR(data.liabilities.current.fg_payables)],
    ["    Worker & Job Work Payables", pdfINR(data.liabilities.current.worker_payables)],
    ["    Outstanding Incurred Expenses", pdfINR(data.liabilities.current.outstanding_expenses)],
    [{ content: "TOTAL LIABILITIES & EQUITY", styles: { fontStyle: "bold" } }, { content: pdfINR(data.assets.total), styles: { fontStyle: "bold", halign: "right", textColor: [159, 18, 57] } }],
  ];

  const assetsBody: any[] = [
    [{ content: "A. NON-CURRENT ASSETS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }],
    ["    Fixed Assets & Security Deposits", pdfINR(data.assets.non_current.total)],
    [{ content: "B. CURRENT ASSETS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [239, 246, 255], textColor: [29, 78, 216] } }],
    ["    Inventories (Total Stock Assets)", pdfINR(data.assets.current.inventory.total)],
    ["      Raw Material Stock", pdfINR(data.assets.current.inventory.raw_material)],
    ["      Finished Goods Stock", pdfINR(data.assets.current.inventory.finished_goods)],
    ["    Trade Receivables (Customer Outstanding)", pdfINR(data.assets.current.trade_receivables)],
    ["    Cash in Hand", pdfINR(data.assets.current.cash_in_hand)],
    ["    Bank Accounts & Wallets", pdfINR(data.assets.current.bank_accounts)],
    [{ content: "TOTAL ASSETS", styles: { fontStyle: "bold" } }, { content: pdfINR(data.assets.total), styles: { fontStyle: "bold", halign: "right", textColor: [29, 78, 216] } }],
  ];

  // Render Liabilities Table
  autoTable(doc, {
    startY: 32,
    head: [["Liabilities & Owner's Equity", "Amount (Rs.)"]],
    body: liabilitiesBody,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 138 },
      1: { cellWidth: 44, halign: "right" },
    },
  });

  const liabilitiesEndY = (doc as any).lastAutoTable.finalY;

  // Render Assets Table
  autoTable(doc, {
    startY: liabilitiesEndY + 6,
    head: [["Assets & Resources", "Amount (Rs.)"]],
    body: assetsBody,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 138 },
      1: { cellWidth: 44, halign: "right" },
    },
  });

  // Attach Detail Schedules
  let currentY = (doc as any).lastAutoTable.finalY + 8;
  const appendBSList = (title: string, items: DrillItem[]) => {
    if (!items || items.length === 0) return;
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(title, 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [["Item / Account", "Date / Ref", "Party Name", "Amount (Rs.)"]],
      body: items.map((i) => [i.doc_number || "-", fmtDate(i.date), i.party_name || i.description || "-", pdfINR(i.amount)]),
      foot: [["Total", "", `${items.length} items`, pdfINR(items.reduce((s, r) => s + (r.amount || 0), 0))]],
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 26 },
        2: { cellWidth: 80 },
        3: { cellWidth: 34, halign: "right" },
      },
      tableWidth: 182,
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  };

  if (data.drill_records?.receivables?.length > 0) {
    appendBSList("Schedule: Trade Receivables Outstanding Ledger", data.drill_records.receivables);
  }
  if (data.drill_records?.payables?.length > 0) {
    appendBSList("Schedule: Trade Payables Outstanding Ledger", data.drill_records.payables);
  }
  if (data.drill_records?.bank_accounts?.length > 0) {
    appendBSList("Schedule: Active Bank Accounts & Liquid Funds", data.drill_records.bank_accounts);
  }

  addDocumentFooter(doc);
  const fname = `Balance_Sheet_${options.asOn || "Report"}.pdf`;
  doc.save(fname);
}

// ——————————————————————————————————————————————————————————————————

export function exportGSTSummaryPDF(
  data: any,
  options: ReportPDFOptions
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  addDocumentHeader(doc, "GST Summary & Tax Liability Report", options);

  // Summary Table
  const isPayable = data.summary.net_payable.direction === "payable";
  const summaryBody: any[] = [
    ["Output GST on Sales (Total)", pdfINR(data.summary.output_gst.total), pdfINR(data.summary.output_gst.cgst), pdfINR(data.summary.output_gst.sgst), pdfINR(data.summary.output_gst.igst)],
    ["Add: RCM Liability", pdfINR(data.summary.rcm_gst.total), pdfINR(data.summary.rcm_gst.cgst), pdfINR(data.summary.rcm_gst.sgst), pdfINR(data.summary.rcm_gst.igst)],
    ["Less: Eligible Input Tax Credit (ITC)", `(${pdfINR(data.summary.input_gst.total)})`, `(${pdfINR(data.summary.input_gst.cgst)})`, `(${pdfINR(data.summary.input_gst.sgst)})`, `(${pdfINR(data.summary.input_gst.igst)})`],
    [
      { content: isPayable ? "NET GST PAYABLE" : "NET ITC CREDIT BALANCE", styles: { fontStyle: "bold" } },
      { content: pdfINR(Math.abs(data.summary.net_payable.total)), styles: { fontStyle: "bold", textColor: isPayable ? [159, 18, 57] : [22, 101, 52] } },
      { content: pdfINR(data.summary.net_payable.cgst), styles: { fontStyle: "bold" } },
      { content: pdfINR(data.summary.net_payable.sgst), styles: { fontStyle: "bold" } },
      { content: pdfINR(data.summary.net_payable.igst), styles: { fontStyle: "bold" } },
    ],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Tax Head / Particulars", "Total Tax (Rs.)", "CGST (Rs.)", "SGST (Rs.)", "IGST (Rs.)"]],
    body: summaryBody,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
  });

  // Outward Supplies Table
  let currentY = (doc as any).lastAutoTable.finalY + 8;
  if (data.output_gst?.rows?.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text("Outward Supplies Register (Pakka GST Sales)", 14, currentY);
    currentY += 4;

    const outRows = data.output_gst.rows.map((r: any) => [
      r.doc_number,
      fmtDate(r.date),
      r.party_name,
      r.gstin || "Unregistered",
      pdfINR(r.taxable_value),
      pdfINR(r.cgst),
      pdfINR(r.sgst),
      pdfINR(r.igst),
      pdfINR(r.total_gst),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Invoice No.", "Date", "Customer", "GSTIN", "Taxable (Rs.)", "CGST (Rs.)", "SGST (Rs.)", "IGST (Rs.)", "Total GST (Rs.)"]],
      body: outRows,
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  addDocumentFooter(doc);
  const fname = `GST_Summary_${options.from || ""}_${options.to || ""}.pdf`;
  doc.save(fname);
}

// ——————————————————————————————————————————————————————————————————

export function exportCashFlowPDF(
  data: any,
  options: ReportPDFOptions
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  addDocumentHeader(doc, "Cash Flow Statement", options);

  const cfBody: any[] = [
    [{ content: "OPENING CASH & BANK BALANCE", styles: { fontStyle: "bold" } }, { content: pdfINR(data.opening_balance), styles: { fontStyle: "bold", halign: "right" } }],
    [{ content: "1. CASH & BANK INFLOWS (COLLECTIONS)", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 253, 244], textColor: [22, 101, 52] } }],
    ["    Customer Receipts (Sales Collections)", pdfINR(data.inflows.customer_receipts)],
    ["    Direct Deposits & Misc Receipts", pdfINR(data.inflows.misc_income)],
    [{ content: "TOTAL CASH INFLOWS (A)", styles: { fontStyle: "bold" } }, { content: pdfINR(data.inflows.total), styles: { fontStyle: "bold", halign: "right", textColor: [22, 101, 52] } }],
    [{ content: "2. CASH & BANK OUTFLOWS (DISBURSEMENTS)", colSpan: 2, styles: { fontStyle: "bold", fillColor: [255, 241, 242], textColor: [159, 18, 57] } }],
    ["    Supplier Payments (Raw Materials & FG)", pdfINR(data.outflows.supplier_payments)],
    ["    Worker Stage Labor Payouts", pdfINR(data.outflows.worker_payments)],
    ["    Operating Expense Payments & Rent", pdfINR(data.outflows.expense_payments)],
    [{ content: "TOTAL CASH OUTFLOWS (B)", styles: { fontStyle: "bold" } }, { content: pdfINR(data.outflows.total), styles: { fontStyle: "bold", halign: "right", textColor: [159, 18, 57] } }],
    [{ content: "NET CASH FLOW (A - B)", styles: { fontStyle: "bold" } }, { content: pdfINR(data.net_cash_flow), styles: { fontStyle: "bold", halign: "right", textColor: data.net_cash_flow >= 0 ? [22, 101, 52] : [159, 18, 57] } }],
    [
      { content: "CLOSING CASH & BANK BALANCE", styles: { fontStyle: "bold", fontSize: 10, fillColor: [238, 242, 255], textColor: [67, 56, 202] } },
      { content: pdfINR(data.closing_balance), styles: { fontStyle: "bold", fontSize: 10, halign: "right", fillColor: [238, 242, 255], textColor: [67, 56, 202] } },
    ],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Cash Flow Movement Particulars", "Amount (Rs.)"]],
    body: cfBody,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 135 },
      1: { cellWidth: 47, halign: "right" },
    },
  });

  addDocumentFooter(doc);
  const fname = `CashFlow_Statement_${options.from || ""}_${options.to || ""}.pdf`;
  doc.save(fname);
}

// ——————————————————————————————————————————————————————————————————

export function exportSingleLedgerPDF(
  title: string,
  items: DrillItem[],
  options: ReportPDFOptions
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  addDocumentHeader(doc, title, options);

  const rows = items.map((r) => [
    r.doc_number,
    fmtDate(r.date),
    r.party_name || "-",
    r.category || r.description || "-",
    pdfINR(r.amount),
  ]);

  const totalSum = items.reduce((acc, i) => acc + (i.amount || 0), 0);

  autoTable(doc, {
    startY: 32,
    head: [["Doc / Invoice No.", "Date", "Party Name", "Category / Description", "Amount (Rs.)"]],
    body: rows,
    foot: [["Total", "", "", `${items.length} records`, pdfINR(totalSum)]],
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 24 },
      2: { cellWidth: 62 },
      3: { cellWidth: 34 },
      4: { cellWidth: 28, halign: "right" },
    },
    tableWidth: 182,
  });

  addDocumentFooter(doc);
  const sanitized = title.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`${sanitized}_Schedule.pdf`);
}


