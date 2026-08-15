"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { safeSheetToJson } from "@/lib/report-export";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type EntityType = "parties" | "designs" | "raw_materials" | "opening_balances";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

const ENTITY_FIELDS: Record<EntityType, FieldDef[]> = {
  parties: [
    { key: "name", label: "Party Name", required: true, aliases: ["party name", "name", "customer name", "supplier name", "party"] },
    { key: "company_name", label: "Company Name", required: false, aliases: ["company", "company name", "firm name", "business name"] },
    { key: "phone", label: "Mobile / Phone", required: false, aliases: ["mobile", "phone", "contact", "mobile no", "phone no"] },
    { key: "gstin", label: "GSTIN / Tax ID", required: false, aliases: ["gstin", "gst no", "gst", "tax id"] },
    { key: "type", label: "Party Type (customer/supplier/worker)", required: false, aliases: ["type", "party type", "category"] },
    { key: "address", label: "Billing Address", required: false, aliases: ["address", "billing address", "city", "state"] },
    { key: "opening_balance", label: "Opening Balance (₹)", required: false, aliases: ["opening balance", "balance", "op bal"] },
  ],
  designs: [
    { key: "design_number", label: "Design Code / Number", required: true, aliases: ["design code", "design number", "code", "style no", "design no"] },
    { key: "name", label: "Design Name", required: true, aliases: ["design name", "name", "style name", "description"] },
    { key: "category", label: "Category", required: false, aliases: ["category", "cat", "type"] },
  ],
  raw_materials: [
    { key: "name", label: "Material Name", required: true, aliases: ["item name", "material name", "fabric name", "item"] },
    { key: "category", label: "Category", required: false, aliases: ["category", "type"] },
    { key: "unit", label: "Unit (meters/kg/pcs)", required: false, aliases: ["unit", "uom"] },
  ],
  opening_balances: [
    { key: "name", label: "Party Name", required: true, aliases: ["party name", "name", "party"] },
    { key: "opening_balance", label: "Opening Balance Amount", required: true, aliases: ["amount", "opening balance", "balance"] },
  ],
};

export default function BulkImportPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [entityType, setEntityType] = useState<EntityType>("parties");
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({}); // targetKey -> excelHeader
  const [skipErrors, setSkipErrors] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultStats, setResultStats] = useState<any>(null);
  const [resultReport, setResultReport] = useState<any[]>([]);

  // Step 1: File Upload & Auto Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (uploadedFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds maximum limit of 10MB");
      return;
    }

    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (!data || data.length < 2) {
          toast.error("Spreadsheet is empty or missing data rows");
          return;
        }

        const headers = data[0].map((h: any) => String(h || "").trim()).filter((h: string) => h !== "__proto__" && h !== "constructor" && h !== "prototype");
        const rows = safeSheetToJson<any>(ws);

        setRawHeaders(headers);
        setParsedRows(rows);

        // Auto-Map Fuzzy Matching
        const fields = ENTITY_FIELDS[entityType];
        const autoMap: Record<string, string> = {};

        fields.forEach((field) => {
          const matchedHeader = headers.find((h: string) => {
            const lowerH = String(h || "").toLowerCase();
            return field.aliases.some((alias) => lowerH.includes(alias));
          });
          if (matchedHeader) {
            autoMap[field.key] = matchedHeader;
          }
        });

        setColumnMap(autoMap);
        setStep(2);
        toast.success(`Loaded ${rows.length} rows from file!`);
      } catch (err: any) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  // Process Mapped Data for Preview
  const getMappedRows = () => {
    return parsedRows.map((row) => {
      const mapped: any = {};
      Object.entries(columnMap).forEach(([targetKey, header]) => {
        if (header && row[header] !== undefined) {
          mapped[targetKey] = row[header];
        }
      });
      return mapped;
    });
  };

  // Step 3: Run Validation Check
  const validateMappedData = () => {
    const fields = ENTITY_FIELDS[entityType];
    const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
    const missing = requiredKeys.filter((k) => !columnMap[k]);

    if (missing.length > 0) {
      toast.error(`Please map required column(s): ${missing.join(", ")}`);
      return;
    }

    setStep(3);
  };

  // Step 4: Execute Chunked Bulk Import
  const handleExecuteImport = async () => {
    setIsImporting(true);
    setProgress(10);

    const mappedData = getMappedRows();
    try {
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          rows: mappedData,
          skipErrors,
        }),
      });

      setProgress(90);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Bulk import failed");
      }

      setProgress(100);
      setResultStats(data.stats);
      setResultReport(data.report || []);
      setStep(4);
      toast.success("Bulk import completed!");
    } catch (err: any) {
      toast.error("Import error: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Export Results as CSV
  const handleDownloadReport = () => {
    if (resultReport.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(resultReport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import_Report");
    XLSX.writeFile(wb, `Import_Report_${entityType}.xlsx`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[var(--primary)]" />
            Bulk Data Import Studio
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Import Parties, Designs, Raw Materials, & Opening Balances from Tally / Excel / CSV
          </p>
        </div>
      </div>

      {/* 4-Step Progress Indicator */}
      <div className="grid grid-cols-4 gap-2 border border-[var(--border)] bg-[var(--card-bg)] rounded-xl p-3 select-none">
        {[
          { num: 1, title: "1. Upload File" },
          { num: 2, title: "2. Map Columns" },
          { num: 3, title: "3. Validate Data" },
          { num: 4, title: "4. Results Report" },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              step === s.num
                ? "bg-[var(--primary)] text-white shadow-sm"
                : step > s.num
                ? "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                : "text-[var(--text-muted)] bg-[var(--page-bg)]"
            }`}
          >
            <span>{s.title}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: Upload File & Choose Entity */}
      {step === 1 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-6 shadow-xs">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">
              Select What You Want To Import
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "parties", label: "Parties (Customers/Suppliers)" },
                { id: "designs", label: "Master Designs" },
                { id: "raw_materials", label: "Raw Materials" },
                { id: "opening_balances", label: "Opening Balances" },
              ].map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => setEntityType(ent.id as EntityType)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    entityType === ent.id
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                      : "border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-primary)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  {ent.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center bg-[var(--page-bg)] hover:border-[var(--primary)] transition-colors cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Click or drag Excel / CSV file here to upload
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Supports .xlsx, .xls, .csv files up to 10MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping & Live Preview */}
      {step === 2 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Map Excel Columns to {entityType.toUpperCase()} Fields
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {parsedRows.length} rows loaded from {file?.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ENTITY_FIELDS[entityType].map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={columnMap[field.key] || ""}
                  onChange={(e) => setColumnMap({ ...columnMap, [field.key]: e.target.value })}
                  className="w-full h-9 px-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                >
                  <option value="">-- Do Not Import --</option>
                  {rawHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* 5 Row Live Preview */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Live Data Preview (First 5 Rows)
            </h3>
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--page-bg)] text-[var(--text-muted)] font-bold border-b border-[var(--border)]">
                  <tr>
                    {ENTITY_FIELDS[entityType].map((f) => (
                      <th key={f.key} className="p-2.5">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {getMappedRows()
                    .slice(0, 5)
                    .map((row, idx) => (
                      <tr key={idx}>
                        {ENTITY_FIELDS[entityType].map((f) => (
                          <td key={f.key} className="p-2.5">
                            {row[f.key] !== undefined ? String(row[f.key]) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={validateMappedData} className="bg-[var(--primary)] text-white">
              Next: Validate Data
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Validation Review & Start Import */}
      {step === 3 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-6 shadow-xs">
          <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3">
            Validation & Execution Setup
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] border border-green-200">
              <p className="text-xs font-bold uppercase tracking-wider">Total Rows</p>
              <p className="text-2xl font-extrabold mt-1">{parsedRows.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] border border-indigo-200">
              <p className="text-xs font-bold uppercase tracking-wider">Mapped Columns</p>
              <p className="text-2xl font-extrabold mt-1">{Object.keys(columnMap).length}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--page-bg)] text-[var(--text-primary)] border border-[var(--border)]">
              <p className="text-xs font-bold uppercase tracking-wider">Import Mode</p>
              <p className="text-sm font-bold mt-2">Upsert / Auto-Deduplicate</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-lg">
            <input
              type="checkbox"
              id="skip-errors"
              checked={skipErrors}
              onChange={(e) => setSkipErrors(e.target.checked)}
              className="w-4 h-4 text-[var(--primary)] rounded cursor-pointer"
            />
            <label htmlFor="skip-errors" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer">
              Skip invalid/errored rows and continue importing valid rows
            </label>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>Importing data chunks in progress...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--page-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
            <Button
              size="sm"
              disabled={isImporting}
              onClick={handleExecuteImport}
              className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Execute Bulk Import Now
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Import Results Report */}
      {step === 4 && resultStats && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2 text-green-600 font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              Bulk Import Finished!
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadReport} className="text-xs font-bold">
              <Download className="w-3.5 h-3.5 mr-1" />
              Download Excel Report
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[var(--page-bg)] text-[var(--text-primary)] border border-[var(--border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Processed</p>
              <p className="text-2xl font-extrabold mt-1">{resultStats.total}</p>
            </div>
            <div className="p-4 rounded-xl bg-green-50 text-green-700 border border-green-200">
              <p className="text-xs font-bold uppercase tracking-wider">Success</p>
              <p className="text-2xl font-extrabold mt-1">{resultStats.successCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <p className="text-xs font-bold uppercase tracking-wider">Warnings / Updated</p>
              <p className="text-2xl font-extrabold mt-1">{resultStats.warningCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200">
              <p className="text-xs font-bold uppercase tracking-wider">Errors</p>
              <p className="text-2xl font-extrabold mt-1">{resultStats.errorCount}</p>
            </div>
          </div>

          {/* Detailed Outcomes Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Row-by-Row Execution Log
            </h3>
            <div className="max-h-60 overflow-y-auto border border-[var(--border)] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--page-bg)] text-[var(--text-muted)] font-bold border-b border-[var(--border)] sticky top-0">
                  <tr>
                    <th className="p-2.5">Row #</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Message / Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {resultReport.map((rep, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-mono">Row #{rep.rowNumber}</td>
                      <td className="p-2.5 font-bold capitalize">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            rep.status === "success"
                              ? "bg-green-100 text-green-700"
                              : rep.status === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="p-2.5">{rep.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setStep(1);
                setFile(null);
                setParsedRows([]);
              }}
              className="bg-[var(--primary)] text-white text-xs font-bold"
            >
              Start Another Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
