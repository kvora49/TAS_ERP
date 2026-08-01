"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommunicationSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reminders");
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-[var(--text-muted)]">
      Redirecting to Reminders &amp; WhatsApp...
    </div>
  );
}
