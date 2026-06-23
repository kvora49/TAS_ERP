"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, X, Image as ImageIcon, Star, HelpCircle, Palette } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Validation schema for sub-colour modal
const colorSchema = z.object({
  colour_name: z.string().min(1, "Colour Name is required"),
  colour_hex: z.string(),
  image_url: z.string().optional(),
});

type ColorFormValues = z.infer<typeof colorSchema>;

// Form validation schema for Design
const designSchema = z.object({
  brand_id: z.string().min(1, "Please select a Brand"),
  design_number: z.string().min(1, "Design Number is required"),
  name: z.string().min(2, "Design Name must be at least 2 characters"),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  season: z.string().optional(),
  gender: z.string().optional(),
  hsn_code: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()),
  size_set_id: z.string().optional(),
  sale_price: z.string().optional(),
  is_active: z.boolean(),
});

type DesignFormValues = z.infer<typeof designSchema>;

interface Brand {
  id: string;
  name: string;
  design_prefix: string | null;
  design_separator: string;
  design_digits: number;
  design_sequence: number;
  is_active: boolean;
}

interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
}

interface DesignColour {
  id?: string;
  colour_name: string;
  colour_hex: string | null;
  image_url: string | null;
}

interface Design {
  id: string;
  brand_id: string;
  design_number: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  season: string | null;
  gender: string | null;
  hsn_code: string | null;
  description: string | null;
  images: string[];
  size_set_id: string | null;
  sale_price: number | null;
  is_active: boolean;
  brand?: { name: string };
  size_set?: { name: string; sizes: string[] };
  design_colours?: DesignColour[];
  updated_at: string;
}

const CATEGORIES = ["Shirts", "Pants", "Jackets", "Suits", "T-shirts", "Polo", "Undergarments", "Other"];
const GENDERS = ["Unisex", "Mens", "Womens", "Kids Boys", "Kids Girls"];

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Editor screen toggle
  const [isEditing, setIsEditing] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<Design | null>(null);

  // Sub-modal for adding colors
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [activeColours, setActiveColours] = useState<DesignColour[]>([]);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDesign, setDeletingDesign] = useState<Design | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DesignFormValues>({
    resolver: zodResolver(designSchema),
  });

  // Color Subform
  const {
    register: registerColor,
    handleSubmit: handleSubmitColor,
    setValue: setValueColor,
    watch: watchColor,
    reset: resetColor,
    formState: { errors: colorErrors },
  } = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
  });

  const selectedBrandId = watch("brand_id");
  const uploadedImages = watch("images") || [];
  const colorImageUrl = watchColor("image_url");
  const colorHexValue = watchColor("colour_hex");

  // Fetch designs, brands, size sets
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDesigns, resBrands, resSizeSets] = await Promise.all([
        fetch("/api/master-data/designs"),
        fetch("/api/master-data/brands"),
        fetch("/api/master-data/size-sets"),
      ]);

      if (!resDesigns.ok) throw new Error("Failed to load designs");
      if (!resBrands.ok) throw new Error("Failed to load brands");
      if (!resSizeSets.ok) throw new Error("Failed to load size sets");

      const dData = await resDesigns.json();
      const bData = await resBrands.json();
      const sData = await resSizeSets.json();

      setDesigns(dData.designs || []);
      setBrands(bData.brands || []);
      setSizeSets(sData.sizeSets || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading page assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-generate design number when brand changes
  useEffect(() => {
    if (!isEditing || currentDesign || !selectedBrandId) return;

    const brand = brands.find((b) => b.id === selectedBrandId);
    if (brand) {
      const prefix = brand.design_prefix || "";
      const separator = brand.design_separator || ".";
      const digits = brand.design_digits || 4;
      const seq = brand.design_sequence || 1;
      const generated = `${prefix}${separator}${String(seq).padStart(digits, "0")}`;
      setValue("design_number", generated);
    }
  }, [selectedBrandId, brands, isEditing, currentDesign]);

  const handleOpenAdd = () => {
    setCurrentDesign(null);
    setActiveColours([]);
    reset({
      brand_id: brands.find((b) => b.is_active)?.id || "",
      design_number: "",
      name: "",
      category: "Shirts",
      sub_category: "",
      season: "",
      gender: "Unisex",
      hsn_code: "",
      description: "",
      images: [],
      size_set_id: sizeSets[0]?.id || "",
      sale_price: "0",
      is_active: true,
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (design: Design) => {
    setCurrentDesign(design);
    setActiveColours(design.design_colours || []);
    reset({
      brand_id: design.brand_id,
      design_number: design.design_number,
      name: design.name,
      category: design.category || "Shirts",
      sub_category: design.sub_category || "",
      season: design.season || "",
      gender: design.gender || "Unisex",
      hsn_code: design.hsn_code || "",
      description: design.description || "",
      images: design.images || [],
      size_set_id: design.size_set_id || "",
      sale_price: String(design.sale_price || 0),
      is_active: design.is_active,
    });
    setIsEditing(true);
  };

  const onSubmit = async (values: DesignFormValues) => {
    try {
      const url = currentDesign
        ? `/api/master-data/designs/${currentDesign.id}`
        : "/api/master-data/designs";

      const method = currentDesign ? "PUT" : "POST";

      const payload = {
        ...values,
        colours: activeColours,
        updated_at: currentDesign?.updated_at,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save design template");
      }

      toast.success(
        currentDesign ? "Design updated successfully" : "Design created successfully"
      );
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (design: Design) => {
    setDeletingDesign(design);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDesign) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/designs/${deletingDesign.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete design");
      }

      toast.success("Design deleted successfully");
      setDeleteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Add colour swatch handler
  const handleOpenAddColour = () => {
    resetColor({
      colour_name: "",
      colour_hex: "#6366F1",
      image_url: "",
    });
    setColorModalOpen(true);
  };

  const onAddColourSubmit = (values: ColorFormValues) => {
    setActiveColours([
      ...activeColours,
      {
        colour_name: values.colour_name,
        colour_hex: values.colour_hex,
        image_url: values.image_url || null,
      },
    ]);
    setColorModalOpen(false);
  };

  const removeColourSwatch = (index: number) => {
    setActiveColours(activeColours.filter((_, idx) => idx !== index));
  };

  const removeMainImage = (indexToRemove: number) => {
    setValue(
      "images",
      uploadedImages.filter((_, idx) => idx !== indexToRemove)
    );
  };

  const filteredDesigns = designs.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.design_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <>
          <PageHeader
            title="Designs Master"
            subtitle="Manage product design catalogs, catalog photos, and color sets"
            breadcrumbs={[
              { label: "Dashboard", href: "/" },
              { label: "Master Data" },
              { label: "Designs" },
            ]}
            searchPlaceholder="Search design name or SKU..."
            searchValue={search}
            onSearch={setSearch}
            actionLabel="Add Design"
            onAction={handleOpenAdd}
            actionIcon={<Plus size={16} className="text-white" />}
          />

          {/* Cards Grid layout for Designs */}
          {loading ? (
            <div className="py-20 text-center text-[#64748B] bg-white border border-[#E5E7EB] rounded-xl">
              <div className="flex justify-center items-center gap-2 text-sm font-semibold">
                <RefreshCw className="animate-spin" size={16} />
                Loading designs catalog...
              </div>
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div className="py-20 text-center text-[#64748B] bg-white border border-[#E5E7EB] rounded-xl flex flex-col items-center justify-center">
              <ImageIcon className="h-10 w-10 text-[#94A3B8] mb-3" />
              <h3 className="text-sm font-bold text-[#374151]">No Designs Created</h3>
              <p className="text-xs text-[#64748B] mt-1 mb-4">Set up style numbers and image swatches for production lots.</p>
              <button
                onClick={handleOpenAdd}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Add Design
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredDesigns.map((design) => {
                const coverImage = design.images?.[0];
                return (
                  <div
                    key={design.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                  >
                    {/* Catalog Image Swatch */}
                    <div className="aspect-[4/3] bg-[#F8FAFC] border-b border-[#E5E7EB] relative flex items-center justify-center overflow-hidden">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={design.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-[#CBD5E1]" />
                      )}
                      
                      {/* Active Status tag overlay */}
                      <div className="absolute top-2 left-2">
                        <StatusBadge active={design.is_active} />
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider">
                          {design.brand?.name || "Apparel Brand"}
                        </span>
                        <h4 className="font-bold text-[#0F172A] text-sm mt-0.5 truncate">{design.name}</h4>
                        
                        <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                          <span className="text-[#334155] font-bold bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                            {design.design_number}
                          </span>
                          {design.category && (
                            <span className="text-[#64748B] font-semibold">{design.category}</span>
                          )}
                        </div>
                      </div>

                      {/* Sizes & Colors preview */}
                      <div className="border-t border-[#F1F5F9] pt-3 flex items-center justify-between text-xs">
                        <div className="flex flex-wrap gap-1 max-w-[120px] overflow-hidden">
                          {design.size_set?.sizes && design.size_set.sizes.slice(0, 3).map((size) => (
                            <span key={size} className="text-[9px] font-bold text-[#475569] bg-[#E2E8F0] px-1 rounded">
                              {size}
                            </span>
                          ))}
                          {design.size_set?.sizes && design.size_set.sizes.length > 3 && (
                            <span className="text-[9px] font-bold text-[#64748B]">+ {design.size_set.sizes.length - 3}</span>
                          )}
                        </div>

                        {/* Colour circle indicators */}
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {design.design_colours && design.design_colours.slice(0, 4).map((c, i) => (
                            <span
                              key={i}
                              className="w-3.5 h-3.5 rounded-full border border-white ring-1 ring-black/10 inline-block shrink-0"
                              style={{ backgroundColor: c.colour_hex || "#6366F1" }}
                              title={c.colour_name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Price & Actions */}
                      <div className="border-t border-[#F1F5F9] pt-3 flex items-center justify-between">
                        <span className="font-bold text-xs text-[#0F172A]">
                          ₹{design.sale_price?.toLocaleString("en-IN") || "0.00"}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(design)}
                            className="w-7 h-7 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
                            title="Edit Design"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(design)}
                            className="w-7 h-7 rounded-lg border border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
                            title="Delete Design"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Full-page form structured as 3 white cards */
        <div className="space-y-6">
          <PageHeader
            title={currentDesign ? "Edit Design Template" : "Create Design Template"}
            subtitle="Configure style sheets, catalog image galleries, and SKU parameters"
            breadcrumbs={[
              { label: "Dashboard", href: "/" },
              { label: "Master Data", href: "/master-data/designs" },
              { label: "Designs Editor" },
            ]}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* CARD 1: Basic Info */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F3F4F6]">
                1. Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Design Name */}
                <div className="space-y-1.5 font-bold">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Design / Style Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vintage Denim Jacket"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs font-semibold text-[#DC2626]">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Brand Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Associated Brand *
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                    {...register("brand_id")}
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Design number input (Auto-generated but editable) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                    Design Number *
                    <span title="Auto-computed based on brand settings, editable.">
                      <HelpCircle size={12} className="text-[#94A3B8]" />
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                    {...register("design_number")}
                  />
                  {errors.design_number && (
                    <p className="text-xs font-semibold text-[#DC2626]">
                      {errors.design_number.message}
                    </p>
                  )}
                </div>

                {/* Size Set */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Sizing Scale (Size Set) *
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                    {...register("size_set_id")}
                  >
                    <option value="">— Select Size Set —</option>
                    {sizeSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.sizes.join(", ")})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Category
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                    {...register("category")}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Sub-Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Slim-fit, Crewneck"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                    {...register("sub_category")}
                  />
                </div>

                {/* Season */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Collection / Season
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Summer 2026, Festive"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                    {...register("season")}
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Target Demographics
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                    {...register("gender")}
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sale Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Target Sale Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                    {...register("sale_price")}
                  />
                </div>

                {/* HSN code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    HSN Code (HS Code)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6203"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                    {...register("hsn_code")}
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Style Notes & Description
                  </label>
                  <textarea
                    placeholder="Describe fits, stitching detailing, target fabric, packaging guidelines..."
                    rows={2}
                    className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                    {...register("description")}
                  />
                </div>

                {/* Status */}
                <div className="flex items-center justify-between sm:col-span-1 pt-4 self-center">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A]">Active Catalog Item</h4>
                    <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-none">
                      Allows creation of active production lots.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                    {...register("is_active")}
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Images flex upload grid */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F3F4F6]">
                2. Design Image Gallery
              </h3>

              <div className="flex flex-wrap gap-4 items-start">
                {/* flex image grid */}
                {uploadedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="w-[140px] aspect-[4/3] rounded-lg border border-[#E5E7EB] relative overflow-hidden bg-[#F8FAFC] flex items-center justify-center shadow-sm group"
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    
                    {/* absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 x icon */}
                    <button
                      type="button"
                      onClick={() => removeMainImage(idx)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
                      title="Remove image"
                    >
                      <X size={12} className="stroke-[3]" />
                    </button>
                  </div>
                ))}

                {/* Dashed "+" slot for R2 upload */}
                <div className="w-[140px] aspect-[4/3] border border-dashed border-[#D1D5DB] rounded-lg bg-[#F8FAFC] flex items-center justify-center p-2 relative">
                  <ImageUpload
                    value=""
                    folder="design_catalogs"
                    onChange={(url) => {
                      if (url) {
                        setValue("images", [...uploadedImages, url]);
                      }
                    }}
                    onRemove={() => {}}
                    label="+"
                    className="border-none w-full h-full p-0 flex flex-col justify-center text-xs font-bold text-[#6366F1]"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: Colours Swatches */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F3F4F6]">
                3. Colour swatches & thumbnails
              </h3>

              <div className="flex flex-wrap gap-4 items-center">
                {/* Chip list showing color details */}
                {activeColours.map((col, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
                  >
                    {/* 40x40 thumbnail or hex */}
                    {col.image_url ? (
                      <img
                        src={col.image_url}
                        alt={col.colour_name}
                        className="w-10 h-10 rounded-lg object-cover border border-[#E5E7EB]"
                      />
                    ) : (
                      <span
                        className="w-10 h-10 rounded-lg border border-black/10 inline-block shrink-0 shadow-inner"
                        style={{ backgroundColor: col.colour_hex || "#6366F1" }}
                      />
                    )}

                    <div className="pr-2">
                      <span className="text-sm font-medium text-[#0F172A] block leading-none mb-1">
                        {col.colour_name}
                      </span>
                      <span className="text-[10px] font-bold font-mono text-[#64748B]">
                        {col.colour_hex}
                      </span>
                    </div>

                    {/* close button styled with text-[#94A3B8] */}
                    <button
                      type="button"
                      onClick={() => removeColourSwatch(idx)}
                      className="text-[#94A3B8] hover:text-red-500 cursor-pointer p-0.5 hover:bg-red-50 rounded transition-colors"
                      title="Remove Color"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                {/* Last chip in list: dashed border with plus icon and "Add Colour" */}
                <button
                  type="button"
                  onClick={handleOpenAddColour}
                  className="w-[140px] h-[66px] border border-dashed border-[#CBD5E1] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#6366F1] hover:text-[#4F46E5] hover:bg-[#F8FAFC] hover:border-[#6366F1] transition-all cursor-pointer shadow-sm bg-white"
                >
                  <Plus size={16} className="text-[#6366F1]" />
                  <span>Add Colour</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pb-8">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-10 px-5 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer"
              >
                Back to List
              </button>
              <button
                type="submit"
                className="h-10 px-6 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all shadow-md shadow-[#6366F1]/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Save Design
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Colour Modal */}
      <Dialog open={colorModalOpen} onOpenChange={setColorModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A] flex items-center gap-1.5">
              <Palette size={18} className="text-[#6366F1]" /> Add Colour Specification
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitColor(onAddColourSubmit)} className="space-y-4 pt-2">
            {/* Colour Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Colour Swatch Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Navy Blue, Emerald Green"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...registerColor("colour_name")}
              />
              {colorErrors.colour_name && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {colorErrors.colour_name.message}
                </p>
              )}
            </div>

            {/* Colour Hex value */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Visual Swatch Hex
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="w-10 h-10 border border-[#D1D5DB] rounded-lg cursor-pointer p-0 bg-transparent"
                  {...registerColor("colour_hex")}
                />
                <span className="text-xs font-mono font-medium text-[#475569]">{colorHexValue}</span>
              </div>
            </div>

            {/* Colour Swatch R2 image (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Fabric Pattern Photo (Optional)
              </label>
              <ImageUpload
                value={colorImageUrl}
                folder="design_colours"
                onChange={(url) => setValueColor("image_url", url)}
                onRemove={() => setValueColor("image_url", "")}
                label="Upload Pattern Swatch"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setColorModalOpen(false)}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#6366F1]/10"
              >
                Add Colour
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Design?"
        description={`Are you sure you want to delete design "${deletingDesign?.name}"? Historical stock records will remain, but new job orders cannot select this design number.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
