import React from "react";

interface ConsigneeSectionProps {
  state: any;
  billingParty?: {
    name?: string;
    address?: string;
    gstin?: string;
    state?: string;
    state_code?: string;
  };
}

const inputClass = `
  bg-[var(--input-bg)]
  border border-[var(--input-border)]
  text-[var(--text-primary)]
  placeholder:text-[var(--text-faint)]
  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
  rounded-lg px-3 h-10 text-sm
  transition-colors w-full
`;

const textareaClass = `
  bg-[var(--input-bg)]
  border border-[var(--input-border)]
  text-[var(--text-primary)]
  placeholder:text-[var(--text-faint)]
  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
  rounded-lg px-3 py-2 text-sm
  transition-colors w-full resize-none
`;

const labelClass = "block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1";

export function ConsigneeSection({ state, billingParty }: ConsigneeSectionProps) {
  const handleSameAsBillTo = (same: boolean) => {
    state.setShipToSameAsBillTo(same);
    if (same) {
      // Copy billing party info into consignee fields
      state.setConsigneeName(billingParty?.name || "");
      state.setConsigneeAddress(billingParty?.address || "");
      state.setConsigneeGstin(billingParty?.gstin || "");
      state.setConsigneeState(billingParty?.state || "");
      state.setConsigneeStateCode(billingParty?.state_code || "");
    }
  };

  return (
    <div className="space-y-8">
      {/* ── CONSIGNEE / SHIP TO ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Consignee / Ship To</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              The address where goods will be physically delivered (may differ from billing address)
            </p>
          </div>
          {/* Same as Bill To toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.shipToSameAsBillTo}
              onChange={(e) => handleSameAsBillTo(e.target.checked)}
              className="sr-only peer"
              id="same-as-bill-to"
            />
            <div className="relative w-9 h-5 bg-[var(--border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary)]" />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Same as Bill To</span>
          </label>
        </div>

        {state.shipToSameAsBillTo ? (
          /* Show read-only preview when same as bill to */
          <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Ship-To Address (Same as Billing)</span>
            {billingParty?.name ? (
              <>
                <p className="text-sm font-bold text-[var(--text-primary)]">{billingParty.name}</p>
                {billingParty.address && <p className="text-xs text-[var(--text-body)] whitespace-pre-line">{billingParty.address}</p>}
                {billingParty.gstin && <p className="text-xs text-[var(--text-secondary)] font-mono">GSTIN/UIN: {billingParty.gstin}</p>}
                {billingParty.state && (
                  <p className="text-xs text-[var(--text-muted)]">
                    State: {billingParty.state}{billingParty.state_code ? `, Code: ${billingParty.state_code}` : ""}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-[var(--text-faint)] italic">Select a customer in Step 1 to auto-fill shipping address.</p>
            )}
          </div>
        ) : (
          /* Separate consignee details form */
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Consignee Name *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. ABC Wholesale Distributors"
                  value={state.consigneeName}
                  onChange={(e) => state.setConsigneeName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Consignee GSTIN/UIN</label>
                <input
                  type="text"
                  className={`${inputClass} font-mono uppercase`}
                  placeholder="e.g. 09EAGPK3831M1ZB"
                  value={state.consigneeGstin}
                  onChange={(e) => state.setConsigneeGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Consignee Delivery Address</label>
              <textarea
                className={textareaClass}
                rows={3}
                placeholder="Full delivery address including city, state, PIN"
                value={state.consigneeAddress}
                onChange={(e) => state.setConsigneeAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Uttar Pradesh"
                  value={state.consigneeState}
                  onChange={(e) => state.setConsigneeState(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>State Code</label>
                <input
                  type="text"
                  className={`${inputClass} font-mono`}
                  placeholder="e.g. 09"
                  value={state.consigneeStateCode}
                  onChange={(e) => state.setConsigneeStateCode(e.target.value)}
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DISPATCH DETAILS ── */}
      <div className="space-y-4 border-t border-[var(--border-light)] pt-6">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Dispatch Details</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Dispatch reference numbers and shipping method. Printed on the top-right of the invoice.
          </p>
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Buyer&apos;s Order No.</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. PO-2026-0045"
              value={state.buyerOrderNo}
              onChange={(e) => state.setBuyerOrderNo(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Buyer Order Date</label>
            <input
              type="date"
              className={inputClass}
              value={state.buyerOrderDate}
              onChange={(e) => state.setBuyerOrderDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Delivery Note No.</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. DN-061"
              value={state.deliveryNote}
              onChange={(e) => state.setDeliveryNote(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Delivery Note Date</label>
            <input
              type="date"
              className={inputClass}
              value={state.deliveryNoteDate}
              onChange={(e) => state.setDeliveryNoteDate(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Dispatch Doc No.</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. DD-061"
              value={state.dispatchDocNo}
              onChange={(e) => state.setDispatchDocNo(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Dispatched Through</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. NARAYANI LOGISTICS"
              value={state.dispatchedThrough}
              onChange={(e) => state.setDispatchedThrough(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Destination</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. DUMARIA GANJ UP"
              value={state.destination}
              onChange={(e) => state.setDestination(e.target.value)}
            />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Mode / Terms of Payment</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. 30 Days Credit"
              value={state.modeOfPayment}
              onChange={(e) => state.setModeOfPayment(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Terms of Delivery</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. FOB Ahmedabad"
              value={state.termsOfDelivery}
              onChange={(e) => state.setTermsOfDelivery(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
