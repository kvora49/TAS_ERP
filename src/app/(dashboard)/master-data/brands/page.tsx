"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Star, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const brandSchema = z.object({
  name: z.string().min(2, "Brand Name must be at least 2 characters"),
  gstin: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
  logo_url: z.string().optional(),
  bill_prefix_pakka: z.string().optional(),
  bill_prefix_kacha: z.string().optional(),
  design_prefix: z.string().optional(),
  design_separator: z.string(),
  design_digits: z.string(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});

type BrandFormValues = z.infer<typeof brandSchema>;

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  gstin: string | null;
  address: string | null;
  state: string | null;
  state_code: string | null;
  bill_prefix_pakka: string | null;
  bill_prefix_kacha: string | null;
  design_prefix: string | null;
  design_separator: string;
  design_digits: number;
  is_primary: boolean;
  is_active: boolean;
  updated_at: string;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [selectedBrandDetails, setSelectedBrandDetails] = useState<Brand | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
  });

  const logoUrl = watch("logo_url");

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/brands");
      if (!res.ok) throw new Error("Failed to load brands");
      const result = await res.json();
      setBrands(result.brands || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching brands list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleOpenAdd = () => {
    setEditingBrand(null);
    reset({
      name: "",
      gstin: "",
      address: "",
      state: "",
      state_code: "",
      logo_url: "",
      bill_prefix_pakka: "",
      bill_prefix_kacha: "",
      design_prefix: "",
      design_separator: ".",
      design_digits: "4",
      is_primary: false,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (brand: Brand) => {
    setEditingBrand(brand);
    reset({
      name: brand.name,
      gstin: brand.gstin || "",
      address: brand.address || "",
      state: brand.state || "",
      state_code: brand.state_code || "",
      logo_url: brand.logo_url || "",
      bill_prefix_pakka: brand.bill_prefix_pakka || "",
      bill_prefix_kacha: brand.bill_prefix_kacha || "",
      design_prefix: brand.design_prefix || "",
      design_separator: brand.design_separator || ".",
      design_digits: String(brand.design_digits || 4),
      is_primary: brand.is_primary,
      is_active: brand.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: BrandFormValues) => {
    try {
      const url = editingBrand
        ? `/api/master-data/brands/${editingBrand.id}`
        : "/api/master-data/brands";
      
      const method = editingBrand ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingBrand?.updated_at, // Optimistic Lock Check
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save brand");
      }

      toast.success(
        editingBrand
          ? "Brand updated successfully"
          : "Brand created successfully"
      );
      setModalOpen(false);
      fetchBrands();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (brand: Brand) => {
    setDeletingBrand(brand);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBrand) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/brands/${deletingBrand.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete brand");
      }

      toast.success("Brand deleted successfully");
      setDeleteOpen(false);
      fetchBrands();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase()) ||
    (brand.gstin && brand.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<Brand>[] = [
    {
      key: "logo",
      header: "Logo",
      width: "80px",
      render: (row) =>
        row.logo_url ? (
          <img
            src={row.logo_url}
            alt={row.name}
            className="w-10 h-10 object-contain rounded border border-[#E5E7EB] bg-[#F8FAFC] p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded border border-[#E5E7EB] bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold text-[#94A3B8] uppercase">
            No Logo
          </div>
        ),
    },
    {
      key: "name",
      header: "Brand Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedBrandDetails(row)}
            className="font-bold text-[#6366F1] hover:underline cursor-pointer text-left bg-transparent border-0 p-0"
          >
            {row.name}
          </button>
          {row.is_primary && (
            <Badge variant="primary" className="gap-1 flex items-center">
              <Star size={10} className="fill-current" /> Primary
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "gstin",
      header: "GST Number",
      render: (row) => (
        <span className="font-mono text-xs">{row.gstin || "—"}</span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <span className="text-[#64748B] truncate max-w-xs block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={() => handleOpenEdit(row)}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Brand"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Brand"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        subtitle="Manage your apparel brand configurations and billing credentials"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Brands" },
        ]}
        searchPlaceholder="Search brand or GSTIN..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Brand"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filteredBrands}
        isLoading={loading}
        total={filteredBrands.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        emptyMessage="No brands configured yet. Click Add Brand to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingBrand ? "Edit Brand Details" : "Add New Brand"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo Upload */}
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Brand Logo
                </label>
                <ImageUpload
                  value={logoUrl}
                  folder="brand_logos"
                  onChange={(url) => setValue("logo_url", url)}
                  onRemove={() => setValue("logo_url", "")}
                  label="Upload Logo"
                />
              </div>

              {/* Brand Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Brand Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Denim Co"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* GSTIN */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  GST Number
                </label>
                <input
                  type="text"
                  placeholder="15-character GSTIN"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("gstin")}
                />
              </div>

              {/* State & State Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("state")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  State Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("state_code")}
                />
              </div>

              {/* Address */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Address
                </label>
                <textarea
                  placeholder="Headquarters address"
                  rows={2}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  {...register("address")}
                />
              </div>

              {/* Prefix series Pakka / Kacha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Bill Series Prefix (Pakka)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TAX"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("bill_prefix_pakka")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Bill Series Prefix (Kacha)
                </label>
                <input
                  type="text"
                  placeholder="e.g. K"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("bill_prefix_kacha")}
                />
              </div>

              {/* Design sequence configurations */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Design Prefix
                </label>
                <input
                  type="text"
                  placeholder="e.g. DZN"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("design_prefix")}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Separator
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer"
                    {...register("design_separator")}
                  >
                    <option value=".">. (Dot)</option>
                    <option value="-">- (Dash)</option>
                    <option value="/">/ (Slash)</option>
                    <option value="_">_ (Underscore)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Digits
                  </label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer"
                    {...register("design_digits")}
                  >
                    <option value="3">3 (e.g. 001)</option>
                    <option value="4">4 (e.g. 0001)</option>
                    <option value="5">5 (e.g. 00001)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Toggle options */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-[#F3F4F6]">
              {/* Primary Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Primary Brand</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Set this brand as default for sales transactions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_primary")}
                />
              </div>

              {/* Active Status Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Active Status</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Controls visibility in active lists and forms.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#6366F1]/10"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Brand"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Brand?"
        description={`Are you sure you want to delete brand "${deletingBrand?.name}"? All related inventory tags will lose alignment.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* View Brand Details Modal */}
      <Dialog open={selectedBrandDetails !== null} onOpenChange={(open) => !open && setSelectedBrandDetails(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#6366F1]" />
              Brand Details
            </DialogTitle>
          </DialogHeader>

          {selectedBrandDetails && (
            <div className="space-y-4 pt-3 text-sm text-[#374151]">
              <div className="flex items-center gap-4 border-b border-[#F3F4F6] pb-4">
                {selectedBrandDetails.logo_url ? (
                  <img
                    src={selectedBrandDetails.logo_url}
                    alt={selectedBrandDetails.name}
                    className="w-16 h-16 object-contain rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-1.5"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-[#E5E7EB] bg-[#F1F5F9] flex items-center justify-center text-xs font-bold text-[#94A3B8] uppercase">
                    No Logo
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-[#0F172A]">{selectedBrandDetails.name}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedBrandDetails.is_primary && (
                      <Badge variant="primary" className="gap-1 flex items-center text-[10px]">
                        <Star size={8} className="fill-current" /> Primary
                      </Badge>
                    )}
                    <StatusBadge active={selectedBrandDetails.is_active} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">GSTIN</span>
                  <span className="font-mono text-xs font-bold">{selectedBrandDetails.gstin || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">State & Code</span>
                  <span className="font-semibold text-xs text-[#334155]">
                    {selectedBrandDetails.state || "—"}{" "}
                    {selectedBrandDetails.state_code ? `(${selectedBrandDetails.state_code})` : ""}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Address</span>
                  <span className="font-semibold text-xs text-[#334155]">{selectedBrandDetails.address || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Bill Prefix (Pakka)</span>
                  <span className="font-mono font-bold text-xs">{selectedBrandDetails.bill_prefix_pakka || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Bill Prefix (Kacha)</span>
                  <span className="font-mono font-bold text-xs">{selectedBrandDetails.bill_prefix_kacha || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Design Prefix</span>
                  <span className="font-mono font-bold text-xs">{selectedBrandDetails.design_prefix || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Separator & Digits</span>
                  <span className="font-mono text-xs font-bold text-[#334155]">
                    Separator: &quot;{selectedBrandDetails.design_separator}&quot; | Digits: {selectedBrandDetails.design_digits}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <button
              onClick={() => setSelectedBrandDetails(null)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
