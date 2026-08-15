import * as XLSX from "xlsx";

// ─── Excel Export ─────────────────────────────────────────────────────────────

export interface ExcelColumn {
  key: string;
  label: string;
  width?: number;
  format?: "currency" | "number" | "percent" | "date" | "text";
}

export function exportToExcel(
  columns: ExcelColumn[],
  rows: Record<string, any>[],
  filename: string,
  sheetName = "Report"
): void {
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

export function exportMultiSheetExcel(sheets: ExcelSheet[], filename: string): void {
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
export function safeSheetToJson<T = Record<string, any>>(ws: XLSX.WorkSheet, opts?: XLSX.Sheet2JSONOpts): T[] {
  const raw = XLSX.utils.sheet_to_json<any>(ws, opts);
  if (!Array.isArray(raw)) return [];

  return raw.map((row) => {
    if (typeof row !== "object" || row === null) return row;
    const safeObj: any = Object.create(null);
    for (const key of Object.keys(row)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      safeObj[key] = row[key];
    }
    return safeObj as T;
  });
}

