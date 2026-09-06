"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
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
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create design");
    }

    const result = await res.json();
    toast.success("Design created successfully!");
    onDesignCreated(result.design.id);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth="max-w-xl"
      title={
        <div className="flex items-center gap-2">
          <BookOpen className="text-[var(--primary)]" size={20} />
          <span>Add New Design Code</span>
        </div>
      }
      description="Create a new design model and catalogue variations."
    >
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Design Name *</label>
            <input
              type="text"
              placeholder="e.g. Slim Fit Denim Jeans"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Design Code / Model No.</label>
            <input
              type="text"
              placeholder="e.g. DSN-009 (Leave empty for auto-gen)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Size Set Preset *</label>
            <select
              value={sizeSetId}
              onChange={(e) => setSizeSetId(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer transition-colors"
            >
              {sizeSets.map((ss) => (
                <option key={ss.id} value={ss.id}>
                  {ss.name} ({ss.sizes.join(", ")})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer transition-colors"
            >
              <option value="Shirts">Shirts</option>
              <option value="T-Shirts">T-Shirts</option>
              <option value="Jeans">Jeans</option>
              <option value="Trousers">Trousers</option>
              <option value="Kurtas">Kurtas</option>
              <option value="Jackets">Jackets</option>
              <option value="Dresses">Dresses</option>
              <option value="Others">Others</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sub Category</label>
            <input
              type="text"
              placeholder="e.g. Formal, Casual"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Season / Collection</label>
            <input
              type="text"
              placeholder="e.g. Summer 2026, Festive"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">HSN Code</label>
            <input
              type="text"
              placeholder="e.g. 6205"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono transition-colors"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Default Sale Price (₹)</label>
            <input
              type="number"
              placeholder="0.00"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono font-semibold transition-colors"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Description & Notes</label>
            <textarea
              rows={2}
              placeholder="Add product specifications, fit, washing instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] resize-none transition-colors"
            />
          </div>

          {/* Design Image Gallery */}
          <div className="sm:col-span-2 space-y-2 border-t border-[var(--border-light)] pt-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">Design Image Gallery</label>
            <div className="flex flex-wrap gap-3 items-start pt-1">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="w-[100px] aspect-[4/3] rounded-lg border border-[var(--border)] relative overflow-hidden bg-[var(--page-bg)] flex items-center justify-center shadow-xs group"
                >
                  <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
                    title="Remove image"
                  >
                    <X size={12} className="stroke-[3]" />
                  </button>
                </div>
              ))}

              <div className="w-[100px] aspect-[4/3] border border-dashed border-[var(--input-border)] rounded-lg bg-[var(--page-bg)] flex items-center justify-center p-2 relative">
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
        <div className="border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--card-bg)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Design Colours</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 leading-none">
                Configure the shade variations for this design model.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setColours((prev) => [...prev, { name: "", hex: "#6366F1" }])}
              className="h-8 px-2.5 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} /> Add Colour
            </button>
          </div>

          {colours.length === 0 ? (
            <p className="text-xs text-center py-4 text-[var(--text-faint)] font-bold">No colours defined yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {colours.map((item, index) => (
                <div key={index} className="flex items-center gap-2.5 bg-[var(--page-bg)] p-2.5 rounded-xl border border-[var(--border-light)]">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Colour Name (e.g. Navy Blue)"
                      value={item.name}
                      onChange={(e) =>
                        setColours((prev) => prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))
                      }
                      className="w-full h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={item.hex}
                      onChange={(e) =>
                        setColours((prev) => prev.map((c, i) => (i === index ? { ...c, hex: e.target.value } : c)))
                      }
                      className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setColours((prev) => prev.filter((_, i) => i !== index))}
                      className="w-8 h-8 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[var(--border-light)] flex flex-col sm:flex-row gap-2 justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] rounded-lg border border-[var(--border)] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={handleSave}
            variant="primary"
            className="w-full sm:w-auto text-sm font-semibold"
          >
            Save Design
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
