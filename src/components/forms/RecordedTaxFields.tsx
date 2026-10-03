"use client";

export type RecordedTaxInput = { taxable_amount: string; cgst: string; sgst: string; igst: string };
export const emptyRecordedTax: RecordedTaxInput = { taxable_amount: "", cgst: "", sgst: "", igst: "" };
export function taxInputPayload(value: RecordedTaxInput) {
  return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, amount.trim() === "" ? null : Number(amount)]));
}

export default function RecordedTaxFields({ value, onChange }: { value: RecordedTaxInput; onChange: (value: RecordedTaxInput) => void }) {
  return <fieldset className="min-w-0 border border-[var(--border)] rounded-lg p-3 space-y-2">
    <legend className="px-1 text-xs font-semibold text-[var(--text-primary)]">Recorded tax breakdown (optional)</legend>
    <p className="text-xs text-[var(--text-muted)]">Copy amounts from the source document. Leave unknown amounts blank; enter 0 only when the document records no tax.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {([['taxable_amount', 'Taxable value'], ['cgst', 'CGST'], ['sgst', 'SGST'], ['igst', 'IGST']] as const).map(([key, label]) => <label key={key} className="text-xs text-[var(--text-muted)] space-y-1">
        <span>{label}</span>
        <input type="number" min="0" step="0.01" value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} placeholder="Not recorded" className="w-full min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors" />
      </label>)}
    </div>
  </fieldset>;
}
