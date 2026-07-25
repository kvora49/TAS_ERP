"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

    // Check stock status on open
    const checkStock = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/master-data/brands/${brand.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check brand stock");
        const data = await res.json();
        setStockInfo(data);

        if (!data.hasStock) {
          setMode("force"); // Direct simple delete when no stock/designs
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 text-left">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Tag size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                Delete Brand
              </DialogTitle>
              <p className="text-xs font-medium text-[#64748B]">
                {brand.name}
              </p>
            </div>
          </div>
        </DialogHeader>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <p className="text-xs text-[#64748B]">Checking brand designs and stock...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {stockInfo?.hasStock ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Linked Designs / Stock Detected</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This brand has <strong>{stockInfo.designsCount} linked designs</strong>,{" "}
                  <strong>{stockInfo.lotsCount} production lots</strong>, and{" "}
                  <strong>{stockInfo.totalQuantity} items in finished stock</strong>. Please choose how you wish to proceed.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to delete <strong>{brand.name}</strong>? This brand contains no active stock or designs and will be safely soft-deleted.
              </p>
            )}

            {stockInfo?.hasStock && mode === "choose" && (
              <div className="grid grid-cols-1 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("transfer")}
                  className="p-3.5 border-2 border-indigo-100 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
                >
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] group-hover:text-indigo-600 transition-colors">
                      Option 1: Transfer Designs & Stock to Another Brand (Recommended)
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Re-assigns all designs, stock, and lots to a selected target brand.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("force")}
                  className="p-3.5 border border-red-100 hover:border-red-400 bg-red-50/30 hover:bg-red-50 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
                >
                  <Trash2 className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-red-900">
                      Option 2: Force Delete (Write-off Stock & Deactivate Designs)
                    </h4>
                    <p className="text-[11px] text-red-700/80 mt-0.5">
                      Zeros out physical finished stock while keeping all historical invoices, payments, and cost calculations untouched.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "transfer" && (
              <div className="space-y-3 pt-2 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                <label className="text-xs font-bold text-[#374151] block">
                  Select Destination Target Brand <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetBrandId}
                  onChange={(e) => setTargetBrandId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Target Brand...</option>
                  {otherBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B]">
                  All designs and production lots will be re-assigned to this brand before soft-deleting {brand.name}.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  &larr; Back to choices
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "force" && (
              <div className="bg-red-50/60 border border-red-200 p-4 rounded-xl space-y-2">
                <p className="text-xs text-red-800 font-medium leading-relaxed">
                  <strong>Warning:</strong> Force deleting will write-off active stock and mark designs as inactive. Historical accounting records remain safe.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  &larr; Back to choices
                </button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-[#64748B] hover:bg-slate-50 transition-all cursor-pointer"
          >
            Cancel
          </button>

          {(!stockInfo?.hasStock || mode === "force") && (
            <button
              type="button"
              onClick={() => handleDelete("force")}
              disabled={loading || checking}
              className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all cursor-pointer flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Brand"}
            </button>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <button
              type="button"
              onClick={() => handleDelete("transfer")}
              disabled={loading || !targetBrandId}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Transfer & Delete Brand
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
