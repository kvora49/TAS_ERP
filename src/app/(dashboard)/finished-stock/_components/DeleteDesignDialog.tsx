"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRightLeft, Trash2, Shirt, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Design {
  id: string;
  name: string;
  design_number?: string;
}

interface DeleteDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: Design | null;
  allDesigns: Design[];
  onSuccess: () => void;
}

export function DeleteDesignDialog({
  open,
  onOpenChange,
  design,
  allDesigns,
  onSuccess,
}: DeleteDesignDialogProps) {
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const [stockInfo, setStockInfo] = useState<{
    hasStock: boolean;
    stockCount: number;
    totalQuantity: number;
    lotsCount: number;
  } | null>(null);

  const [mode, setMode] = useState<"choose" | "transfer" | "force">("choose");
  const [targetDesignId, setTargetDesignId] = useState<string>("");

  const otherDesigns = allDesigns.filter((d) => d.id !== design?.id);

  useEffect(() => {
    if (!open || !design) {
      setStockInfo(null);
      setMode("choose");
      setTargetDesignId("");
      return;
    }

    const checkStock = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/finished-stock/designs/${design.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check design stock");
        const data = await res.json();
        setStockInfo(data);

        if (!data.hasStock) {
          setMode("force");
        } else {
          setMode("choose");
        }
      } catch (err: any) {
        toast.error(err.message || "Error checking design stock");
      } finally {
        setChecking(false);
      }
    };

    checkStock();
  }, [open, design]);

  const handleDelete = async (actionType: "transfer" | "force") => {
    if (!design) return;

    if (actionType === "transfer" && !targetDesignId) {
      toast.error("Please select a target design to transfer stock to");
      return;
    }

    setLoading(true);
    try {
      let url = `/api/finished-stock/designs/${design.id}?action=${actionType}`;
      if (actionType === "transfer") {
        url += `&target_design_id=${targetDesignId}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete design");
      }

      toast.success(data.message || "Design deleted successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setLoading(false);
    }
  };

  if (!design) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 text-left">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Shirt size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                Delete Design
              </DialogTitle>
              <p className="text-xs font-medium text-[#64748B]">
                {design.design_number ? `${design.design_number} - ` : ""}{design.name}
              </p>
            </div>
          </div>
        </DialogHeader>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <p className="text-xs text-[#64748B]">Checking design stock and production lots...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {stockInfo?.hasStock ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Active Stock / Lots Detected ({stockInfo.totalQuantity} items)</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This design has <strong>{stockInfo.totalQuantity} finished stock pieces</strong> and{" "}
                  <strong>{stockInfo.lotsCount} production lots</strong>. Please choose how to proceed.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to delete design <strong>{design.name}</strong>? This design contains no active stock or production lots and will be safely soft-deleted.
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
                      Option 1: Transfer Stock & Production Lots to Another Design (Recommended)
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Re-assigns all finished stock and active lots to a selected target design.
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
                      Option 2: Force Delete (Write-off Finished Stock)
                    </h4>
                    <p className="text-[11px] text-red-700/80 mt-0.5">
                      Zeros out physical stock via stock adjustment ledger entries while retaining historical sales invoices and cost logs.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "transfer" && (
              <div className="space-y-3 pt-2 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                <label className="text-xs font-bold text-[#374151] block">
                  Select Target Design <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetDesignId}
                  onChange={(e) => setTargetDesignId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Target Design...</option>
                  {otherDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.design_number ? `${d.design_number} - ` : ""}{d.name}
                    </option>
                  ))}
                </select>
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
                  <strong>Warning:</strong> Force deleting will write-off finished stock in the ledger. Past sales invoices will remain unchanged for accounting integrity.
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
              {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Design"}
            </button>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <button
              type="button"
              onClick={() => handleDelete("transfer")}
              disabled={loading || !targetDesignId}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Transfer & Delete Design
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
