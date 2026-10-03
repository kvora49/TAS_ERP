"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import ReportSubscriptions from "./ReportSubscriptions";
import AsyncButton from "@/components/shared/AsyncButton";
import { useReportQuery } from "@/hooks/useReportQuery";

type View = { name: string; href: string; favourite?: boolean };
export default function ReportWorkspace({ title, hub = false }: { title: string; hub?: boolean }) {
  const user = useAppStore(s => s.user?.id);
  const company = useAppStore(s => s.selectedBusinessId || s.user?.businessId);
  const key = `report-workspace:${user}:${company}`;
  const [views, setViews] = useState<View[]>([]);
  const [recent, setRecent] = useState<View[]>([]);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState(hub);
  const [syncState, setSyncState] = useState("Loading saved views…");
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const cloud = useReportQuery<{ preferences: { views?: View[]; recent?: View[] } | null }>({
    queryKey: ["report-preferences"],
    enabled: !!user && !!company,
    queryFn: async () => {
      const response = await fetch("/api/reports/preferences", { headers: { "x-report-business-id": company || "" } });
      if (!response.ok) throw new Error("Unable to sync saved views");
      return response.json();
    },
  });
  useEffect(() => {
    revision.current++;
    setViews([]); setRecent([]);
    if (!user || !company) return;
    setSyncState("Loading saved views…");
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      const safe = (items: unknown): View[] => Array.isArray(items) ? items.filter(v => v && typeof v.name === "string" && typeof v.href === "string" && /^\/reports(?:\/|\?|$)/.test(v.href) && !v.href.includes("\\")).slice(0, 30) : [];
      setViews(safe(stored.views));
      const history = safe(stored.recent);
      const current = { name: title, href: window.location.pathname + window.location.search };
      const nextRecent = hub ? history : [current, ...history.filter(v => v.href !== current.href)].slice(0, 8);
      setRecent(nextRecent);
      localStorage.setItem(key, JSON.stringify({ views: safe(stored.views), recent: nextRecent }));
    } catch { setViews([]); setRecent([]); }
    if (cloud.data?.preferences) {
        const stored = cloud.data.preferences;
        setViews(stored.views || []);
        const current = { name: title, href: window.location.pathname + window.location.search };
        const history: View[] = stored.recent || [];
        const nextRecent = hub ? history : [current, ...history.filter(v => v.href !== current.href)].slice(0, 8);
        setRecent(nextRecent);
        localStorage.setItem(key, JSON.stringify({ views: stored.views || [], recent: nextRecent }));
    }
    if (cloud.isSuccess) {
      setSyncState("Views sync privately across your devices when saved.");
    } else if (cloud.isError) {
      setSyncState("Device storage only: cloud sync is unavailable.");
    }
  }, [key, title, hub, user, company, cloud.data, cloud.isSuccess, cloud.isError]);
  const persist = (next: View[]) => {
    revision.current++;
    setViews(next);
    try { localStorage.setItem(key, JSON.stringify({ views: next, recent })); } catch { toast.error("Browser storage is unavailable"); }
    if (!company) return;
    const scopeRevision = revision.current;
    writes.current = writes.current.catch(() => {}).then(async () => {
      const response = await fetch("/api/reports/preferences", { method: "PUT", headers: { "Content-Type": "application/json", "x-report-business-id": company }, body: JSON.stringify({ views: next, recent }) });
      if (!response.ok) throw new Error("Cloud sync failed");
    });
    return writes.current.then(() => { if (revision.current === scopeRevision) setSyncState("Saved privately to your company workspace."); }).catch(() => { if (revision.current === scopeRevision) { setSyncState("Saved on this device; cloud sync failed."); toast.error("Saved on this device; cloud sync failed"); } });
  };
  const apply = (href: string) => {
    const url = new URL(href, window.location.origin);
    if (url.pathname === window.location.pathname) {
      window.history.pushState(window.history.state, "", url);
      window.dispatchEvent(new Event("report-url-change"));
    } else window.location.assign(href);
  };
  return <div className="min-w-0 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-[var(--text-body)] print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="min-h-11 text-xs font-semibold">{hub ? "Your report workspace" : "Saved views & report link"} {expanded ? "−" : "+"}</button>
      {!hub && <AsyncButton variant="ghost" type="button" className="min-h-11 px-3 text-xs text-[var(--primary)]" onClick={async () => {
        try { await navigator.clipboard.writeText(window.location.href); toast.success("Report link copied. Company access is still required."); } catch { toast.error("Could not copy the link"); }
      }}>Copy filtered link</AsyncButton>}
    </div>
    {expanded && <div className="p-3 pt-0 space-y-3">
      {!hub && <form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; const href = window.location.pathname + window.location.search; persist([{ name: name.trim().slice(0, 80), href }, ...views.filter(v => v.name !== name.trim())].slice(0, 30)); setName(""); toast.success("View saved for this company on this device"); }} className="flex flex-wrap gap-2">
        <input aria-label="Saved view name" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Overdue customers" className="w-full sm:flex-1 sm:w-auto min-w-0 h-11 px-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-sm" />
        <button type="submit" disabled={!name.trim()} className="h-11 px-3 rounded-lg border border-[var(--border)] text-xs disabled:opacity-40">Save current filters</button>
      </form>}
      <p className="text-xs text-[var(--text-muted)]">{syncState} Shared links require normal company access.</p>
      <div className="flex flex-wrap gap-2">{[...views].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite)).map((view, i) => <div key={`${view.name}:${i}`} className="flex items-center max-w-full gap-1 rounded-lg border border-[var(--border)] px-2 text-xs">
        <button type="button" aria-label={`${view.favourite ? "Unfavourite" : "Favourite"} ${view.name}`} className="min-h-11 px-2 text-[var(--primary)]" onClick={() => persist(views.map(v => v === view ? { ...v, favourite: !v.favourite } : v))}>{view.favourite ? "★" : "☆"}</button>
        <button type="button" className="min-h-11 py-2 break-words text-left" onClick={() => apply(view.href)}>{view.name}</button>
        <button type="button" aria-label={`Remove saved view ${view.name}`} className="min-h-11 px-2 text-[var(--text-muted)]" onClick={() => persist(views.filter(v => v !== view))}>×</button>
      </div>)}{!views.length && <span className="text-xs text-[var(--text-muted)]">No saved views yet.</span>}</div>
      {(hub || title === "Analysis") && <ReportSubscriptions />}
      {hub && recent.length > 0 && <div><p className="text-xs font-semibold mb-2">Recent reports</p><div className="flex flex-wrap gap-2">{recent.map(v => <Link key={v.href} href={v.href} className="min-h-11 flex items-center px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--primary)]">{v.name}</Link>)}</div></div>}
    </div>}
  </div>;
}
