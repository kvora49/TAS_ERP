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
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
        <FileText className="h-4.5 w-4.5 text-[#6366F1]" />
        Step 6: Design Spec Sheet
      </h3>

      {!specSheetTemplate ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-slate-500 font-medium">
            No design specification template exists for the selected garment type.
          </p>
          <p className="text-xs text-slate-400">You can safely skip this step and proceed to final review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Garment Parameters ({specSheetTemplate.garment_types?.name})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {specSheetTemplate.fields.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">{field.name}</label>
                {field.type === "select" ? (
                  <select
                    value={specSheetValues[field.name] || ""}
                    onChange={(e) =>
                      setSpecSheetValues({ ...specSheetValues, [field.name]: e.target.value })
                    }
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
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
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Review & Create
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
