"use client";

import { ArrowLeft, BookOpen, ChevronRight, Plus, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/forms/ImageUpload";

interface Props {
  additionalDetails: string;
  setAdditionalDetails: (v: string) => void;
  designReferenceText: string;
  setDesignReferenceText: (v: string) => void;
  designReferencePhotos: string[];
  setDesignReferencePhotos: (v: string[]) => void;
  customQa: Array<{ question: string; answer: string }>;
  setCustomQa: (v: Array<{ question: string; answer: string }>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3LotSpecifications({
  additionalDetails, setAdditionalDetails,
  designReferenceText, setDesignReferenceText,
  designReferencePhotos, setDesignReferencePhotos,
  customQa, setCustomQa,
  onNext, onBack,
}: Props) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
        <BookOpen className="h-4.5 w-4.5 text-[var(--primary)]" />
        Step 3: Lot Specifications
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">Additional Details</label>
          <textarea
            rows={3}
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] p-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)] resize-none"
            placeholder="Enter basic notes about lot design specs..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">Design Reference Text</label>
          <textarea
            rows={3}
            value={designReferenceText}
            onChange={(e) => setDesignReferenceText(e.target.value)}
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] p-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)] resize-none"
            placeholder="Reference specs, size tolerances, seam detail notes..."
          />
        </div>

        {/* Photo Upload array */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">Design Reference Photos</label>
          <div className="flex flex-wrap items-center gap-4">
            {designReferencePhotos.map((photo, idx) => (
              <ImageUpload
                key={idx}
                folder="lots"
                value={photo}
                onChange={(url) => {
                  const copy = [...designReferencePhotos];
                  copy[idx] = url;
                  setDesignReferencePhotos(copy);
                }}
                onRemove={() => setDesignReferencePhotos(designReferencePhotos.filter((_, i) => i !== idx))}
              />
            ))}
            {designReferencePhotos.length < 5 && (
              <ImageUpload
                folder="lots"
                value=""
                onChange={(url) => setDesignReferencePhotos([...designReferencePhotos, url])}
                label="+ Add Photo"
              />
            )}
          </div>
        </div>

        {/* Custom Q&A list */}
        <div className="space-y-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">Custom Q&A Checklist</label>
            <button
              type="button"
              onClick={() => setCustomQa([...customQa, { question: "", answer: "" }])}
              className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Q&A Pair
            </button>
          </div>

          {customQa.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)]">No QA points specified yet.</p>
          ) : (
            <div className="space-y-3">
              {customQa.map((qa, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-[var(--page-bg)] border border-[var(--border)] p-3 rounded-lg">
                  <input
                    type="text"
                    placeholder="Question (e.g. Wash Test Done?)"
                    value={qa.question}
                    onChange={(e) => {
                      const copy = [...customQa];
                      copy[idx] = { ...copy[idx], question: e.target.value };
                      setCustomQa(copy);
                    }}
                    className="flex-1 h-9 rounded border border-[var(--input-border)] px-3 text-xs bg-[var(--input-bg)] text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Answer (e.g. Yes - Grade A)"
                    value={qa.answer}
                    onChange={(e) => {
                      const copy = [...customQa];
                      copy[idx] = { ...copy[idx], answer: e.target.value };
                      setCustomQa(copy);
                    }}
                    className="flex-1 h-9 rounded border border-[var(--input-border)] px-3 text-xs bg-[var(--input-bg)] text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomQa(customQa.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
          Next: Size Set & Quantity
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
