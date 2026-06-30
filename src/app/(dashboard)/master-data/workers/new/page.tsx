"use client";

import { WorkerForm } from "@/components/forms/WorkerForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function NewWorkerPage() {
  return (
    <div className="p-6 space-y-6 select-none">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/master-data/workers" className="hover:text-[#6366F1] transition-colors">
          Workers
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Register Worker</span>
      </nav>

      {/* Form Container */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
        <WorkerForm />
      </div>
    </div>
  );
}
