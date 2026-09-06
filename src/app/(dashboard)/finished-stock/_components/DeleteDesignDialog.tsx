"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { AlertTriangle, ArrowRightLeft, Shirt, Loader2 } from "lucide-react";
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
        const res = await fetch(`/api/finished-stock/designs/${design.id}/check-stock`);
        const data = await res.json();
        if (res.ok) {
          setStockInfo({
            hasStock: data.hasStock,
            stockCount: data.stockCount || 0,
            totalQuantity: data.totalQuantity || 0,
            lotsCount: data.lotsCount || 0,
          });
        }
      } catch (err) {
        console.error("Failed to check design dependencies", err);
      } finally {
        setChecking(false);
      }
    };

    checkStock();
  }, [open, design]);

  const handleDelete = async (action: "force" | "transfer") => {
    if (!design) return;
    if (action === "transfer" && !targetDesignId) {
      toast.error("Please select a target design to transfer stock to");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/finished-stock/designs/${design.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetDesignId: action === "transfer" ? targetDesignId : undefined,
        }),
      });

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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Shirt size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Delete Design</h2>
            <p className="text-xs font-medium text-[var(--text-muted)] truncate">
              {design.design_number ? `${design.design_number} - ` : ""}{design.name}
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 pt-2">
        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">Checking design stock and production lots...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stockInfo?.hasStock ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Active Stock / Lots Detected ({stockInfo.totalQuantity} items)</span>
                </div>
                <p className="text-xs text-[var(--text-body)] leading-relaxed">
                  This design has <strong className="text-[var(--text-primary)]">{stockInfo.totalQuantity} finished stock pieces</strong> and{" "}
                  <strong className="text-[var(--text-primary)]">{stockInfo.lotsCount} production lots</strong>. Please choose how to proceed.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Are you sure you want to delete design <strong className="text-[var(--text-primary)]">{design.name}</strong>? This design contains no active stock or production lots and will be safely soft-deleted.
              </p>
            )}

            {stockInfo?.hasStock && mode === "choose" && (
              <div className="grid grid-cols-1 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("transfer")}
                  className="p-3.5 border border-[var(--primary)]/30 hover:border-[var(--primary)] bg-[var(--primary-light)] rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
                >
                  <ArrowRightLeft className="w-5 h-5 text-[var(--primary)] mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                      Option 1: Transfer Stock & Production Lots to Another Design (Recommended)
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Re-assigns all finished stock and active lots to a selected target design.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("force")}
                  className="p-3.5 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
                >
                  <div className="w-5 h-5 text-red-500 mt-0.5 shrink-0 font-bold">&times;</div>
                  <div>
                    <h4 className="text-xs font-bold text-red-500">
                      Option 2: Force Delete (Write-Off Stock)
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Writes off remaining stock from active ledger and archives the design.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "transfer" && (
              <div className="space-y-3 pt-2 bg-[var(--page-bg)] p-4 border border-[var(--border)] rounded-xl">
                <label className="text-xs font-bold text-[var(--text-secondary)] block">
                  Select Target Design <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetDesignId}
                  onChange={(e) => setTargetDesignId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
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
                  className="text-xs text-[var(--primary)] font-bold hover:underline"
                >
                  &larr; Back to choices
                </button>
              </div>
            )}

            {stockInfo?.hasStock && mode === "force" && (
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl space-y-2">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-relaxed">
                  <strong>Warning:</strong> Force deleting will write-off finished stock in the ledger. Past sales invoices will remain unchanged for accounting integrity.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="text-xs text-[var(--primary)] font-bold hover:underline"
                >
                  &larr; Back to choices
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
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
              type="button"
              onClick={() => handleDelete("force")}
              disabled={loading || checking}
              variant="destructive"
              className="text-xs font-semibold"
            >
              {stockInfo?.hasStock ? "Confirm Force Delete" : "Delete Design"}
            </AsyncButton>
          )}

          {stockInfo?.hasStock && mode === "transfer" && (
            <AsyncButton
              type="button"
              onClick={() => handleDelete("transfer")}
              disabled={loading || !targetDesignId}
              variant="primary"
              className="text-xs font-semibold"
            >
              Transfer & Delete Design
            </AsyncButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
