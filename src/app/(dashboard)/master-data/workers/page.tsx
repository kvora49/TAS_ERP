"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parties?type=worker");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 select-none">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Redirecting to Workers...</p>
      </div>
    </div>
  );
}
