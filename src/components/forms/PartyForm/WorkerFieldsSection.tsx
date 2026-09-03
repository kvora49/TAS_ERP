import React, { useMemo } from "react";
import { UseFormRegister, useWatch, Control, UseFormSetValue, FieldErrors } from "react-hook-form";
import { PartyFormValues, Stage } from "./party.schema";

interface WorkerFieldsSectionProps {
  register: UseFormRegister<PartyFormValues>;
  control: Control<PartyFormValues>;
  setValue: UseFormSetValue<PartyFormValues>;
  stages: Stage[];
  loadingStages: boolean;
  errors: FieldErrors<PartyFormValues>;
}

export function WorkerFieldsSection({
  register,
  control,
  setValue,
  stages,
  loadingStages,
  errors,
}: WorkerFieldsSectionProps) {
  const watchTypes = useWatch({ control, name: "type" }) || [];
  const stageSpecialty = useWatch({ control, name: "stage_specialty" }) || [];

  // Deduplicate stages by normalized lowercase name for specialties checkboxes
  const uniqueStagesByName = useMemo(() => {
    const seen = new Set<string>();
    const result: Stage[] = [];
    stages.forEach((st) => {
      const key = st.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(st);
      }
    });
    return result;
  }, [stages]);

  if (!watchTypes.includes("worker")) {
    return null;
  }

  return (
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-xs animate-fadeIn space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-amber-500 pl-2.5">
        Worker Settings
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="worker-type" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Worker Type *</label>
          <select
            id="worker-type"
            {...register("worker_type")}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)]"
          >
            <option value="in_house">In-House (Permanent)</option>
            <option value="job_worker">Job Worker / Contractor</option>
          </select>
        </div>

        <div>
          <label htmlFor="working-since" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Working Since</label>
          <input
            id="working-since"
            type="date"
            {...register("working_since")}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div>
          <label htmlFor="wage-type" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Wage Type</label>
          <select
            id="wage-type"
            {...register("wage_type")}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)]"
          >
            <option value="piece_rate">Piece Rate (Per Piece)</option>
            <option value="monthly">Monthly Salary</option>
            <option value="daily">Daily Wage</option>
          </select>
        </div>

        <div>
          <label htmlFor="wage-rate" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Base Rate (INR / pc or month)</label>
          <input
            id="wage-rate"
            type="number"
            step="0.01"
            min="0"
            {...register("wage_rate")}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div className="md:col-span-2 border-t border-[var(--border)] pt-3">
          <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Stage Specialties *</label>
          <p className="text-[10px] text-[var(--text-muted)] mb-3 leading-none">Select the stages this worker is qualified to handle.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {uniqueStagesByName.map((st) => {
              const isSpecChecked = stageSpecialty.some(
                (specId) => specId === st.id || stages.find((s) => s.id === specId)?.name?.trim().toLowerCase() === st.name.trim().toLowerCase()
              );
              return (
                <label key={st.id} className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-2.5 cursor-pointer hover:bg-[var(--table-row-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={isSpecChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const updated = [...stageSpecialty, st.id];
                        setValue("stage_specialty", updated);
                        setValue("preferred_stage_id", updated[0] || null);
                      } else {
                        // Remove all stage IDs with this normalized name
                        const matchingIds = new Set(
                          stages.filter((s) => s.name.trim().toLowerCase() === st.name.trim().toLowerCase()).map((s) => s.id)
                        );
                        matchingIds.add(st.id);
                        const updated = stageSpecialty.filter((x) => !matchingIds.has(x));
                        setValue("stage_specialty", updated);
                        setValue("preferred_stage_id", updated[0] || null);
                      }
                    }}
                    className="rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)] h-3.5 w-3.5"
                  />
                  <span className="truncate">{st.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
