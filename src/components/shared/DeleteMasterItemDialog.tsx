"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { AlertTriangle, ArrowRightLeft, Trash2, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GenericItem {
  id: string;
  name: string;
  abbreviation?: string;
  hsn_code?: string;
}

interface DeleteMasterItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string; // e.g. "Delete Unit of Measure", "Delete Size Set"
  item: GenericItem | null;
  allItems: GenericItem[];
  apiEndpoint: string; // e.g. "/api/master-data/units"
  targetQueryParam: string; // e.g. "target_unit_id"
  queryKeyToInvalidate?: string;
  onSuccess: () => void;
}

export function DeleteMasterItemDialog({
  open,
  onOpenChange,
  title,
  item,
  allItems,
  apiEndpoint,
  targetQueryParam,
  onSuccess,
}: DeleteMasterItemDialogProps) {
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  const [refInfo, setRefInfo] = useState<{
    hasReferences: boolean;
    materialsCount?: number;
    voucherCount?: number;
    designsCount?: number;
    lotsCount?: number;
    entriesCount?: number;
  } | null>(null);

  const [mode, setMode] = useState<"choose" | "transfer" | "force">("choose");
  const [targetItemId, setTargetItemId] = useState<string>("");

  const otherItems = allItems.filter((i) => i.id !== item?.id);

  useEffect(() => {
    if (!open || !item) {
      setRefInfo(null);
      setMode("choose");
      setTargetItemId("");
      return;
    }

    const checkReferences = async () => {
      setChecking(true);
      try {
        const res = await fetch(`${apiEndpoint}/${item.id}?action=check`);
        if (!res.ok) throw new Error("Failed to check item dependencies");
        const data = await res.json();
        setRefInfo(data);

        if (!data.hasReferences) {
          setMode("force");
        } else {
          setMode("choose");
        }
      } catch (err: any) {
        toast.error(err.message || "Error checking item references");
      } finally {
        setChecking(false);
      }
    };

    checkReferences();
  }, [open, item, apiEndpoint]);

  const handleDelete = async (actionType: "transfer" | "force") => {
    if (!item) return;

    if (actionType === "transfer" && !targetItemId) {
      toast.error("Please select a target item to transfer links to");
      return;
    }

    setLoading(true);
    try {
      let url = `${apiEndpoint}/${item.id}?action=${actionType}`;
      if (actionType === "transfer") {
        url += `&${targetQueryParam}=${targetItemId}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete item");
      }

      toast.success(data.message || "Item deleted successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{title}</div>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {item.name} {item.abbreviation ? `(${item.abbreviation})` : ""}
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-[480px]"
    >
      {checking ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Checking linked records...</p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {refInfo?.hasReferences ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <AlertTriangle size={16} className="shrink-0" />
                <span>Linked References Detected</span>
              </div>
              <p className="text-xs text-[var(--text-body)] leading-relaxed">
                This item is linked to active records in your system. Please choose how to handle references.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{item.name}</strong>? This item is not linked to active records and will be safely soft-deleted.
            </p>
          )}

          {refInfo?.hasReferences && mode === "choose" && (
            <div className="grid grid-cols-1 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMode("transfer")}
                className="p-3.5 border-2 border-[var(--primary-light)] hover:border-[var(--primary)] bg-[var(--primary-light)]/40 hover:bg-[var(--primary-light)] rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
              >
                <ArrowRightLeft className="w-5 h-5 text-[var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                    Option 1: Transfer & Re-assign References (Recommended)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Re-links all dependent records to a selected target item before deleting.
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
                    Option 2: Force Delete (Soft-Delete Item)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Hides item from dropdown selectors while retaining all past reports and historical logs intact.
                  </p>
                </div>
              </button>
            </div>
          )}

          {refInfo?.hasReferences && mode === "transfer" && (
            <div className="space-y-3 pt-2 bg-[var(--page-bg)] p-4 border border-[var(--border)] rounded-xl">
              <label className="text-xs font-bold text-[var(--text-primary)] block">
                Select Target Item <span className="text-red-500">*</span>
              </label>
              <select
                value={targetItemId}
                onChange={(e) => setTargetItemId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">Select Target...</option>
                {otherItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.abbreviation ? `(${i.abbreviation})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-xs text-[var(--primary)] font-bold hover:underline cursor-pointer"
              >
                &larr; Back to choices
              </button>
            </div>
          )}

          {refInfo?.hasReferences && mode === "force" && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2">
              <p className="text-xs text-[var(--text-body)] font-medium leading-relaxed">
                <strong>Note:</strong> Soft-deleting will hide this item from new forms while keeping past entries intact.
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

        {(!refInfo?.hasReferences || mode === "force") && (
          <AsyncButton
            variant="destructive"
            onClick={() => handleDelete("force")}
            isLoading={loading || checking}
            className="h-9 px-4 text-xs font-semibold"
          >
            {refInfo?.hasReferences ? "Confirm Force Delete" : "Delete Item"}
          </AsyncButton>
        )}

        {refInfo?.hasReferences && mode === "transfer" && (
          <AsyncButton
            variant="primary"
            onClick={() => handleDelete("transfer")}
            disabled={!targetItemId}
            isLoading={loading}
            className="h-9 px-4 text-xs font-semibold"
          >
            Transfer & Delete
          </AsyncButton>
        )}
      </div>
    </Modal>
  );
}
