"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  BookOpen,
  UserCheck,
  Building2,
  Phone,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import WorkerAvatar from "@/components/shared/WorkerAvatar";

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  phone?: string | null;
  type: string;
  stage_specialty?: string[] | null;
}

export default function JobWorkLedgerSelectorPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: workersData, isLoading } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-list-job-workers"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      return res.json();
    },
  });

  const workers = workersData?.workers || [];

  // Filter only job workers and match search query
  const jobWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.worker_id.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#64748B] select-none">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Job Work</span>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Ledger Selection</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <BookOpen className="text-[#6366F1]" size={22} />
            <span>Job Worker Ledgers</span>
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Select a job worker or subcontractor to view their transactional ledger, credit history, and outstanding balances.
          </p>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={15} />
          <input
            type="text"
            placeholder="Search by worker name, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 bg-white border border-[#E5E7EB] rounded-lg text-xs focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] outline-none font-medium"
          />
        </div>
      </div>

      {/* Workers Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading workers...</p>
        </div>
      ) : jobWorkers.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center shadow-sm">
          <UserCheck className="mx-auto text-slate-300 h-10 w-10 mb-2" />
          <p className="text-sm font-semibold text-slate-800">No Job Workers Found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Create workers in Master Data first or adjust your search filter to select a worker.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobWorkers.map((worker) => (
            <div
              key={worker.id}
              onClick={() => router.push(`/production/job-work/ledger/${worker.id}`)}
              className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:border-[#6366F1] hover:shadow-md transition-all cursor-pointer flex gap-4 items-start group relative overflow-hidden"
            >
              {/* Highlight bar on hover */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6366F1] opacity-0 group-hover:opacity-100 transition-opacity" />

              <WorkerAvatar name={worker.name} className="h-10 w-10 shrink-0" />
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-xs text-slate-800 truncate group-hover:text-[#6366F1] transition-colors">
                    {worker.name}
                  </h4>
                  <span className="font-mono text-[9px] font-bold text-[#6366F1] bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 shrink-0 uppercase tracking-wider">
                    {worker.worker_id}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-500 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} className="text-slate-400" />
                    <span className="capitalize">{worker.type.replace("_", " ")}</span>
                  </div>
                  {worker.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={11} className="text-slate-400" />
                      <span>{worker.phone}</span>
                    </div>
                  )}
                </div>

                {worker.stage_specialty && worker.stage_specialty.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {worker.stage_specialty.slice(0, 3).map((spec, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 capitalize"
                      >
                        {spec.replace("_", " ")}
                      </span>
                    ))}
                    {worker.stage_specialty.length > 3 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
                        +{worker.stage_specialty.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
