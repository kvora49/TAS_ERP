"use client";

import { WorkerForm } from "@/components/forms/WorkerForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function EditWorkerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch worker details");
      return res.json();
    },
  });

  const worker = data?.worker || null;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading worker details...</span>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load worker</span>
        <Link href="/master-data/workers" className="text-xs text-[#6366F1] hover:underline">
          Back to Workers List
        </Link>
      </div>
    );
  }

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
        <Link href={`/master-data/workers/${id}`} className="hover:text-[#6366F1] transition-colors">
          {worker.name}
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Edit Profile</span>
      </nav>

      {/* Form Container */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
        <WorkerForm initialData={worker} id={id} />
      </div>
    </div>
  );
}
