"use client";

import { ArrowLeft, ChevronRight, FileText } from "lucide-react";

interface SpecSheetTemplate {
  id: string;
  garment_types?: { name: string };
  fields: Array<{ name: string; type: string; options?: string[] }>;
}

interface Props {
  specSheetTemplate: SpecSheetTemplate | null;
  specSheetValues: Record<string, string>;
  setSpecSheetValues: (v: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step6DesignSpecSheet({
  specSheetTemplate, specSheetValues, setSpecSheetValues, onNext, onBack,
}: Props) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
        <FileText className="h-4.5 w-4.5 text-[var(--primary)]" />
        Step 6: Design Spec Sheet
      </h3>

      {!specSheetTemplate ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)] font-medium">
            No design specification template exists for the selected garment type.
          </p>
          <p className="text-xs text-[var(--text-faint)]">You can safely skip this step and proceed to final review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Garment Parameters ({specSheetTemplate.garment_types?.name})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {specSheetTemplate.fields.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase">{field.name}</label>
                {field.type === "select" ? (
                  <select
                    value={specSheetValues[field.name] || ""}
                    onChange={(e) =>
                      setSpecSheetValues({ ...specSheetValues, [field.name]: e.target.value })
                    }
                    className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
                  >
                    <option value="">Select Option</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={specSheetValues[field.name] || ""}
                    onChange={(e) =>
                      setSpecSheetValues({ ...specSheetValues, [field.name]: e.target.value })
                    }
                    placeholder={`Enter ${field.name}`}
                    className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onBack}
          className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Review & Create
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
