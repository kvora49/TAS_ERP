"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

export default function SalesDeliveryChallansPage() {
  const [billId, setBillId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return <section className="max-w-xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-4">
    <h1 className="text-xl font-bold text-[var(--text-primary)]">Delivery challan from sales bill</h1>
    <p className="text-sm text-[var(--text-muted)]">Enter a sales bill ID to create or reopen its delivery challan. You can also select Delivery challan on any sales bill.</p>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); const id = billId.trim(); if (!z.uuid().safeParse(id).success) { setError("Enter the complete sales bill ID from its URL."); return; } router.push(`/sales/bills/${id}/delivery-challan`); }}>
      <label className="block text-sm text-[var(--text-body)] space-y-1">Sales bill ID<input required value={billId} onChange={event => { setBillId(event.target.value); setError(""); }} placeholder="Paste the ID from /sales/bills/..." className="w-full rounded-lg px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent" /></label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button type="submit" className="rounded-lg px-4 py-2 bg-[var(--primary-light)] text-[var(--primary)] font-semibold">Open delivery challan</button>
    </form>
    <Link href="/sales/bills" className="inline-block text-sm text-[var(--primary)] underline">Find a sales bill</Link>
  </section>;
}
