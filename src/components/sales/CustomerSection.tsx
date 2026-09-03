import React from "react";

interface CustomerSectionProps {
  state: any;
  parties: any[];
  salesmen: any[];
}

export function CustomerSection({ state, parties, salesmen }: CustomerSectionProps) {
  const selectedParty = parties.find((x) => x.id === state.partyId);

  const calculateDueDate = (baseDateStr: string, terms: string) => {
    if (!baseDateStr) return "";
    const daysMap: Record<string, number> = {
      "Immediate": 0,
      "immediate": 0,
      "Net 15": 15,
      "15_days": 15,
      "Net 30": 30,
      "30_days": 30,
      "Net 45": 45,
      "45_days": 45,
      "Net 60": 60,
      "60_days": 60,
      "Net 90": 90,
      "90_days": 90,
    };
    const days = daysMap[terms] ?? 0;
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const normalizeTerms = (rawTerms: string) => {
    const map: Record<string, string> = {
      "15_days": "Net 15",
      "Net 15": "Net 15",
      "30_days": "Net 30",
      "Net 30": "Net 30",
      "45_days": "Net 45",
      "Net 45": "Net 45",
      "60_days": "Net 60",
      "Net 60": "Net 60",
      "90_days": "Net 90",
      "Net 90": "Net 90",
      "immediate": "Immediate",
      "Immediate": "Immediate",
    };
    return map[rawTerms] || "Immediate";
  };

  const handlePartyChange = (id: string) => {
    state.setPartyId(id);
    const p = parties.find((x) => x.id === id);
    if (p) {
      state.setBillingAddress(
        [
          p.billing_address_line1,
          p.billing_address_line2,
          p.billing_city,
          p.billing_state,
          p.billing_pincode,
        ]
          .filter(Boolean)
          .join(", ")
      );
      state.setPhone(p.phone || "");
      state.setGstin(p.gstin || "");
      const terms = normalizeTerms(p.payment_terms || "Immediate");
      state.setPaymentTerms(terms);
      state.setDueDate(calculateDueDate(state.billDate, terms));
    }
  };

  const handlePaymentTermsChange = (newTerms: string) => {
    state.setPaymentTerms(newTerms);
    state.setDueDate(calculateDueDate(state.billDate, newTerms));
  };

  const handleBillDateChange = (newDate: string) => {
    state.setBillDate(newDate);
    state.setDueDate(calculateDueDate(newDate, state.paymentTerms));
  };

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-3 h-10 text-sm
    transition-colors
  `;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Select */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Customer / Party *
          </label>
          <select
            value={state.partyId}
            onChange={(e) => handlePartyChange(e.target.value)}
            className={`${inputClass} w-full cursor-pointer`}
          >
            <option value="">Select Customer</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gstin && p.gstin !== "URP" ? `(${p.gstin})` : ""}
              </option>
            ))}
          </select>

          {/* Selected Customer Credit & Tax Info Pill */}
          {selectedParty && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {selectedParty.phone && (
                <span className="text-[var(--text-muted)]">📞 {selectedParty.phone}</span>
              )}
              {selectedParty.gstin && selectedParty.gstin !== "URP" && (
                <span className="font-mono text-[var(--text-muted)]">GSTIN: {selectedParty.gstin}</span>
              )}
              {Number(selectedParty.credit_limit || 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--input-bg)] border border-[var(--border)] font-bold text-[var(--text-secondary)] text-[11px]">
                  Credit Limit: ₹{Number(selectedParty.credit_limit).toLocaleString("en-IN")}
                </span>
              )}
              {Number(selectedParty.credit_limit || 0) > 0 &&
                Number(state.grandTotal || 0) > Number(selectedParty.credit_limit) && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[11px] flex items-center gap-1">
                    ⚠️ Bill (₹{Math.round(state.grandTotal || 0).toLocaleString("en-IN")}) exceeds credit limit
                  </span>
                )}
            </div>
          )}
        </div>

        {/* Bill Date */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Bill Date *
          </label>
          <input
            type="date"
            value={state.billDate}
            onChange={(e) => handleBillDateChange(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Payment Terms
          </label>
          <select
            value={state.paymentTerms}
            onChange={(e) => handlePaymentTermsChange(e.target.value)}
            className={`${inputClass} w-full cursor-pointer`}
          >
            <option value="Immediate">Immediate</option>
            <option value="Net 15">Net 15 (15 Days)</option>
            <option value="Net 30">Net 30 (30 Days)</option>
            <option value="Net 45">Net 45 (45 Days)</option>
            <option value="Net 60">Net 60 (60 Days)</option>
            <option value="Net 90">Net 90 (90 Days)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Due Date
          </label>
          <input
            type="date"
            value={state.dueDate}
            onChange={(e) => state.setDueDate(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Reference / Challan No
          </label>
          <input
            type="text"
            placeholder="e.g. REF-2384"
            value={state.referenceNo}
            onChange={(e) => state.setReferenceNo(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Billing Address
        </label>
        <textarea
          rows={2}
          value={state.billingAddress}
          onChange={(e) => state.setBillingAddress(e.target.value)}
          className={`${inputClass} w-full p-3 h-auto resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Transporter Name
          </label>
          <input
            type="text"
            placeholder="e.g. VRL Logistics"
            value={state.transporterName}
            onChange={(e) => state.setTransporterName(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Vehicle Number
          </label>
          <input
            type="text"
            placeholder="e.g. MH-12-PQ-9988"
            value={state.vehicleNo}
            onChange={(e) => state.setVehicleNo(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Salesman
          </label>
          <select
            value={state.salesman}
            onChange={(e) => state.setSalesman(e.target.value)}
            className={`${inputClass} w-full cursor-pointer`}
          >
            <option value="">Select Salesman</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
