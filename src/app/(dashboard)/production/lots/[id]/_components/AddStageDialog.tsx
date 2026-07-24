"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  type?: string;
}

interface MasterStage {
  id: string;
  name: string;
  stage_type?: string;
}

interface AddStageDialogProps {
  open: boolean;
  onClose: () => void;
  lotId: string;
  masterStages?: MasterStage[];
  workers?: Worker[];
  onSuccess: () => void;
}

export function AddStageDialog({
  open,
  onClose,
  lotId,
  masterStages = [],
  workers = [],
  onSuccess,
}: AddStageDialogProps) {
  const [stageName, setStageName] = useState("");
  const [stageType, setStageType] = useState("in_house");
  const [isMandatory, setIsMandatory] = useState(true);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddStage = async () => {
    if (!stageName.trim()) {
      toast.error("Please enter or select a stage name");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/production/lots/${lotId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_name: stageName.trim(),
          stage_type: stageType,
          is_mandatory: isMandatory,
          worker_ids: selectedWorkerIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add production stage");

      toast.success(`Stage "${stageName}" added to lot successfully!`);
      setStageName("");
      setSelectedWorkerIds([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add stage");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-600" />
            Add Custom Production Stage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Stage Name / Preset */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1.5">
              Stage Name <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {masterStages.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) setStageName(e.target.value);
                  }}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="">-- Select Pre-configured Master Stage --</option>
                  {masterStages.map((ms) => (
                    <option key={ms.id} value={ms.name}>
                      {ms.name} ({ms.stage_type || "in_house"})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Or enter custom stage name (e.g. Ironing, Embroidery)..."
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Stage Type & Mandatory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Stage Type</label>
              <select
                value={stageType}
                onChange={(e) => setStageType(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
              >
                <option value="in_house">In House</option>
                <option value="job_work">Job Work / Subcontract</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Execution Rule</label>
              <select
                value={isMandatory ? "true" : "false"}
                onChange={(e) => setIsMandatory(e.target.value === "true")}
                className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
              >
                <option value="true">Mandatory Stage</option>
                <option value="false">Optional Stage</option>
              </select>
            </div>
          </div>

          {/* Assign Worker(s) */}
          {workers.length > 0 && (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1.5">
                Assign Specialist / Worker(s)
              </label>
              <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50/50">
                {workers.map((w) => {
                  const isChecked = selectedWorkerIds.includes(w.id);
                  return (
                    <label
                      key={w.id}
                      className="flex items-center gap-2.5 text-xs p-1.5 rounded hover:bg-white cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWorkerIds((prev) => [...prev, w.id]);
                          } else {
                            setSelectedWorkerIds((prev) => prev.filter((id) => id !== w.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-800">{w.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({w.worker_id})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddStage}
            disabled={submitting || !stageName.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Stage
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
