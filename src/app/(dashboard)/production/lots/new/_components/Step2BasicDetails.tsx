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
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
        <ClipboardList className="h-4.5 w-4.5 text-[var(--primary)]" />
        Step 2: Basic Information
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Brand <span className="text-red-500">*</span>
          </label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          >
            <option value="">Select Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">
              Design <span className="text-red-500">*</span>
            </label>
            {brandId && (
              <button
                type="button"
                onClick={onOpenCreateDesignModal}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
              >
                <Plus size={11} /> Add New Design
              </button>
            )}
          </div>
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
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
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Lot Name <span className="text-[var(--text-faint)]">(Optional)</span>
          </label>
          <input
            type="text"
            value={lotName}
            onChange={(e) => setLotName(e.target.value)}
            placeholder="e.g. Slim-fit Summer Chinos"
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Lot No. <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] pl-3 pr-10 text-sm focus:ring-2 focus:ring-[var(--input-focus)] font-mono font-bold"
            />
            <button
              type="button"
              onClick={onGenerateLotNumber}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--primary)] cursor-pointer"
              title="Regenerate Lot No."
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Sales Order Ref / Buyer Order No (Only shown when created via Sales Order) */}
        {buyerOrderRef ? (
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
              Sales Order Ref / Buyer Order No.
            </label>
            <input
              type="text"
              value={buyerOrderRef}
              onChange={(e) => setBuyerOrderRef && setBuyerOrderRef(e.target.value)}
              placeholder="e.g. SO-2026-0001"
              className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--primary-light)] px-3 text-sm font-mono font-bold text-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Garment Type <span className="text-red-500">*</span>
          </label>
          <select
            value={garmentTypeId}
            onChange={(e) => setGarmentTypeId(e.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          >
            <option value="">Select Garment Type</option>
            {garmentTypes.map((gt) => (
              <option key={gt.id} value={gt.id}>{gt.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Design Type / Fit-Style
          </label>
          <input
            type="text"
            value={designType}
            onChange={(e) => setDesignType(e.target.value)}
            placeholder="e.g. Regular Fit, Slim Fit"
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Lot Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={lotDate}
            onChange={(e) => setLotDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
            Target Dispatch Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={targetDispatchDate}
            onChange={(e) => setTargetDispatchDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        {/* Colours multi-select list */}
        <div className="sm:col-span-2 border-t border-[var(--border)] pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase">
              Select Colours <span className="text-red-500">*</span>
            </label>
            {selectedDesign?.design_colours && selectedDesign.design_colours.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--text-faint)]">
                Click to toggle colours for this lot
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] min-h-[52px]">
            {!selectedDesign ? (
              <span className="text-xs text-[var(--text-faint)] font-medium italic">
                Select a Design above to see available colours
              </span>
            ) : !selectedDesign.design_colours || selectedDesign.design_colours.length === 0 ? (
              <span className="text-xs text-[var(--text-faint)] font-medium italic">
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
                        ? "bg-[var(--primary)] text-white border border-[var(--primary-dark)]"
                        : "bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--table-row-hover)]"
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
          Next: Specifications
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
