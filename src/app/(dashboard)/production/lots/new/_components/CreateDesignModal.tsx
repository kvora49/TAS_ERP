"use client";

import React, { useState, useEffect } from "react";

import { BookOpen, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { toast } from "sonner";

interface SizeSet { id: string; name: string; sizes: string[]; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  sizeSets: SizeSet[];
  onDesignCreated: (designId: string) => void;
}

interface DraftColour { name: string; hex: string; }

export default function CreateDesignModal({ open, onOpenChange, brandId, sizeSets, onDesignCreated }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sizeSetId, setSizeSetId] = useState(sizeSets[0]?.id || "");
  const [category, setCategory] = useState("Shirts");
  const [subCategory, setSubCategory] = useState("");
  const [season, setSeason] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [colours, setColours] = useState<DraftColour[]>([{ name: "Default Colour", hex: "#6366F1" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setCode(""); setSubCategory(""); setSeason(""); setHsnCode(""); setSalePrice(""); setDescription("");
      setImages([]); setColours([{ name: "Default Colour", hex: "#6366F1" }]);
      setCategory("Shirts");
      setSizeSetId(sizeSets[0]?.id || "");
    }
  }, [open, sizeSets]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Design Name is required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          name: name.trim(),
          design_number: code.trim() || undefined,
          size_set_id: sizeSetId || undefined,
          category: category || undefined,
          sub_category: subCategory || undefined,
          season: season || undefined,
          hsn_code: hsnCode || undefined,
          sale_price: salePrice ? Number(salePrice) : undefined,
          description: description || undefined,
          images,
          colours: colours.filter((c) => c.name.trim()).map((c) => ({
            colour_name: c.name.trim(),
            colour_hex: c.hex,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create design");
      }

      const result = await res.json();
      toast.success("Design created successfully!");
      onDesignCreated(result.design.id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong creating design");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <BookOpen className="text-[#6366F1]" size={20} />
            <span>Add New Design Code</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Name *</label>
              <input
                type="text"
                placeholder="e.g. Slim Fit Denim Jeans"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Code / Model No.</label>
              <input
                type="text"
                placeholder="e.g. DSN-009 (Leave empty for auto-gen)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Size Set *</label>
              <select
                value={sizeSetId}
                onChange={(e) => setSizeSetId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
              >
                {sizeSets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.sizes.join(", ")})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
              >
                {["Shirts", "Pants", "Jackets", "Suits", "T-shirts", "Polo", "Undergarments", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Sub-Category</label>
              <input
                type="text"
                placeholder="e.g. Slim-fit, Crewneck"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Collection / Season</label>
              <input
                type="text"
                placeholder="e.g. Summer 2026, Festive"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">HSN Code</label>
              <input
                type="text"
                placeholder="e.g. 6203"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Sale Price (₹ / Piece)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 750.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono font-semibold"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Style Notes & Description</label>
              <textarea
                placeholder="Describe fits, stitching detailing, target fabric..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none"
              />
            </div>

            {/* Design Image Gallery */}
            <div className="sm:col-span-2 space-y-2 border-t border-slate-100 pt-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B] block">Design Image Gallery</label>
              <div className="flex flex-wrap gap-3 items-start pt-1">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="w-[100px] aspect-[4/3] rounded-lg border border-[#E5E7EB] relative overflow-hidden bg-[#F8FAFC] flex items-center justify-center shadow-sm group"
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
                      title="Remove image"
                    >
                      <X size={10} className="stroke-[3]" />
                    </button>
                  </div>
                ))}

                <div className="w-[100px] aspect-[4/3] border border-dashed border-[#D1D5DB] rounded-lg bg-[#F8FAFC] flex items-center justify-center p-2 relative">
                  <ImageUpload
                    value=""
                    folder="design_catalogs"
                    onChange={(url) => {
                      if (url) { setImages((prev) => [...prev, url]); toast.success("Design image uploaded!"); }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Colours Config */}
          <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Design Colours</h3>
                <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-none">
                  Configure the shade variations for this design model.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setColours((prev) => [...prev, { name: "", hex: "#6366F1" }])}
                className="h-8 px-2.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Add Colour
              </button>
            </div>

            {colours.length === 0 ? (
              <p className="text-xs text-center py-4 text-[#94A3B8] font-bold">No colours defined yet.</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {colours.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Colour Name (e.g. Navy Blue)"
                        value={item.name}
                        onChange={(e) =>
                          setColours((prev) => prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))
                        }
                        className="w-full h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={item.hex}
                        onChange={(e) =>
                          setColours((prev) => prev.map((c, i) => (i === index ? { ...c, hex: e.target.value } : c)))
                        }
                        className="w-9 h-9 rounded-lg border border-[#D1D5DB] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setColours((prev) => prev.filter((_, i) => i !== index))}
                        className="w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Remove colour"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row gap-2 justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all cursor-pointer shadow-md shadow-[#6366F1]/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              "Save Design"
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


