"use client";

import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, GitBranch, Trash2 } from "lucide-react";

interface LotStageInput {
  stage_id: string;
  stage_name: string;
  stage_type: string;
  sequence_no: number;
  is_mandatory: boolean;
  worker_ids: string[];
}

interface ProductionStage { id: string; name: string; type: string; }
interface Worker { id: string; name: string; stage_specialty?: string[] }

interface Props {
  assignedStages: LotStageInput[];
  setAssignedStages: (stages: LotStageInput[]) => void;
  masterStages: ProductionStage[];
  workers: Worker[];
  productionTemplates: { id: string; name: string; stages?: any[] }[];
  selectedTemplateId: string;
  onLoadTemplate: (templateId: string) => void;
  onAddWorker: (idx: number, workerId: string) => void;
  onRemoveWorker: (idx: number, workerId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step5AssignStages({
  assignedStages, setAssignedStages,
  masterStages, workers, productionTemplates, selectedTemplateId,
  onLoadTemplate, onAddWorker, onRemoveWorker,
  onNext, onBack,
}: Props) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
        <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="h-4.5 w-4.5 text-[#6366F1]" />
          Step 5: Assign Production Stages
        </h3>
      </div>

      <div className="space-y-4">
        {/* Template selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedTemplateId}
            onChange={(e) => onLoadTemplate(e.target.value)}
            className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
          >
            <option value="">Load Production Template</option>
            {productionTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.stages?.length || 0} Stages)
              </option>
            ))}
          </select>
        </div>

        {/* Stages table */}
        <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                <th className="py-2.5 px-4 w-12 text-center">Order</th>
                <th className="py-2.5 px-4">Stage Name</th>
                <th className="py-2.5 px-4">Stage Type</th>
                <th className="py-2.5 px-4 min-w-[280px]">Assigned Workers (Specialists)</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs">
              {assignedStages.map((stage, index) => {
                const specialists = workers.filter(
                  (w) =>
                    w.stage_specialty &&
                    Array.isArray(w.stage_specialty) &&
                    (w.stage_specialty.includes(stage.stage_id) || w.stage_specialty.includes(stage.stage_name))
                );

                return (
                  <tr key={stage.stage_id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (index === 0) return;
                            const copy = [...assignedStages];
                            [copy[index], copy[index - 1]] = [copy[index - 1], copy[index]];
                            setAssignedStages(copy.map((s, i) => ({ ...s, sequence_no: i + 1 })));
                          }}
                          disabled={index === 0}
                          className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <span className="font-mono text-xs font-bold">{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === assignedStages.length - 1) return;
                            const copy = [...assignedStages];
                            [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
                            setAssignedStages(copy.map((s, i) => ({ ...s, sequence_no: i + 1 })));
                          }}
                          disabled={index === assignedStages.length - 1}
                          className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#374151]">{stage.stage_name}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          stage.stage_type === "job_work"
                            ? "bg-[#FEF3C7] text-[#D97706]"
                            : "bg-[#DBEAFE] text-[#1D4ED8]"
                        }`}
                      >
                        {stage.stage_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 space-y-2 min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          onChange={(e) => { onAddWorker(index, e.target.value); e.currentTarget.value = ""; }}
                          className="h-8 py-1 text-xs rounded border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-[#6366F1] min-w-[140px] shrink-0 leading-normal"
                        >
                          <option value="">+ Assign Worker</option>
                          {specialists.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                          {specialists.length === 0 &&
                            workers.map((w) => (
                              <option key={w.id} value={w.id}>{w.name} (General)</option>
                            ))}
                        </select>

                        {(stage.worker_ids || []).map((workerId) => {
                          const name = workers.find((w) => w.id === workerId)?.name || "Worker";
                          return (
                            <span
                              key={workerId}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-800 text-[10px] font-semibold border border-slate-200"
                            >
                              {name}
                              <button
                                type="button"
                                onClick={() => onRemoveWorker(index, workerId)}
                                className="text-slate-400 hover:text-red-500 font-bold font-mono"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setAssignedStages(
                            assignedStages.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence_no: i + 1 }))
                          )
                        }
                        className="p-1 rounded border border-[#E5E7EB] text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="Remove Stage"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Custom Stage row */}
        <div className="flex items-center gap-2 mt-3 mb-2">
          <select
            onChange={(e) => {
              if (!e.target.value) return;
              const master = masterStages.find((s) => s.id === e.target.value);
              if (master) {
                setAssignedStages([
                  ...assignedStages,
                  {
                    stage_id: master.id,
                    stage_name: master.name,
                    stage_type: master.type || "in_house",
                    sequence_no: assignedStages.length + 1,
                    is_mandatory: true,
                    worker_ids: [],
                  },
                ]);
              }
              e.currentTarget.value = "";
            }}
            className="h-9 text-xs font-semibold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-400 rounded-lg pl-3.5 pr-8 min-w-[195px] py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-xs"
          >
            <option value="" className="text-slate-700 bg-white font-medium">+ Add Custom Stage</option>
            {masterStages.map((s) => (
              <option key={s.id} value={s.id} className="text-slate-800 bg-white font-medium">
                {s.name} ({s.type?.replace("_", " ")})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Design Spec Sheet
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
