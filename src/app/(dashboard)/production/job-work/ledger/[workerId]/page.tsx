"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface WorkerLedgerRedirectProps {
  params: { workerId: string };
}

export default function WorkerLedgerRedirectPage({ params }: WorkerLedgerRedirectProps) {
  const router = useRouter();
  const { workerId } = params;

  useEffect(() => {
    router.replace(`/production/job-work?tab=ledger&worker_id=${workerId}`);
  }, [router, workerId]);

  return (
    <div className="py-20 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
      <p className="text-xs text-slate-500 mt-2 font-medium">Redirecting to Worker Statement...</p>
    </div>
  );
}
