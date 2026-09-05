"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTableColumn } from "@/components/tables/DataTable";
import { NumericInput } from "@/components/ui/numeric-input";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { Pencil, Trash2, Plus, RefreshCw, X, Image as ImageIcon, Star, HelpCircle, Palette, Eye, Boxes, Layers, LayoutGrid, Filter, Search, Tag, ChevronDown, Calculator, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import MainDesignStockFiltersPanel from "./_components/MainDesignStockFiltersPanel";
import { useGstRateLookup } from "@/hooks/useGstRateLookup";

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
  hsn_code: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()),
  size_set_id: z.string().optional(),
  sale_price: z.number().optional(),
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
  total_quantity?: number;
  total_value?: number;
  updated_at: string;
}

const CATEGORIES = ["Shirts", "Pants", "Jackets", "Suits", "T-shirts", "Polo", "Undergarments", "Other"];
const GENDERS = ["Unisex", "Mens", "Womens", "Kids Boys", "Kids Girls"];

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Brand-wise & Filter states
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedGodownFilter, setSelectedGodownFilter] = useState<string>("all");
  const [panelFilters, setPanelFilters] = useState<any>({
    selectedGodown: "all",
    selectedDesign: "all",
    selectedColour: "all",
    selectedSize: "all",
    selectedLot: "all",
    stockType: "all",
    movementType: "all",
    viewMode: "design_wise",
    searchQuery: "",
  });
  const [viewMode, setViewMode] = useState<"grouped" | "grid">("grouped");

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

  const [selectedDesignDetails, setSelectedDesignDetails] = useState<Design | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DesignFormValues>({
    resolver: zodResolver(designSchema) as any,
  });

  const { lookupGst, hsnOptions } = useGstRateLookup();
  const watchHsn = watch("hsn_code");
  const watchSalePrice = watch("sale_price");
  const resolvedGst = lookupGst(watchHsn, Number(watchSalePrice || 0));

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

  // Fetch designs, brands, size sets, godowns
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDesigns, resBrands, resSizeSets, resGodowns] = await Promise.all([
        fetch("/api/finished-stock/designs"),
        fetch("/api/master-data/brands"),
        fetch("/api/master-data/size-sets"),
        fetch("/api/master-data/godowns"),
      ]);

      if (!resDesigns.ok) throw new Error("Failed to load designs");
      if (!resBrands.ok) throw new Error("Failed to load brands");
      if (!resSizeSets.ok) throw new Error("Failed to load size sets");

      const dData = await resDesigns.json();
      const bData = await resBrands.json();
      const sData = await resSizeSets.json();
      const gData = resGodowns.ok ? await resGodowns.json() : { godowns: [] };

      setDesigns(dData.designs || []);
      setBrands(bData.brands || []);
      setSizeSets(sData.sizeSets || []);
      setGodowns(gData.godowns || []);
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
      hsn_code: "",
      description: "",
      images: [],
      size_set_id: sizeSets[0]?.id || "",
      sale_price: undefined,
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
      hsn_code: design.hsn_code || "",
      description: design.description || "",
      images: design.images || [],
      size_set_id: design.size_set_id || "",
      sale_price: design.sale_price ?? undefined,
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

  // Brand counts map
  const brandCounts: Record<string, number> = {};
  designs.forEach((d) => {
    if (d.brand_id) {
      brandCounts[d.brand_id] = (brandCounts[d.brand_id] || 0) + 1;
    }
  });

  const filteredDesigns = designs.filter((d: any) => {
    const s = (panelFilters?.searchQuery || search || "").trim().toLowerCase();
    const matchesSearch =
      !s ||
      d.name?.toLowerCase().includes(s) ||
      d.design_number?.toLowerCase().includes(s) ||
      d.brand?.name?.toLowerCase().includes(s) ||
      d.category?.toLowerCase().includes(s) ||
      d.sub_category?.toLowerCase().includes(s) ||
      d.season?.toLowerCase().includes(s) ||
      d.hsn_code?.toLowerCase().includes(s);

    const matchesBrand = selectedBrandFilter === "all" || d.brand_id === selectedBrandFilter;
    const matchesCategory = selectedCategoryFilter === "all" || d.category === selectedCategoryFilter;
    const matchesStatus =
      selectedStatusFilter === "all" ||
      (selectedStatusFilter === "active" ? d.is_active : !d.is_active);

    const matchesDesign =
      !panelFilters?.selectedDesign ||
      panelFilters.selectedDesign === "all" ||
      d.id === panelFilters.selectedDesign;

    const matchesColour =
      !panelFilters?.selectedColour ||
      panelFilters.selectedColour === "all" ||
      d.design_colours?.some(
        (c: any) => c.colour_name?.toLowerCase() === panelFilters.selectedColour.toLowerCase()
      );

    const matchesSize =
      !panelFilters?.selectedSize ||
      panelFilters.selectedSize === "all" ||
      d.size_set?.sizes?.includes(panelFilters.selectedSize);

    return (
      matchesSearch &&
      matchesBrand &&
      matchesCategory &&
      matchesStatus &&
      matchesDesign &&
      matchesColour &&
      matchesSize
    );
  });

  // Group designs by Brand for the brand-wise section view
  const groupedByBrand = brands
    .map((brand) => {
      const brandDesigns = filteredDesigns.filter((d) => d.brand_id === brand.id);
      const totalPcs = brandDesigns.reduce((acc, curr) => acc + (curr.total_quantity || 0), 0);
      const totalVal = brandDesigns.reduce((acc, curr) => {
        const qty = curr.total_quantity || 0;
        const val = curr.total_value || 0;
        if (val > 0) return acc + val;
        const sp = Number(curr.sale_price || 0);
        const uc = sp > 0 ? Math.round(sp * 0.6) : 150;
        return acc + (qty * uc);
      }, 0);
      return {
        brand,
        designs: brandDesigns,
        totalPcs,
        totalVal,
      };
    })
    .filter((g) => g.designs.length > 0);

  const unbrandedDesigns = filteredDesigns.filter(
    (d) => !d.brand_id || !brands.some((b) => b.id === d.brand_id)
  );

  const renderDesignCard = (design: any) => {
    const coverImage = design.images?.[0];
    const stockQty = design.total_quantity || 0;
    const salePrice = Number(design.sale_price || 0);
    const unitCostFallback = salePrice > 0 ? Math.round(salePrice * 0.6) : 150;
    const stockVal = (design.total_value && design.total_value > 0)
      ? design.total_value
      : (stockQty > 0 ? Math.round(stockQty * unitCostFallback) : 0);

    return (
      <div
        key={design.id}
        className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all flex flex-col group"
      >
        {/* Catalog Image Swatch */}
        <Link
          href={`/master-data/designs/${design.id}`}
          className="aspect-[4/3] bg-[var(--page-bg)] border-b border-[var(--border)] relative flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt={design.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-[var(--text-faint)]" />
          )}

          {/* Active Status tag overlay */}
          <div className="absolute top-2 left-2">
            <StatusBadge active={design.is_active} />
          </div>
        </Link>

        {/* Meta info */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">
                {design.brand?.name || "Apparel Brand"}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--page-bg)] px-1.5 py-0.5 rounded font-mono border border-[var(--border)]">
                {design.design_number}
              </span>
            </div>

            <Link
              href={`/master-data/designs/${design.id}`}
              className="font-bold text-[var(--text-primary)] hover:text-[var(--primary)] text-sm mt-0.5 truncate block w-full transition-colors"
            >
              {design.name}
            </Link>

            {design.category && (
              <span className="text-xs text-[var(--text-muted)] font-semibold block mt-0.5">
                {design.category} {design.sub_category ? `• ${design.sub_category}` : ""}
              </span>
            )}
          </div>

          {/* Sizes & Colors preview */}
          <div className="border-t border-[var(--border-light)] pt-3 flex items-center justify-between text-xs">
            <div className="flex flex-wrap gap-1 max-w-[120px] overflow-hidden">
              {design.size_set?.sizes &&
                design.size_set.sizes.slice(0, 3).map((size: string) => (
                  <span
                    key={size}
                    className="text-[9px] font-bold text-[var(--text-secondary)] bg-[var(--page-bg)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                  >
                    {size}
                  </span>
                ))}
              {design.size_set?.sizes && design.size_set.sizes.length > 3 && (
                <span className="text-[9px] font-bold text-[var(--text-muted)]">
                  + {design.size_set.sizes.length - 3}
                </span>
              )}
            </div>

            {/* Colour circle indicators */}
            <div className="flex -space-x-1.5 overflow-hidden">
              {design.design_colours &&
                design.design_colours.slice(0, 4).map((c: any, i: number) => (
                  <span
                    key={i}
                    className="w-3.5 h-3.5 rounded-full border border-white ring-1 ring-black/10 inline-block shrink-0"
                    style={{ backgroundColor: c.colour_hex || "#6366F1" }}
                    title={c.colour_name}
                  />
                ))}
            </div>
          </div>

          {/* Stock Summary Section */}
          <div className="border-t border-b border-[var(--border-light)] py-2.5 grid grid-cols-2 gap-2 text-xs bg-[var(--page-bg)] rounded-lg px-2.5">
            <div>
              <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block">
                Stock On Hand
              </span>
              <span className="font-extrabold text-[var(--text-primary)] text-xs">
                {stockQty.toLocaleString()} pcs
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block">
                Stock Value
              </span>
              <span className="font-extrabold text-emerald-500 text-xs">
                ₹{stockVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Price & Actions */}
          <div className="pt-1 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-bold text-[var(--text-faint)] block uppercase">
                Sale Price
              </span>
              <span className="font-bold text-xs text-[var(--text-primary)]">
                ₹{design.sale_price?.toLocaleString("en-IN") || "0.00"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href={`/master-data/designs/${design.id}`}
                className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
                title="View Design Details & Stock"
              >
                <Eye size={13} />
              </Link>
              <button
                onClick={() => handleOpenEdit(design)}
                className="w-7 h-7 rounded-lg border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
                title="Edit Design"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleOpenDelete(design)}
                className="w-7 h-7 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
                title="Delete Design"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {!isEditing ? (
        <>
          <PageHeader
            title="Designs Master"
            subtitle="Manage product design catalogs, catalog photos, and color sets brand-wise"
            breadcrumbs={[
              { label: "Dashboard", href: "/" },
              { label: "Master Data" },
              { label: "Designs" },
            ]}
            actionLabel="Add Design"
            onAction={handleOpenAdd}
            actionIcon={<Plus size={16} className="text-white" />}
          />

          {/* 10-DIMENSIONAL DESIGN STOCK FILTERS & ANALYSIS PANEL */}
          <MainDesignStockFiltersPanel onFilterChange={setPanelFilters} />

          {/* CONTENT AREA */}
          {loading ? (
            <div className="py-20 text-center text-[var(--text-muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl">
              <div className="flex justify-center items-center gap-2 text-sm font-semibold">
                <RefreshCw className="animate-spin" size={16} />
                Loading designs catalog...
              </div>
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div className="py-20 text-center text-[var(--text-muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl flex flex-col items-center justify-center">
              <ImageIcon className="h-10 w-10 text-[var(--text-faint)] mb-3" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">No Designs Found</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
                No designs match your selected brand or filters.
              </p>
              <button
                onClick={handleOpenAdd}
                className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Add Design
              </button>
            </div>
          ) : viewMode === "grouped" && selectedBrandFilter === "all" ? (
            /* BRAND SECTIONS GROUPED VIEW */
            <div className="space-y-8">
              {groupedByBrand.map(({ brand, designs: bDesigns, totalPcs, totalVal }) => (
                <div
                  key={brand.id}
                  className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4"
                >
                  {/* Brand Section Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[var(--border)] gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[var(--primary-light)] rounded-lg text-[var(--primary)]">
                        <Tag className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-[var(--text-primary)]">
                            {brand.name}
                          </h2>
                          {brand.design_prefix && (
                            <span className="text-[10px] font-mono font-bold bg-[var(--page-bg)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                              Prefix: {brand.design_prefix}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          {bDesigns.length} Design{bDesigns.length === 1 ? "" : "s"} Catalogued
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs bg-[var(--page-bg)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                      <div>
                        <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block">
                          Total Stock
                        </span>
                        <span className="font-extrabold text-[var(--text-primary)]">
                          {totalPcs.toLocaleString()} pcs
                        </span>
                      </div>
                      <div className="w-px h-6 bg-[var(--border)]" />
                      <div>
                        <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase block">
                          Stock Value
                        </span>
                        <span className="font-extrabold text-emerald-500">
                          ₹{totalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Design Cards Grid for Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {bDesigns.map(renderDesignCard)}
                  </div>
                </div>
              ))}

              {unbrandedDesigns.length > 0 && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
                  <div className="pb-3 border-b border-[var(--border)]">
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      Unassigned Brand Designs
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">
                      {unbrandedDesigns.length} Designs
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {unbrandedDesigns.map(renderDesignCard)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* FLAT GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredDesigns.map(renderDesignCard)}
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
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-6 shadow-[var(--shadow-sm)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-light)]">
                1. Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Design Name */}
                <div className="space-y-1.5 font-bold">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Design / Style Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vintage Denim Jacket"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs font-semibold text-red-500">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Brand Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Associated Brand *
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all cursor-pointer font-semibold"
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
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    Design Number *
                    <span title="Auto-computed based on brand settings, editable.">
                      <HelpCircle size={12} className="text-[var(--text-faint)]" />
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-mono"
                    {...register("design_number")}
                  />
                  {errors.design_number && (
                    <p className="text-xs font-semibold text-red-500">
                      {errors.design_number.message}
                    </p>
                  )}
                </div>

                {/* Size Set */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Sizing Scale (Size Set) *
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all cursor-pointer font-semibold"
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
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Category
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all cursor-pointer font-semibold"
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
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Sub-Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Slim-fit, Crewneck"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
                    {...register("sub_category")}
                  />
                </div>

                {/* Season */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Collection / Season
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Summer 2026, Festive"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
                    {...register("season")}
                  />
                </div>

                {/* Wholesale / Sale Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Sale Price (₹ / Piece)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 750.00"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-mono font-semibold"
                    {...register("sale_price", { valueAsNumber: true })}
                  />
                  {errors.sale_price && (
                    <p className="text-xs font-semibold text-red-500">
                      {errors.sale_price.message}
                    </p>
                  )}
                </div>

                {/* HSN code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    HSN Code (HS Code)
                  </label>
                  <input
                    type="text"
                    list="designs-hsn-datalist"
                    placeholder="e.g. 6203, 6109, 6204"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-mono"
                    {...register("hsn_code")}
                  />
                  <datalist id="designs-hsn-datalist">
                    {hsnOptions.map((opt) => (
                      <option key={opt.hsn_code} value={opt.hsn_code}>
                        {opt.label}
                      </option>
                    ))}
                  </datalist>
                  {resolvedGst && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--primary)] font-semibold">
                      <span>GST Rate: {resolvedGst.gstPercent}%</span>
                      {resolvedGst.isAutoTier && (
                        <span className="text-[10px] text-[var(--text-muted)] font-normal">
                          (Auto-tier slab: &le; ₹{resolvedGst.matchedRate?.tier_threshold ?? 1000} &rarr; {resolvedGst.matchedRate?.tier_low_gst ?? 5}%, &gt; ₹{resolvedGst.matchedRate?.tier_threshold ?? 1000} &rarr; {resolvedGst.matchedRate?.tier_high_gst ?? 12}%)
                        </span>
                      )}
                    </div>
                  )}
                  {!resolvedGst && watchHsn && watchHsn.trim().length > 0 && (
                    <p className="text-[10px] text-amber-500 mt-1">
                      HSN code not found in GST Rates master (will use default billing rate).
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Style Notes & Description
                  </label>
                  <textarea
                    placeholder="Describe fits, stitching detailing, target fabric, packaging guidelines..."
                    rows={2}
                    className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all resize-none"
                    {...register("description")}
                  />
                </div>

                {/* Status */}
                <div className="flex items-center justify-between sm:col-span-1 pt-4 self-center">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Catalog Item</h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 leading-none">
                      Allows creation of active production lots.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--input-focus)] border-[var(--border)] rounded cursor-pointer"
                    {...register("is_active")}
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Images flex upload grid */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-6 shadow-[var(--shadow-sm)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-light)]">
                2. Design Image Gallery
              </h3>

              <div className="flex flex-wrap gap-4 items-start">
                {/* flex image grid */}
                {uploadedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="w-[140px] aspect-[4/3] rounded-lg border border-[var(--border)] relative overflow-hidden bg-[var(--page-bg)] flex items-center justify-center shadow-sm group"
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
                <div className="w-[140px] aspect-[4/3] border border-dashed border-[var(--border)] rounded-lg bg-[var(--page-bg)] flex items-center justify-center p-2 relative">
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
                    className="border-none w-full h-full p-0 flex flex-col justify-center text-xs font-bold text-[var(--primary)]"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: Colours Swatches */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-6 shadow-[var(--shadow-sm)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-light)]">
                3. Colour swatches & thumbnails
              </h3>

              <div className="flex flex-wrap gap-4 items-center">
                {/* Chip list showing color details */}
                {activeColours.map((col, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
                  >
                    {/* 40x40 thumbnail or hex */}
                    {col.image_url ? (
                      <img
                        src={col.image_url}
                        alt={col.colour_name}
                        className="w-10 h-10 rounded-lg object-cover border border-[var(--border)]"
                      />
                    ) : (
                      <span
                        className="w-10 h-10 rounded-lg border border-[var(--border)] inline-block shrink-0 shadow-inner"
                        style={{ backgroundColor: col.colour_hex || "var(--primary)" }}
                      />
                    )}

                    <div className="pr-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] block leading-none mb-1">
                        {col.colour_name}
                      </span>
                      <span className="text-[10px] font-bold font-mono text-[var(--text-muted)]">
                        {col.colour_hex}
                      </span>
                    </div>

                    {/* close button */}
                    <button
                      type="button"
                      onClick={() => removeColourSwatch(idx)}
                      className="text-[var(--text-faint)] hover:text-red-500 cursor-pointer p-0.5 hover:bg-red-500/10 rounded transition-colors"
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
                  className="w-[140px] h-[66px] border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer shadow-sm bg-[var(--card-bg)]"
                >
                  <Plus size={16} />
                  <span>Add Colour</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pb-8">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-10 px-5 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              >
                Back to List
              </button>
              <button
                type="submit"
                className="h-10 px-6 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all shadow-md shadow-[var(--primary)]/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Save Design
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Colour Modal */}
      <Modal
        open={colorModalOpen}
        onOpenChange={setColorModalOpen}
        title={
          <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <Palette size={18} className="text-[var(--primary)]" /> Add Colour Specification
          </span>
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmitColor(onAddColourSubmit)} className="space-y-4 pt-2">
          {/* Colour Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Colour Swatch Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Navy Blue, Emerald Green"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
              {...registerColor("colour_name")}
            />
            {colorErrors.colour_name && (
              <p className="text-xs font-semibold text-red-500">
                {colorErrors.colour_name.message}
              </p>
            )}
          </div>

          {/* Colour Hex value */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Visual Swatch Hex
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 border border-[var(--input-border)] rounded-lg cursor-pointer p-0 bg-transparent"
                {...registerColor("colour_hex")}
              />
              <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">{colorHexValue}</span>
            </div>
          </div>

          {/* Colour Swatch R2 image (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
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

          <div className="pt-4 border-t border-[var(--border-light)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setColorModalOpen(false)}
              className="h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--primary)]/10"
            >
              Add Colour
            </button>
          </div>
        </form>
      </Modal>

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
