"use client";

import { WorkerForm } from "@/components/forms/WorkerForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";

export default function EditWorkerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch worker details");
      return res.json();
    },
  });

  const worker = data?.worker || null;

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
        {worker && (
          <>
            <Link href={`/master-data/workers/${id}`} className="hover:text-[var(--primary)] transition-colors">
              {worker.name}
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
          </>
        )}
        <span className="text-[var(--text-primary)]">Edit Profile</span>
      </nav>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error instanceof Error ? error.message : "Failed to load worker"}
        onRetry={refetch}
        isEmpty={!worker && !isLoading}
        emptyTitle="Worker Not Found"
        emptyDescription="The requested worker could not be found."
        skeletonVariant="form"
      >
        {worker && (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-6 shadow-[var(--shadow-sm)]">
            <WorkerForm initialData={worker} id={id} />
          </div>
        )}
      </PageState>
    </div>
  );
}
