"use client";

import { WorkerForm } from "@/components/forms/WorkerForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function NewWorkerPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 select-none">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <Link href="/master-data/workers" className="hover:text-[var(--primary)] transition-colors">
          Workers
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-primary)]">Register Worker</span>
      </nav>

      {/* Form Container */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-6 shadow-[var(--shadow-sm)]">
        <WorkerForm />
      </div>
    </div>
  );
}
