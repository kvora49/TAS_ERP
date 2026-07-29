"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { AlertTriangle, ArrowRightLeft, Trash2, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Brand {
  id: string;
  name: string;
}

interface DeleteBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand | null;
  allBrands: Brand[];
  onSuccess: () => void;
}

export function DeleteBrandDialog({
  open,
  onOpenChange,
  brand,
  allBrands,
  onSuccess,
}: DeleteBrandDialogProps) {
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const [stockInfo, setStockInfo] = useState<{
    hasStock: boolean;
    stockCount: number;
    totalQuantity: number;
    designsCount: number;
    lotsCount: number;
  } | null>(null);

  const [mode, setMode] = useState<"choose" | "transfer" | "force">("choose");
  const [targetBrandId, setTargetBrandId] = useState<string>("");

  const otherBrands = allBrands.filter((b) => b.id !== brand?.id);

  useEffect(() => {
    if (!open || !brand) {
      setStockInfo(null);
      setMode("choose");
      setTargetBrandId("");
      return;
    }

    const checkStock = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/master-data/brands/${brand.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check brand stock");
        const data = await res.json();
        setStockInfo(data);

        if (!data.hasStock) {
          setMode("force");
        } else {
          setMode("choose");
        }
      } catch (err: any) {
        toast.error(err.message || "Error checking stock");
      } finally {
        setChecking(false);
      }
    };

    checkStock();
  }, [open, brand]);

  const handleDelete = async (actionType: "transfer" | "force") => {
    if (!brand) return;

    if (actionType === "transfer" && !targetBrandId) {
      toast.error("Please select a target brand to transfer items to");
      return;
    }

    setLoading(true);
    try {
      let url = `/api/master-data/brands/${brand.id}?action=${actionType}`;
      if (actionType === "transfer") {
        url += `&target_brand_id=${targetBrandId}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete brand");
      }

      toast.success(data.message || "Brand deleted successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setLoading(false);
    }
  };

  if (!brand) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Tag size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--text-primary)]">Delete Brand</div>
            <p className="text-xs font-medium text-[var(--text-muted)]">{brand.name}</p>
          </div>
        </div>
      }
      maxWidth="max-w-[480px]"
    >
      {checking ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Checking brand designs and stock...</p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {stockInfo?.hasStock ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <AlertTriangle size={16} className="shrink-0" />
                <span>Linked Designs / Stock Detected</span>
              </div>
              <p className="text-xs text-[var(--text-body)] leading-relaxed">
                This brand has <strong>{stockInfo.designsCount} linked designs</strong>,{" "}
                <strong>{stockInfo.lotsCount} production lots</strong>, and{" "}
                <strong>{stockInfo.totalQuantity} items in finished stock</strong>. Please choose how you wish to proceed.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{brand.name}</strong>? This brand contains no active stock or designs and will be safely soft-deleted.
            </p>
          )}

          {stockInfo?.hasStock && mode === "choose" && (
            <div className="grid grid-cols-1 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMode("transfer")}
                className="p-3.5 border-2 border-[var(--primary-light)] hover:border-[var(--primary)] bg-[var(--primary-light)]/40 hover:bg-[var(--primary-light)] rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
              >
                <ArrowRightLeft className="w-5 h-5 text-[var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                    Option 1: Transfer Designs & Stock to Another Brand (Recommended)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Re-assigns all designs, stock, and lots to a selected target brand.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("force")}
                className="p-3.5 border border-red-500/20 hover:border-red-500/40 bg-red-500/10 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
              >
                <Trash2 className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-red-500">
                    Option 2: Force Delete (Write-off Stock & Deactivate Designs)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Zeros out physical finished stock while keeping all historical invoices, payments, and cost calculations untouched.
                  </p>
                </div>
              </button>
            </div>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <div className="space-y-3 pt-2 bg-[var(--page-bg)] p-4 border border-[var(--border)] rounded-xl">
              <label className="text-xs font-bold text-[var(--text-primary)] block">
                Select Destination Target Brand <span className="text-red-500">*</span>
              </label>
              <select
                value={targetBrandId}
                onChange={(e) => setTargetBrandId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">Select Target Brand...</option>
                {otherBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-muted)]">
                All designs and production lots will be re-assigned to this brand before soft-deleting {brand.name}.
              </p>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-xs text-[var(--primary)] font-bold hover:underline cursor-pointer"
              >
                &larr; Back to choices
              </button>
            </div>
          )}

          {stockInfo?.hasStock && mode === "force" && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2">
              <p className="text-xs text-[var(--text-body)] font-medium leading-relaxed">
                <strong>Warning:</strong> Force deleting will write-off active stock and mark designs as inactive. Historical accounting records remain safe.
              </p>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-xs text-[var(--primary)] font-bold hover:underline cursor-pointer"
              >
                &larr; Back to choices
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="h-9 px-4 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
        >
          Cancel
        </button>

        {(!stockInfo?.hasStock || mode === "force") && (
          <AsyncButton
            variant="destructive"
            onClick={() => handleDelete("force")}
            isLoading={loading || checking}
            className="h-9 px-4 text-xs font-semibold"
          >
            {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Brand"}
          </AsyncButton>
        )}

        {stockInfo?.hasStock && mode === "transfer" && (
          <AsyncButton
            variant="primary"
            onClick={() => handleDelete("transfer")}
            disabled={!targetBrandId}
            isLoading={loading}
            className="h-9 px-4 text-xs font-semibold"
          >
            Transfer & Delete Brand
          </AsyncButton>
        )}
      </div>
    </Modal>
  );
}
