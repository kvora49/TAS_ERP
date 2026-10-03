"use client";
import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store";
import PurchaseSourceCorrection from "./PurchaseSourceCorrection";
import PageState from "@/components/shared/PageState";
import { useReportQuery } from "@/hooks/useReportQuery";
import ReportTable from "./ReportTable";
import { fmtDate, fmtNum } from "@/lib/report-export";

export default function ReportExceptions({ from, to }: { from: string; to: string }) {
  const role=useAppStore(s=>s.user?.role);
  const [sourceId,setSourceId]=useState<string|null>(null);
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error, refetch } = useReportQuery({
    queryKey: ["report-exceptions", from, to], enabled: expanded,
    queryFn: async () => { const result = await fetch(`/api/reports/exceptions?${new URLSearchParams({ from, to })}`); if (!result.ok) throw new Error("Unable to load exceptions"); return result.json(); },
  });
  return <section className="min-w-0 border border-[var(--border)] rounded-xl p-3 space-y-3">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="min-h-11 text-sm font-semibold text-[var(--text-primary)]">Report exception centre {expanded ? '−' : '+'}</button>
    {expanded && <PageState isLoading={isLoading} isError={!!error} error={error?.message} onRetry={refetch} isEmpty={false} skeletonVariant="table" skeletonRows={5} skeletonColumns={7}>
      {data && <><p className="text-xs text-[var(--text-muted)]">{data.basis}</p>
        <div className="flex flex-wrap gap-3 text-xs">{Object.entries(data.counts).map(([kind, count]) => <span key={kind}>{kind.replaceAll('_', ' ')}: {String(count)}</span>)}</div>
        <p className="text-xs text-[var(--text-muted)]">Showing {data.rows.length} of {data.total} exceptions.{data.truncated ? ' Open the linked source reports for full detail.' : ''}</p>
        <ReportTable className="w-full text-xs"><thead><tr>{['Exception', 'Document', 'Date', 'Value / quantity', 'Basis', 'Reason', 'Source'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {data.rows.map((row: any) => <tr key={`${row.kind}:${row.id}`}><td>{row.kind.replaceAll('_', ' ')}</td><td>{row.document}</td><td>{fmtDate(row.date)}</td><td>{fmtNum(row.amount)}</td><td>{row.basis.replaceAll('_', ' ')}</td><td>{row.reason}</td><td><Link className="text-[var(--primary)]" href={row.href}>Open source</Link>{row.kind==="unclassified_purchase"&&["owner","admin","accountant"].includes(role||"")&&<button className="block min-h-11 text-[var(--primary)]" onClick={()=>setSourceId(row.id)}>Complete invoice fields</button>}</td></tr>)}
        </tbody></ReportTable>
        {!data.total && <p className="text-xs text-[var(--text-muted)]">No exceptions found in the covered sources. This does not certify complete accounts.</p>}
      </>}
    </PageState>}
    <PurchaseSourceCorrection id={sourceId} onClose={()=>setSourceId(null)}/>
  </section>;
}
