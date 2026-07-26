"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, X, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <BookOpen className="text-[#6366F1]" size={20} />
            <span>Create & Select Design Code</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand Dropdown */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                <Tag size={12} className="text-[#6366F1]" />
                <span>Brand <span className="text-red-500">*</span></span>
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
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
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Design Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Slim Fit Denim Jeans"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Design Code / Model No.
              </label>
              <input
                type="text"
                placeholder="e.g. DSN-009 (Leave empty for auto-gen)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Size Set <span className="text-red-500">*</span>
              </label>
              <select
                value={sizeSetId}
                onChange={(e) => setSizeSetId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
              >
                {sizeSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sizes.join(", ")})
                  </option>
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
                  <option key={c} value={c}>
                    {c}
                  </option>
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

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Sale Price (₹ / Piece)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 899.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Style Notes & Description</label>
              <textarea
                rows={2}
                placeholder="Describe fits, stitching detailing, target fabric..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>
          </div>

          {/* Design Image Gallery */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Image</label>
            <ImageUpload
              value={images[0] || ""}
              onChange={(url) => setImages([url])}
              onRemove={() => setImages([])}
              folder="design_catalogs"
              label="Upload Design Image"
            />
          </div>

          {/* Colours Config */}
          <div className="space-y-3 border-t border-[#F1F5F9] pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Colours</label>
              <button
                type="button"
                onClick={handleAddColour}
                className="text-xs text-[#6366F1] hover:underline font-bold flex items-center gap-1"
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
                    className="flex-1 h-9 px-3 border border-[#CBD5E1] rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#6366F1] outline-none"
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
                    className="w-9 h-9 p-0.5 border border-[#CBD5E1] rounded-lg cursor-pointer bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveColour(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-[#E5E7EB] gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] border border-[#CBD5E1] rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-[#5B63D3] hover:bg-[#4F55C3] rounded-lg disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create & Select Design"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
