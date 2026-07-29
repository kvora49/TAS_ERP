"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DebitNotesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parties");
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center text-sm font-semibold text-[var(--text-muted)]">
      Redirecting to Parties & Ledger Account...
    </div>
  );
}
