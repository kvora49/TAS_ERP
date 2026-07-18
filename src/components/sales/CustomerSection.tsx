import React from "react";

interface CustomerSectionProps {
  state: any;
  parties: any[];
  salesmen: any[];
}

export function CustomerSection({ state, parties, salesmen }: CustomerSectionProps) {
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
      state.setPaymentTerms(p.payment_terms || "Immediate");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Select */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Customer / Party *
          </label>
          <select
            value={state.partyId}
            onChange={(e) => handlePartyChange(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
          >
            <option value="">Select Customer</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gstin ? `(${p.gstin})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Bill Date */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Bill Date *
          </label>
          <input
            type="date"
            value={state.billDate}
            onChange={(e) => state.setBillDate(e.target.value)}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payment Terms
          </label>
          <select
            value={state.paymentTerms}
            onChange={(e) => state.setPaymentTerms(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
          >
            <option value="Immediate">Immediate</option>
            <option value="Net 15">Net 15</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 45">Net 45</option>
            <option value="Net 60">Net 60</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Due Date
          </label>
          <input
            type="date"
            value={state.dueDate}
            onChange={(e) => state.setDueDate(e.target.value)}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Reference / Challan No
          </label>
          <input
            type="text"
            placeholder="e.g. REF-2384"
            value={state.referenceNo}
            onChange={(e) => state.setReferenceNo(e.target.value)}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Billing Address
        </label>
        <textarea
          rows={2}
          value={state.billingAddress}
          onChange={(e) => state.setBillingAddress(e.target.value)}
          className="w-full p-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Transporter Name
          </label>
          <input
            type="text"
            placeholder="e.g. VRL Logistics"
            value={state.transporterName}
            onChange={(e) => state.setTransporterName(e.target.value)}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Vehicle Number
          </label>
          <input
            type="text"
            placeholder="e.g. MH-12-PQ-9988"
            value={state.vehicleNo}
            onChange={(e) => state.setVehicleNo(e.target.value)}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Salesman
          </label>
          <select
            value={state.salesman}
            onChange={(e) => state.setSalesman(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
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
