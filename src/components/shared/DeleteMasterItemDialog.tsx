"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 text-left">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                {title}
              </DialogTitle>
              <p className="text-xs font-medium text-[#64748B]">
                {item.name} {item.abbreviation ? `(${item.abbreviation})` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <p className="text-xs text-[#64748B]">Checking linked records...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {refInfo?.hasReferences ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Linked References Detected</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This item is linked to active records in your system. Please choose how to handle references.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to delete <strong>{item.name}</strong>? This item is not linked to active records and will be safely soft-deleted.
              </p>
            )}

            {refInfo?.hasReferences && mode === "choose" && (
              <div className="grid grid-cols-1 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("transfer")}
                  className="p-3.5 border-2 border-indigo-100 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
                >
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] group-hover:text-indigo-600 transition-colors">
                      Option 1: Transfer & Re-assign References (Recommended)
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Re-links all dependent records to a selected target item before deleting.
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
                      Option 2: Force Delete (Soft-Delete Item)
                    </h4>
                    <p className="text-[11px] text-red-700/80 mt-0.5">
                      Hides item from dropdown selectors while retaining all past reports and historical logs intact.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {refInfo?.hasReferences && mode === "transfer" && (
              <div className="space-y-3 pt-2 bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl">
                <label className="text-xs font-bold text-[#374151] block">
                  Select Target Item <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetItemId}
                  onChange={(e) => setTargetItemId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  &larr; Back to choices
                </button>
              </div>
            )}

            {refInfo?.hasReferences && mode === "force" && (
              <div className="bg-red-50/60 border border-red-200 p-4 rounded-xl space-y-2">
                <p className="text-xs text-red-800 font-medium leading-relaxed">
                  <strong>Note:</strong> Soft-deleting will hide this item from new forms while keeping past entries intact.
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

          {(!refInfo?.hasReferences || mode === "force") && (
            <button
              type="button"
              onClick={() => handleDelete("force")}
              disabled={loading || checking}
              className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all cursor-pointer flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {refInfo?.hasReferences ? "Confirm Force Delete" : "Delete Item"}
            </button>
          )}

          {refInfo?.hasReferences && mode === "transfer" && (
            <button
              type="button"
              onClick={() => handleDelete("transfer")}
              disabled={loading || !targetItemId}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Transfer & Delete
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
