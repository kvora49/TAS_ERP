"use client";

import { useMemo } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, GitBranch, Trash2, Layers } from "lucide-react";

interface LotStageInput {
  stage_id: string;
  stage_name: string;
  stage_type: string;
  sequence_no: number;
  is_mandatory: boolean;
  worker_ids: string[];
}

interface ProductionStage { 
  id: string; 
  name: string; 
  type: string; 
  custom_fields?: any[];
  template?: { id: string; name: string; is_default?: boolean };
}
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
  // Group master stages by template to avoid duplicate/ambiguous stages across templates
  const stagesByTemplate = useMemo(() => {
    const groups: Record<string, { templateName: string; stages: ProductionStage[] }> = {};
    masterStages.forEach((stage) => {
      const templateName = stage.template?.name || "General Stages";
      const templateKey = stage.template?.id || "general";
      if (!groups[templateKey]) {
        groups[templateKey] = { templateName, stages: [] };
      }
      groups[templateKey].stages.push(stage);
    });
    return Object.values(groups);
  }, [masterStages]);

  const currentTemplate = productionTemplates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="h-4.5 w-4.5 text-[var(--primary)]" />
          Step 5: Assign Production Stages
        </h3>
        {currentTemplate && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
            <Layers size={13} />
            Template: {currentTemplate.name}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Template selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedTemplateId}
            onChange={(e) => onLoadTemplate(e.target.value)}
            className="h-9 text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-2.5 focus:ring-1 focus:ring-[var(--input-focus)]"
          >
            <option value="">Switch Production Template</option>
            {productionTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.stages?.length || 0} Stages)
              </option>
            ))}
          </select>
        </div>

        {/* Stages table */}
        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase">
                <th className="py-2.5 px-4 w-12 text-center">Order</th>
                <th className="py-2.5 px-4">Stage Name</th>
                <th className="py-2.5 px-4">Stage Type</th>
                <th className="py-2.5 px-4 min-w-[280px]">Assigned Workers (Specialists)</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-xs bg-[var(--card-bg)]">
              {assignedStages.map((stage, index) => {
                const specialists = workers.filter(
                  (w) =>
                    w.stage_specialty &&
                    Array.isArray(w.stage_specialty) &&
                    (w.stage_specialty.includes(stage.stage_id) || w.stage_specialty.includes(stage.stage_name))
                );

                return (
                  <tr key={stage.stage_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
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
                          className="p-0.5 text-[var(--text-faint)] hover:text-[var(--primary)] disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === assignedStages.length - 1) return;
                            const copy = [...assignedStages];
                            [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
                            setAssignedStages(copy.map((s, i) => ({ ...s, sequence_no: i + 1 })));
                          }}
                          disabled={index === assignedStages.length - 1}
                          className="p-0.5 text-[var(--text-faint)] hover:text-[var(--primary)] disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{stage.stage_name}</span>
                        {(() => {
                          const ms = masterStages.find((m: any) => m.id === stage.stage_id || m.name === stage.stage_name);
                          const count = ms?.custom_fields?.length || 0;
                          if (count > 0) {
                            return (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                                {count} {count === 1 ? "QC Param" : "QC Params"}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          stage.stage_type === "job_work"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                        }`}
                      >
                        {stage.stage_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 space-y-2 min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          onChange={(e) => { onAddWorker(index, e.target.value); e.currentTarget.value = ""; }}
                          className="h-8 py-1 text-xs rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-2 focus:ring-1 focus:ring-[var(--input-focus)] min-w-[140px] shrink-0 leading-normal"
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
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--page-bg)] text-[var(--text-primary)] text-[10px] font-semibold border border-[var(--border)]"
                            >
                              {name}
                              <button
                                type="button"
                                onClick={() => onRemoveWorker(index, workerId)}
                                className="text-[var(--text-faint)] hover:text-red-500 font-bold font-mono cursor-pointer"
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
                        className="p-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
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

        {/* Add Stage row */}
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
            className="h-9 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--border)] rounded-lg pl-3.5 pr-8 min-w-[210px] py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all cursor-pointer shadow-xs"
          >
            <option value="" className="text-[var(--text-muted)] bg-[var(--card-bg)] font-medium">+ Add Production Stage</option>
            {stagesByTemplate.map((group) => (
              <optgroup key={group.templateName} label={group.templateName} className="font-bold text-[var(--text-secondary)] bg-[var(--card-bg)]">
                {group.stages.map((s) => (
                  <option key={s.id} value={s.id} className="text-[var(--text-primary)] bg-[var(--card-bg)] font-medium">
                    {s.name} ({s.type?.replace("_", " ")})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onBack}
          className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Design Spec Sheet
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
