"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { exportToExcel } from "@/lib/report-export";
import { flushSync } from "react-dom";
import AsyncButton from "@/components/shared/AsyncButton";
import { exportRegisterPDF } from "@/lib/report-register-export";

function children(node: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    return child.type === React.Fragment ? children(child.props.children) : [child];
  });
}
function text(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!React.isValidElement<{ children?: React.ReactNode; value?: unknown; defaultValue?: unknown }>(node)) return "";
  if (node.type === "input" || node.type === "select") return String(node.props.value ?? node.props.defaultValue ?? "");
  return text(node.props.children);
}

/** A complete register, with the same cells and actions on desktop and in the PWA. */
export default function ReportTable({ children: content, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  const pathname = usePathname();
  const uid = useId();
  const company = useAppStore(s => s.selectedBusinessId || s.user?.businessId);
  const user = useAppStore(s => s.user?.id);
  const parts = children(content);
  const head = parts.find(p => p.type === "thead");
  const body = parts.find(p => p.type === "tbody");
  const foot = parts.find(p => p.type === "tfoot");
  const headRows = children(head?.props.children);
  const headers = children(headRows.at(-1)?.props.children);
  const labels = headers.map(h => text(h.props.children).trim());
  const rows = children(body?.props.children);
  const supported = !!body && rows.every(row => row.type === "tr") && headRows.length === 1 && headers.every(h => !h.props.colSpan && !h.props.rowSpan);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ column: number; direction: number } | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [dense, setDense] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [group, setGroup] = useState(-1);
  const [pinned, setPinned] = useState<number | null>(null);
  const [widths, setWidths] = useState<Record<number, number>>({});
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  const storageKey = `report-columns:${user}:${company}:${pathname}:${labels.join("|")}`;
  useEffect(() => {
    setHidden([]); setDense(false);
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (value && Array.isArray(value.hidden)) setHidden(value.hidden.filter((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < labels.length).slice(0, Math.max(0, labels.length - 1)));
      if (value) setDense(value.dense === true);
      setPinned(Number.isInteger(value?.pinned) && value.pinned >= 0 && value.pinned < labels.length ? value.pinned : null);
      setWidths(value?.widths && typeof value.widths === "object" ? Object.fromEntries(Object.entries(value.widths).filter(([k, v]) => Number(k) >= 0 && Number(k) < labels.length && typeof v === "number" && v >= 80 && v <= 500)) as Record<number, number> : {});
    } catch { /* Invalid preferences do not prevent report access. */ }
  }, [storageKey, labels.length]);
  const indexed = useMemo(() => rows.map((row, index) => ({ row, index, values: children(row.props.children).map(cell => text(cell.props.children)) })), [body]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const result = indexed.filter(r => !query || r.values.join(" ").toLocaleLowerCase().includes(query));
    if (sort) result.sort((a, b) => {
      const av = a.values[sort.column] || "", bv = b.values[sort.column] || "";
      const number = (v: string) => /^[-₹\s\d,.%]+$/.test(v) ? Number(v.replace(/[₹\s,%]/g, "")) : NaN;
      const an = number(av), bn = number(bv);
      const compare = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : av.localeCompare(bv, "en", { numeric: true });
      return compare * sort.direction || a.index - b.index;
    });
    return result;
  }, [indexed, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = printing ? filtered : filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const savePreference = (nextHidden: number[], nextDense: boolean, nextPinned = pinned, nextWidths = widths) => {
    setHidden(nextHidden); setDense(nextDense); setPinned(nextPinned); setWidths(nextWidths);
    try { localStorage.setItem(storageKey, JSON.stringify({ hidden: nextHidden, dense: nextDense, pinned: nextPinned, widths: nextWidths })); } catch { /* Storage may be disabled. */ }
  };
  if (!supported) return <table {...props}>{content}</table>;
  const decorateRow = (row: React.ReactElement, index: number) => React.cloneElement(row, { key: row.key ?? index }, children(row.props.children).map((cell, col) => {
    const spanning = Number(cell.props.colSpan || 1) > 1;
    return React.cloneElement(cell, {
      key: cell.key ?? col,
      "data-column-label": labels[col] || "Details",
      className: `${cell.props.className || ""}${!spanning && hidden.includes(col) ? " report-column-hidden" : ""}${!spanning && pinned === col ? " report-column-pinned" : ""}`,
      style: { ...cell.props.style, ...(!spanning && widths[col] ? { minWidth: widths[col], width: widths[col] } : {}) },
    });
  }));
  return <div className={`report-register min-w-0 w-full ${dense ? "report-register-dense" : ""}`}>
    <div className="report-table-tools flex flex-wrap items-center gap-2 p-3 border-b border-[var(--border)] print:hidden">
      <input aria-label="Search all register rows" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search this register…" className="min-w-0 w-full sm:flex-1 sm:w-auto rounded-lg px-3 h-11 text-sm bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]" />
      <button type="button" onClick={() => setShowColumns(v => !v)} aria-expanded={showColumns} className="h-11 px-3 border border-[var(--border)] rounded-lg text-xs text-[var(--text-body)]">Columns</button>
      <button type="button" onClick={() => savePreference(hidden, !dense)} aria-pressed={dense} className="h-11 px-3 border border-[var(--border)] rounded-lg text-xs text-[var(--text-body)]">{dense ? "Comfortable" : "Compact"}</button>
      <select aria-label="Group register rows" value={group} onChange={e => { setGroup(Number(e.target.value)); setPage(0); }} className="h-11 max-w-full rounded-lg px-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-xs"><option value={-1}>No grouping</option>{labels.map((label, i) => <option key={i} value={i}>Group: {label || "Actions"}</option>)}</select>
      <AsyncButton variant="outline" onClick={() => exportToExcel(labels.map((label, i) => ({ key: String(i), label, width: 24 })), filtered.map(r => Object.fromEntries(r.values.map((v, i) => [String(i), /amount|value|quantity|qty|paid|balance|outstanding|cost|total|rate|gst/i.test(labels[i]) && /^[-₹\s\d,.%]+$/.test(v) ? Number(v.replace(/[₹\s,%]/g, "")) : v]))), "report_register")} className="h-11 px-3 rounded-lg text-xs">Excel · {filtered.length} rows</AsyncButton>
      <AsyncButton variant="outline" onClick={() => exportRegisterPDF(labels, filtered.map(r => r.values), pathname, window.location.search)} className="h-11 px-3 rounded-lg text-xs">PDF · {filtered.length} rows</AsyncButton>
    </div>
    {showColumns && <fieldset className="flex flex-wrap gap-3 p-3 border-b border-[var(--border)] text-xs print:hidden"><legend className="sr-only">Visible columns, saved for this company</legend>{labels.map((label, col) => <div key={col} className="flex flex-wrap items-center gap-2 min-h-11 text-[var(--text-body)]"><label className="flex items-center gap-2"><input type="checkbox" checked={!hidden.includes(col)} disabled={!hidden.includes(col) && hidden.length === labels.length - 1} onChange={() => savePreference(hidden.includes(col) ? hidden.filter(n => n !== col) : [...hidden, col], dense)} />{label || "Actions"}</label><button type="button" aria-pressed={pinned === col} onClick={() => savePreference(hidden, dense, pinned === col ? null : col)} className="min-h-11 px-2 border border-[var(--border)] rounded-lg">{pinned === col ? "Unpin" : "Pin"}</button><input type="number" min={80} max={500} step={20} value={widths[col] || 160} aria-label={`Width of ${label} in pixels`} onChange={e => savePreference(hidden, dense, pinned, { ...widths, [col]: Math.min(500, Math.max(80, Number(e.target.value))) })} className="w-20 h-11 px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)]" /></div>)}</fieldset>}
    <table {...props} id={props.id ?? uid}>
      {React.cloneElement(head!, {}, React.cloneElement(headRows[0], {}, headers.map((header, col) => React.cloneElement(header, {
        key: header.key ?? col,
        "aria-sort": sort?.column === col ? (sort.direction === 1 ? "ascending" : "descending") : "none",
        className: `${header.props.className || ""}${hidden.includes(col) ? " report-column-hidden" : ""}${pinned === col ? " report-column-pinned" : ""}`,
        style: { ...header.props.style, ...(widths[col] ? { minWidth: widths[col], width: widths[col] } : {}) },
      }, <button type="button" onClick={() => { setSort({ column: col, direction: sort?.column === col ? -sort.direction : 1 }); setPage(0); }} className="text-inherit font-inherit text-left min-h-8">{header.props.children}{sort?.column === col ? sort.direction === 1 ? " ↑" : " ↓" : ""}</button>))))}
      {React.cloneElement(body!, {}, group < 0 ? visible.map(({ row, index }) => decorateRow(row, index)) : Array.from(new Set(visible.map(r => r.values[group] || "Unassigned"))).flatMap(name => {
        const members = filtered.filter(r => (r.values[group] || "Unassigned") === name);
        const amounts = labels.flatMap((label, col) => /amount|value|paid|balance|outstanding|cost|total/i.test(label) && members.every(r => /^[-₹\s\d,.]+$/.test(r.values[col] || "")) ? [`${label}: ${members.reduce((s, r) => s + Number(r.values[col].replace(/[₹\s,]/g, "")), 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`] : []);
        return [<tr key={`group:${name}`}><td colSpan={labels.length} data-column-label="Group subtotal" className="p-3 font-semibold bg-[var(--table-header-bg)]">{name} · {members.length} rows across all pages{amounts.length ? ` · ${amounts.join(" · ")}` : ""}</td></tr>, ...visible.filter(r => (r.values[group] || "Unassigned") === name).map(({ row, index }) => decorateRow(row, index))];
      }), !visible.length && <tr><td colSpan={Math.max(1, labels.length)} className="p-4 text-[var(--text-muted)]">No matching records.</td></tr>)}
      {foot && React.cloneElement(foot, {}, children(foot.props.children).map(decorateRow))}
    </table>
    <div className="report-table-tools flex flex-wrap justify-between items-center gap-2 p-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] print:hidden">
      <span>{filtered.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length} rows{search ? ` (${rows.length} total)` : ""}. Totals cover the full report.</span>
      <div className="flex items-center flex-wrap gap-2">
        <select aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-11 rounded-lg px-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]">{[25, 50, 100].map(n => <option key={n} value={n}>{n} rows</option>)}</select>
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="h-11 px-3 border border-[var(--border)] rounded-lg disabled:opacity-40">Previous</button>
        <span>{currentPage + 1}/{pages}</span>
        <button type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)} className="h-11 px-3 border border-[var(--border)] rounded-lg disabled:opacity-40">Next</button>
      </div>
    </div>
  </div>;
}
