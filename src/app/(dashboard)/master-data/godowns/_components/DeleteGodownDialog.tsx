"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRightLeft, Trash2, Warehouse, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Godown {
  id: string;
  name: string;
}

interface DeleteGodownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  godown: Godown | null;
  allGodowns: Godown[];
  onSuccess: () => void;
}

export function DeleteGodownDialog({
  open,
  onOpenChange,
  godown,
  allGodowns,
  onSuccess,
}: DeleteGodownDialogProps) {
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const [stockInfo, setStockInfo] = useState<{
    hasStock: boolean;
    rawStockCount: number;
    finishedStockCount: number;
    totalQuantity: number;
  } | null>(null);

  const [mode, setMode] = useState<"choose" | "transfer" | "force">("choose");
  const [targetGodownId, setTargetGodownId] = useState<string>("");

  const otherGodowns = allGodowns.filter((g) => g.id !== godown?.id);

  useEffect(() => {
    if (!open || !godown) {
      setStockInfo(null);
      setMode("choose");
      setTargetGodownId("");
      return;
    }

    // Check stock status on open
    const checkStock = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/master-data/godowns/${godown.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check godown stock");
        const data = await res.json();
        setStockInfo(data);

        if (!data.hasStock) {
          setMode("force"); // Direct simple delete when no stock
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
  }, [open, godown]);

  const handleDelete = async (actionType: "transfer" | "force") => {
    if (!godown) return;

    if (actionType === "transfer" && !targetGodownId) {
      toast.error("Please select a destination godown to transfer stock to");
      return;
    }

    setLoading(true);
    try {
      let url = `/api/master-data/godowns/${godown.id}?action=${actionType}`;
      if (actionType === "transfer") {
        url += `&target_godown_id=${targetGodownId}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete godown");
      }

      toast.success(data.message || "Godown deleted successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setLoading(false);
    }
  };

  if (!godown) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 text-left">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                Delete Godown
              </DialogTitle>
              <p className="text-xs font-medium text-[#64748B]">
                {godown.name}
              </p>
            </div>
          </div>
        </DialogHeader>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <p className="text-xs text-[#64748B]">Checking godown inventory...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {stockInfo?.hasStock ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Active Stock Detected ({stockInfo.totalQuantity} items)</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This godown contains <strong>{stockInfo.rawStockCount} raw material items</strong> and{" "}
                  <strong>{stockInfo.finishedStockCount} finished stock items</strong>. Please choose how you wish to resolve this stock.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to delete <strong>{godown.name}</strong>? This godown contains no active stock and will be safely soft-deleted.
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
                      Option 1: Transfer Stock to Another Godown (Recommended)
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Move all raw material and finished stock to a selected destination godown.
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
                      Option 2: Force Delete & Write-off Stock
                    </h4>
                    <p className="text-[11px] text-red-700/80 mt-0.5">
                      Zeros out remaining physical stock in ledger. Historical costs, worker payouts, and past reports are preserved.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "transfer" && (
              <div className="space-y-3 pt-2 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                <label className="text-xs font-bold text-[#374151] block">
                  Select Destination Godown <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetGodownId}
                  onChange={(e) => setTargetGodownId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Target Godown...</option>
                  {otherGodowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B]">
                  All current stock will be transferred to this godown via stock ledger movements before soft-deleting {godown.name}.
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
                  <strong>Warning:</strong> Force deleting will record a stock write-off entry in the stock ledger to zero out available inventory.
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
              {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Godown"}
            </button>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <button
              type="button"
              onClick={() => handleDelete("transfer")}
              disabled={loading || !targetGodownId}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Transfer & Delete Godown
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
