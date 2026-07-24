"use client";

import { ArrowLeft, ChevronRight, ClipboardList, Plus, RefreshCw } from "lucide-react";

interface Brand { id: string; name: string; }
interface DesignColour { id: string; colour_name: string; colour_hex: string | null; }
interface Design {
  id: string; name: string; code?: string; design_number?: string; brand_id: string;
  design_colours?: DesignColour[];
}

interface SelectedColour { id: string; colour_name: string; colour_hex: string | null; }

interface Props {
  brands: Brand[];
  filteredDesigns: Design[];
  brandId: string;
  setBrandId: (v: string) => void;
  designId: string;
  setDesignId: (v: string) => void;
  lotName: string;
  setLotName: (v: string) => void;
  lotNumber: string;
  setLotNumber: (v: string) => void;
  buyerOrderRef?: string;
  setBuyerOrderRef?: (v: string) => void;
  garmentTypes: { id: string; name: string }[];
  garmentTypeId: string;
  setGarmentTypeId: (v: string) => void;
  designType: string;
  setDesignType: (v: string) => void;
  lotDate: string;
  setLotDate: (v: string) => void;
  targetDispatchDate: string;
  setTargetDispatchDate: (v: string) => void;
  selectedColours: SelectedColour[];
  selectedDesign: Design | undefined;
  onAddColour: (colourId: string) => void;
  onRemoveColour: (colourId: string) => void;
  onGenerateLotNumber: () => void;
  onOpenCreateDesignModal: () => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2BasicDetails({
  brands, filteredDesigns, brandId, setBrandId, designId, setDesignId,
  lotName, setLotName, lotNumber, setLotNumber, buyerOrderRef, setBuyerOrderRef,
  garmentTypes, garmentTypeId, setGarmentTypeId,
  designType, setDesignType, lotDate, setLotDate,
  targetDispatchDate, setTargetDispatchDate,
  selectedColours, selectedDesign,
  onAddColour, onRemoveColour, onGenerateLotNumber, onOpenCreateDesignModal,
  onNext, onBack,
}: Props) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
        <ClipboardList className="h-4.5 w-4.5 text-[#6366F1]" />
        Step 2: Basic Information
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Brand <span className="text-red-500">*</span>
          </label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="">Select Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-[#374151] uppercase">
              Design <span className="text-red-500">*</span>
            </label>
            {brandId && (
              <button
                type="button"
                onClick={onOpenCreateDesignModal}
                className="text-xs font-bold text-[#6366F1] hover:text-[#4F46E5] hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
              >
                <Plus size={11} /> Add New Design
              </button>
            )}
          </div>
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
            disabled={!brandId}
          >
            <option value="">Select Design</option>
            {filteredDesigns.map((d) => (
              <option key={d.id} value={d.id}>
                {d.design_number || d.code ? `${d.design_number || d.code} - ` : ""}{d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Lot Name <span className="text-[#64748B]">(Optional)</span>
          </label>
          <input
            type="text"
            value={lotName}
            onChange={(e) => setLotName(e.target.value)}
            placeholder="e.g. Slim-fit Summer Chinos"
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Lot No. <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-10 text-sm focus:ring-2 focus:ring-[#6366F1] font-mono font-bold"
            />
            <button
              type="button"
              onClick={onGenerateLotNumber}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#6366F1] cursor-pointer"
              title="Regenerate Lot No."
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Sales Order Ref / Buyer Order No (Only shown when created via Sales Order) */}
        {buyerOrderRef ? (
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
              Sales Order Ref / Buyer Order No.
            </label>
            <input
              type="text"
              value={buyerOrderRef}
              onChange={(e) => setBuyerOrderRef && setBuyerOrderRef(e.target.value)}
              placeholder="e.g. SO-2026-0001"
              className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-indigo-50/40 px-3 text-sm font-mono font-bold text-[#6366F1] focus:ring-2 focus:ring-[#6366F1]"
            />
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Garment Type <span className="text-red-500">*</span>
          </label>
          <select
            value={garmentTypeId}
            onChange={(e) => setGarmentTypeId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="">Select Garment Type</option>
            {garmentTypes.map((gt) => (
              <option key={gt.id} value={gt.id}>{gt.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Design Type / Fit-Style
          </label>
          <input
            type="text"
            value={designType}
            onChange={(e) => setDesignType(e.target.value)}
            placeholder="e.g. Regular Fit, Slim Fit"
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Lot Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={lotDate}
            onChange={(e) => setLotDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
            Target Dispatch Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={targetDispatchDate}
            onChange={(e) => setTargetDispatchDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        {/* Colours multi-select list */}
        <div className="sm:col-span-2 border-t border-slate-100 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-[#374151] uppercase">
              Select Colours <span className="text-red-500">*</span>
            </label>
            {selectedDesign?.design_colours && selectedDesign.design_colours.length > 0 && (
              <span className="text-[11px] font-semibold text-slate-400">
                Click to toggle colours for this lot
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 min-h-[52px]">
            {!selectedDesign ? (
              <span className="text-xs text-slate-400 font-medium italic">
                Select a Design above to see available colours
              </span>
            ) : !selectedDesign.design_colours || selectedDesign.design_colours.length === 0 ? (
              <span className="text-xs text-slate-400 font-medium italic">
                No colours registered for this design in Master Data
              </span>
            ) : (
              selectedDesign.design_colours.map((c) => {
                const isSelected = selectedColours.some((sc) => sc.id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onRemoveColour(c.id);
                      } else {
                        onAddColour(c.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-[#6366F1] text-white border border-[#4F46E5] ring-2 ring-indigo-200"
                        : "bg-white text-slate-700 border border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/30"
                    }`}
                  >
                    {c.colour_hex && (
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/80 shrink-0 shadow-2xs"
                        style={{ backgroundColor: c.colour_hex }}
                      />
                    )}
                    <span>{c.colour_name}</span>
                    {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

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
          Next: Specifications
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
