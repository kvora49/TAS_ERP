"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { DeleteBrandDialog } from "./_components/DeleteBrandDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { MASTER_DATA_NAV } from "@/lib/moduleNav";
import { Pencil, Trash2, Plus, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useBrandsList } from "@/hooks/queries/useMasterData";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);

  // TanStack Query hook
  const { data: brandsData, isLoading: loading, error, refetch } = useBrandsList();

  const brands: Brand[] = brandsData?.brands || [];

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
          updated_at: editingBrand?.updated_at,
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
      queryClient.invalidateQueries({ queryKey: ["master-data", "brands"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  const handleOpenDelete = (brand: Brand) => {
    setDeletingBrand(brand);
    setDeleteOpen(true);
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
          <Image
            src={row.logo_url}
            alt={row.name}
            width={40}
            height={40}
            className="w-10 h-10 object-contain rounded border border-[var(--border)] bg-[var(--page-bg)] p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded border border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center text-[10px] font-bold text-[var(--text-faint)] uppercase">
            No Logo
          </div>
        ),
    },
    {
      key: "name",
      header: "Brand Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--primary)] cursor-pointer">
            {row.name}
          </span>
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
        <span className="font-mono text-xs text-[var(--text-primary)]">{row.gstin || "-"}</span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <span className="text-[var(--text-muted)] truncate max-w-xs block">
          {row.address || "-"}
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
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Brand"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Brand"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <ModuleSubNav items={MASTER_DATA_NAV} />
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

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load brands") : undefined}
        onRetry={refetch}
        isEmpty={filteredBrands.length === 0}
        emptyTitle="No Brands Found"
        emptyMessage="No brands configured yet. Click Add Brand to create your first apparel brand."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Brand
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={6}
      >
        {/* ── MOBILE: Brand Card List ── */}
        <div className="md:hidden space-y-3">
          {filteredBrands.map((brand) => (
            <div key={brand.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3 cursor-pointer"
              onClick={() => router.push(`/master-data/brands/${brand.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {brand.logo_url ? (
                    <Image src={brand.logo_url} alt={brand.name} width={40} height={40} className="w-10 h-10 object-contain rounded border border-[var(--border)] bg-[var(--page-bg)] p-1 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded border border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center text-[9px] font-bold text-[var(--text-faint)] uppercase shrink-0">No Logo</div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-[var(--primary)] text-sm">{brand.name}</p>
                      {brand.is_primary && (
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5"><Star size={8} className="fill-current" /> Primary</Badge>
                      )}
                    </div>
                    {brand.gstin && <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">GST: {brand.gstin}</p>}
                  </div>
                </div>
                <StatusBadge active={brand.is_active} />
              </div>

              {brand.address && <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-light)] pt-2 truncate">{brand.address}</p>}

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => handleOpenEdit(brand)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                ><Pencil size={12} /> Edit</button>
                <button type="button" onClick={() => handleOpenDelete(brand)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 flex items-center gap-1 cursor-pointer"
                ><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={filteredBrands}
            isLoading={false}
            total={filteredBrands.length}
            page={1}
            perPage={10}
            onPageChange={() => {}}
            onRowClick={(row) => router.push(`/master-data/brands/${row.id}`)}
            emptyMessage="No matching brands found."
          />
        </div>
      </PageState>


      {/* Add/Edit Shared Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingBrand ? "Edit Brand Details" : "Add New Brand"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Logo Upload */}
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Denim Co"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs font-semibold text-red-500">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* GSTIN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    GST Number
                  </label>
                  <input
                    type="text"
                    placeholder="15-character GSTIN"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono"
                    {...register("gstin")}
                  />
                </div>

                {/* State & State Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
                    {...register("state")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    State Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
                    {...register("state_code")}
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Address
                  </label>
                  <textarea
                    placeholder="Headquarters address"
                    rows={2}
                    className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all resize-none"
                    {...register("address")}
                  />
                </div>

                {/* Prefix series Pakka / Kacha */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Bill Series Prefix (Pakka)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TAX"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono"
                    {...register("bill_prefix_pakka")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Bill Series Prefix (Kacha)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. K"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono"
                    {...register("bill_prefix_kacha")}
                  />
                </div>

                {/* Design sequence configurations */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Design Prefix
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DZN"
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
                    {...register("design_prefix")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Separator
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all cursor-pointer"
                      {...register("design_separator")}
                    >
                      <option value=".">. (Dot)</option>
                      <option value="-">- (Dash)</option>
                      <option value="/">/ (Slash)</option>
                      <option value="_">_ (Underscore)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Digits
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all cursor-pointer"
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
              <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Primary Brand</h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                      Set this brand as default for sales transactions.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                    {...register("is_primary")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Status</h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                      Controls visibility in active lists and forms.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                    {...register("is_active")}
                  />
                </div>
              </div>

          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-muted)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={isSubmitting}
              variant="primary"
              className="h-10 px-4 text-sm font-semibold"
            >
              Save Brand
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Delete Brand Dialog */}
      <DeleteBrandDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        brand={deletingBrand}
        allBrands={brands}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["master-data", "brands"] })}
      />
    </div>
  );
}
