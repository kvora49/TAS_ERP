"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";

export default function PartyStatementPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [partyId, setPartyId] = useState("");

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  // Fetch parties list
  const { data: initData } = useQuery<{ parties: any[] }>({
    queryKey: ["party-statement-parties"],
    queryFn: async () => {
      const res = await fetch("/api/reports/party-statement");
      if (!res.ok) throw new Error("Failed to load parties");
      return res.json();
    },
  });

  // Fetch selected party statement
  const { data: statementData, isLoading, error } = useQuery({
    queryKey: ["party-statement", partyId, from, to],
    queryFn: async () => {
      if (!partyId) return null;
      const res = await fetch(`/api/reports/party-statement?party_id=${partyId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load party statement");
      return res.json();
    },
    enabled: !!partyId,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  const parties = initData?.parties || [];
  const ledger = statementData?.ledger || [];

  return (
    <PageState isLoading={false} error={undefined}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900">Party Statement</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Reports / Account Statements</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none min-w-[240px]">
            <option value="">-- Select Party --</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company_name ? `${p.company_name} (${p.name})` : p.name}
              </option>
            ))}
          </select>
          <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />
        </div>

        {/* Party Info + Balances */}
        {statementData?.party && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Party Details</span>
              <p className="font-bold text-slate-900">{statementData.party.company_name || statementData.party.name}</p>
              <p className="text-xs text-slate-500">{statementData.party.phone || "—"}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(statementData.party.type || []).map((t: string) => (
                  <span key={t} className="text-[9px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Closing Balance</span>
              <p className={`text-2xl font-extrabold mt-1 ${(statementData.closing_balance || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {fmt(Math.abs(statementData.closing_balance || 0))}
                <span className="text-sm ml-1">{(statementData.closing_balance || 0) >= 0 ? "Cr" : "Dr"}</span>
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Transactions</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{ledger.length}</p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        {isLoading && partyId ? (
          <div className="text-center py-10 text-slate-400 text-sm font-semibold">Loading statement…</div>
        ) : partyId && ledger.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Type</th>
                    <th className="py-3 px-6">Reference</th>
                    <th className="py-3 px-6 text-right">Debit (₹)</th>
                    <th className="py-3 px-6 text-right">Credit (₹)</th>
                    <th className="py-3 px-6 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                  {ledger.map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50 h-12">
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {new Date(entry.date || entry.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </td>
                      <td className="py-3 px-6 font-bold">{entry.type || "—"}</td>
                      <td className="py-3 px-6 font-mono">{entry.reference || entry.bill_number || "—"}</td>
                      <td className="py-3 px-6 text-right font-mono text-rose-600">
                        {entry.debit > 0 ? fmt(entry.debit) : "—"}
                      </td>
                      <td className="py-3 px-6 text-right font-mono text-emerald-600">
                        {entry.credit > 0 ? fmt(entry.credit) : "—"}
                      </td>
                      <td className="py-3 px-6 text-right font-bold font-mono text-slate-900">{entry.balanceStr || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : partyId ? (
          <div className="text-center py-10 text-slate-400 text-sm font-semibold">No transactions in selected date range.</div>
        ) : (
          <div className="text-center py-16 text-slate-400 text-sm font-semibold">Select a party to view their statement.</div>
        )}
      </div>
    </PageState>
  );
}
