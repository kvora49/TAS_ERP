"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, Tag } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { toast } from "sonner";

interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
}

interface Brand {
  id: string;
  name: string;
}

interface DraftColour {
  name: string;
  hex: string;
}

interface QuickAddDesignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId?: string;
  sizeSets: SizeSet[];
  onDesignCreated: (design: any) => void;
}

export function QuickAddDesignModal({
  open,
  onOpenChange,
  brandId,
  sizeSets,
  onDesignCreated,
}: QuickAddDesignModalProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState(brandId || "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sizeSetId, setSizeSetId] = useState(sizeSets[0]?.id || "");
  const [category, setCategory] = useState("Shirts");
  const [subCategory, setSubCategory] = useState("");
  const [season, setSeason] = useState("");
  const [hsnCode, setHsnCode] = useState("6109");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [colours, setColours] = useState<DraftColour[]>([
    { name: "Default Colour", hex: "#6366F1" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setSubCategory("");
      setSeason("");
      setHsnCode("6109");
      setSalePrice("");
      setDescription("");
      setImages([]);
      setColours([{ name: "Default Colour", hex: "#6366F1" }]);
      setCategory("Shirts");
      if (sizeSets.length > 0) setSizeSetId(sizeSets[0].id);

      // Fetch brands list
      fetch("/api/master-data/brands")
        .then((res) => res.json())
        .then((data) => {
          if (data.brands && data.brands.length > 0) {
            setBrands(data.brands);
            if (!brandId) {
              setSelectedBrandId(data.brands[0].id);
            } else {
              setSelectedBrandId(brandId);
            }
          }
        })
        .catch((err) => console.error("Failed to load brands:", err));
    }
  }, [open, sizeSets, brandId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Design Name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: selectedBrandId || brandId || undefined,
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
          colours: colours
            .filter((c) => c.name.trim())
            .map((c) => ({
              colour_name: c.name.trim(),
              colour_hex: c.hex,
            })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to create design");
        return;
      }

      toast.success(`Design "${data.design?.name || name}" created!`);
      onDesignCreated(data.design);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error creating design");
    } finally {
      setLoading(false);
    }
  };

  const handleAddColour = () => {
    setColours((prev) => [...prev, { name: "", hex: "#6366F1" }]);
  };

  const handleRemoveColour = (idx: number) => {
    if (colours.length <= 1) {
      toast.error("At least one colour is required.");
      return;
    }
    setColours((prev) => prev.filter((_, i) => i !== idx));
  };

  const inputClasses =
    "w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create & Select Design Code"
      description="Quickly define a new garment design for this order or bill."
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Brand Dropdown */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Tag size={12} className="text-[var(--primary)]" />
              <span>Brand <span className="text-red-500">*</span></span>
            </label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className={`${inputClasses} cursor-pointer font-semibold`}
            >
              {brands.length === 0 ? (
                <option value="">Default Brand</option>
              ) : (
                brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Design Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Design Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Slim Fit Denim Jeans"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Design Code / Model No.
            </label>
            <input
              type="text"
              placeholder="e.g. DSN-009 (Auto if empty)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Size Set <span className="text-red-500">*</span>
            </label>
            <select
              value={sizeSetId}
              onChange={(e) => setSizeSetId(e.target.value)}
              className={`${inputClasses} cursor-pointer`}
            >
              {sizeSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sizes.join(", ")})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClasses} cursor-pointer`}
            >
              {["Shirts", "Pants", "Jackets", "Suits", "T-shirts", "Polo", "Undergarments", "Other"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sub-Category</label>
            <input
              type="text"
              placeholder="e.g. Slim-fit, Crewneck"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Collection / Season</label>
            <input
              type="text"
              placeholder="e.g. Summer 2026, Festive"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">HSN Code</label>
            <input
              type="text"
              placeholder="e.g. 6203"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className={`${inputClasses} font-mono`}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sale Price (₹ / Piece)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 899.00"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Style Notes & Description</label>
            <textarea
              rows={2}
              placeholder="Describe fits, stitching detailing, target fabric..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
            />
          </div>
        </div>

        {/* Design Image Gallery */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Design Image</label>
          <ImageUpload
            value={images[0] || ""}
            onChange={(url) => setImages([url])}
            onRemove={() => setImages([])}
            folder="design_catalogs"
            label="Upload Design Image"
          />
        </div>

        {/* Colours Config */}
        <div className="space-y-3 border-t border-[var(--border-light)] pt-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Design Colours</label>
            <button
              type="button"
              onClick={handleAddColour}
              className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Colour
            </button>
          </div>

          <div className="space-y-2">
            {colours.map((col, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Colour name (e.g. Navy Blue)"
                  value={col.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setColours((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, name: val } : c))
                    );
                  }}
                  className="flex-1 h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-medium focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
                <input
                  type="color"
                  value={col.hex}
                  onChange={(e) => {
                    const val = e.target.value;
                    setColours((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, hex: val } : c))
                    );
                  }}
                  className="w-9 h-9 p-0.5 border border-[var(--input-border)] rounded-lg cursor-pointer bg-[var(--card-bg)]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveColour(idx)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? "Creating..." : "Create & Select Design"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
