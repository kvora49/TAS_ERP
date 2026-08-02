"use client";

import {
  ArrowLeft, Boxes, CheckCircle, ClipboardList, FileText, GitBranch, Settings, Sparkles,
} from "lucide-react";

interface LotStageInput {
  stage_id: string; stage_name: string; stage_type: string;
  sequence_no: number; is_mandatory: boolean; worker_ids: string[];
}

interface SelectedColour { id: string; colour_name: string; colour_hex: string | null; }

interface AllocatedRoll {
  purchase_roll_id: string; roll_number: string; shade: string;
  allocated_meters: number;
}

interface SpecSheetTemplate {
  id: string; garment_types?: { name: string };
  fields: Array<{ name: string; type: string; options?: string[] }>;
}

interface Props {
  lotNumber: string;
  brandName: string;
  lotName: string;
  garmentTypeName: string;
  designType: string;
  lotDate: string;
  targetDispatchDate: string;
  selectedColours: SelectedColour[];
  allocatedRolls: AllocatedRoll[];
  totalAllocatedMeters: number;
  totalQuantity: number;
  availableSizes: string[];
  assignedStages: LotStageInput[];
  specSheetTemplate: SpecSheetTemplate | null;
  specSheetValues: Record<string, string>;
  additionalDetails: string;
  designReferenceText: string;
  designReferencePhotos: string[];
  customQa: Array<{ question: string; answer: string }>;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number) => void;
}

export default function Step7ReviewCreate({
  lotNumber, brandName, lotName, garmentTypeName, designType, lotDate, targetDispatchDate,
  selectedColours, allocatedRolls, totalAllocatedMeters, totalQuantity, availableSizes,
  assignedStages, specSheetTemplate, specSheetValues, additionalDetails, designReferenceText,
  designReferencePhotos, customQa, submitting, onSubmit, onBack, onEditStep,
}: Props) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 shadow-xs space-y-6 text-[var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <span>Review & Finalize Production Lot</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Please double-check all lot configuration before sending to production routing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Basic Details Summary */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <FileText size={16} className="text-[var(--primary)]" />
                <h4 className="font-bold uppercase text-[11px] tracking-wider">Lot General Details</h4>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(2)}
                className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Lot No.</span>
                <span className="font-bold text-[var(--text-primary)] font-mono">{lotNumber}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Brand</span>
                <span className="font-semibold text-[var(--text-primary)]">{brandName}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Lot Name</span>
                <span className="font-semibold text-[var(--text-primary)]">{lotName || "—"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Garment Type</span>
                <span className="font-semibold text-[var(--text-primary)]">{garmentTypeName || "—"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Design Type</span>
                <span className="font-semibold text-[var(--text-primary)]">{designType || "—"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Lot Date</span>
                <span className="font-semibold text-[var(--text-primary)]">{lotDate}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Dispatch Target</span>
                <span className="font-semibold text-[var(--text-primary)]">{targetDispatchDate}</span>
              </div>
              <div className="col-span-2 border-t border-[var(--border)] pt-3">
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1.5">Colours Selected</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedColours.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)] font-bold text-[10px]">
                      {c.colour_hex && (
                        <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: c.colour_hex }} />
                      )}
                      {c.colour_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fabric Allocation Summary */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Boxes size={16} className="text-[var(--primary)]" />
                <h4 className="font-bold uppercase text-[11px] tracking-wider">Fabric & Roll Allocation</h4>
              </div>
              <button type="button" onClick={() => onEditStep(1)} className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer">Edit</button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="flex items-center justify-between bg-[var(--primary-light)] border border-[var(--border)] rounded-xl p-3">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-[var(--primary)] tracking-wider mb-0.5">Total Fabric Allocated</span>
                  <span className="text-sm font-black text-[var(--primary)]">{totalAllocatedMeters.toFixed(2)} Meters</span>
                </div>
                <span className="text-xs font-bold text-[var(--primary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1">
                  {allocatedRolls.length} Rolls
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Allocated Roll Numbers</span>
                <div className="flex flex-wrap gap-1.5">
                  {allocatedRolls.map((r) => (
                    <span key={r.purchase_roll_id} className="px-2 py-1 rounded bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] text-[10px] font-semibold font-mono">
                      Roll #{r.roll_number} ({r.allocated_meters}m)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Specifications Summary */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Settings size={16} className="text-[var(--primary)]" />
                <h4 className="font-bold uppercase text-[11px] tracking-wider">Lot Specifications</h4>
              </div>
              <button type="button" onClick={() => onEditStep(3)} className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer">Edit</button>
            </div>
            <div className="p-4 text-xs space-y-3.5">
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Design Reference Info</span>
                <span className="font-medium text-[var(--text-primary)] leading-relaxed block bg-[var(--card-bg)] border border-[var(--border)] p-2 rounded-lg">{designReferenceText || "—"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">Additional Details</span>
                <span className="font-medium text-[var(--text-primary)] leading-relaxed block bg-[var(--card-bg)] border border-[var(--border)] p-2 rounded-lg">{additionalDetails || "—"}</span>
              </div>
              {designReferencePhotos && designReferencePhotos.length > 0 && (
                <div>
                  <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1.5">
                    Design Reference Photos ({designReferencePhotos.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {designReferencePhotos.map((photoUrl, idx) => (
                      <a
                        key={idx}
                        href={photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] shadow-xs hover:border-[var(--primary)] transition-all"
                        title="Click to view full image"
                      >
                        <img
                          src={photoUrl}
                          alt={`Spec Reference ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Custom QA checklist</span>
                <span className="font-bold text-[var(--text-primary)] bg-[var(--card-bg)] rounded px-2 py-0.5 text-[10px] border border-[var(--border)]">
                  {customQa.length} items configured
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Size Quantities Summary */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <ClipboardList size={16} className="text-[var(--primary)]" />
                <h4 className="font-bold uppercase text-[11px] tracking-wider">Production Volume</h4>
              </div>
              <button type="button" onClick={() => onEditStep(4)} className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer">Edit</button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-emerald-500 tracking-wider mb-0.5">Total Quantity To Produce</span>
                  <span className="text-sm font-black text-emerald-500">{totalQuantity.toLocaleString("en-IN")} Pieces</span>
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1.5">Size Breakdown Schema</span>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map((sz) => (
                    <span key={sz} className="px-2.5 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[10px]">
                      {sz}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Stages Summary */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <GitBranch size={16} className="text-[var(--primary)]" />
                <h4 className="font-bold uppercase text-[11px] tracking-wider">Workflow Routing Stages</h4>
              </div>
              <button type="button" onClick={() => onEditStep(5)} className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer">Edit</button>
            </div>
            <div className="p-4 text-xs">
              <div className="relative border-l-2 border-[var(--border)] pl-4 ml-2.5 space-y-4">
                {assignedStages.map((stage, idx) => (
                  <div key={stage.stage_id} className="relative">
                    <span className="absolute -left-[23px] top-0.5 w-2.5 h-2.5 rounded-full bg-[var(--primary)] border-2 border-[var(--card-bg)]" />
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="block font-bold text-[var(--text-primary)]">{idx + 1}. {stage.stage_name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {stage.stage_type === "job_work" ? "Job Work Outsource" : "In-House routing"}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded px-1.5 py-0.5">
                        {stage.worker_ids?.length || 0} Workers
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Design Spec Sheet Summary */}
          {specSheetTemplate && (
            <div className="border border-[var(--border)] rounded-xl bg-[var(--page-bg)] shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)]">
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  <Sparkles size={16} className="text-[var(--primary)]" />
                  <h4 className="font-bold uppercase text-[11px] tracking-wider">Garment Spec Parameters</h4>
                </div>
                <button type="button" onClick={() => onEditStep(6)} className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-2.5 py-1 rounded-lg transition-all cursor-pointer">Edit</button>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 text-xs bg-[var(--page-bg)]">
                {Object.entries(specSheetValues).map(([name, val]) => (
                  <div key={name} className="border border-[var(--border)] bg-[var(--card-bg)] p-2.5 rounded-lg">
                    <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">{name}</span>
                    <span className="font-bold text-[var(--text-primary)]">{val || "—"}</span>
                  </div>
                ))}
              </div>
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
          onClick={onSubmit}
          disabled={submitting}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          {submitting ? "Creating Lot..." : "Confirm & Create Lot"}
          <CheckCircle size={14} />
        </button>
      </div>
    </div>
  );
}
