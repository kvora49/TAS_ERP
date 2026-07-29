"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
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

    const checkStock = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/master-data/godowns/${godown.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check godown stock");
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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Warehouse size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--text-primary)]">Delete Godown</div>
            <p className="text-xs font-medium text-[var(--text-muted)]">{godown.name}</p>
          </div>
        </div>
      }
      maxWidth="max-w-[480px]"
    >
      {checking ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Checking godown inventory...</p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {stockInfo?.hasStock ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <AlertTriangle size={16} className="shrink-0" />
                <span>Active Stock Detected ({stockInfo.totalQuantity} items)</span>
              </div>
              <p className="text-xs text-[var(--text-body)] leading-relaxed">
                This godown contains <strong>{stockInfo.rawStockCount} raw material items</strong> and{" "}
                <strong>{stockInfo.finishedStockCount} finished stock items</strong>. Please choose how you wish to resolve this stock.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{godown.name}</strong>? This godown contains no active stock and will be safely soft-deleted.
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
                    Option 1: Transfer Stock to Another Godown (Recommended)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Move all raw material and finished stock to a selected destination godown.
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
                    Option 2: Force Delete & Write-off Stock
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Zeros out remaining physical stock in ledger. Historical costs, worker payouts, and past reports are preserved.
                  </p>
                </div>
              </button>
            </div>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <div className="space-y-3 pt-2 bg-[var(--page-bg)] p-4 border border-[var(--border)] rounded-xl">
              <label className="text-xs font-bold text-[var(--text-primary)] block">
                Select Destination Godown <span className="text-red-500">*</span>
              </label>
              <select
                value={targetGodownId}
                onChange={(e) => setTargetGodownId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">Select Target Godown...</option>
                {otherGodowns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-muted)]">
                All current stock will be transferred to this godown via stock ledger movements before soft-deleting {godown.name}.
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
                <strong>Warning:</strong> Force deleting will record a stock write-off entry in the stock ledger to zero out available inventory.
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
            {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Godown"}
          </AsyncButton>
        )}

        {stockInfo?.hasStock && mode === "transfer" && (
          <AsyncButton
            variant="primary"
            onClick={() => handleDelete("transfer")}
            disabled={!targetGodownId}
            isLoading={loading}
            className="h-9 px-4 text-xs font-semibold"
          >
            Transfer & Delete Godown
          </AsyncButton>
        )}
      </div>
    </Modal>
  );
}
