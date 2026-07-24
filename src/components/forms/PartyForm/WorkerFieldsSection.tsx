import React from "react";
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

  if (!watchTypes.includes("worker")) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm animate-fadeIn space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-amber-500 pl-2.5">
        Worker Settings
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="worker-type" className="block text-xs font-semibold text-[#64748B] mb-1.5">Worker Type *</label>
          <select
            id="worker-type"
            {...register("worker_type")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          >
            <option value="in_house">In-House (Permanent)</option>
            <option value="contractor">Contractor (Job-work worker)</option>
          </select>
        </div>

        <div>
          <label htmlFor="working-since" className="block text-xs font-semibold text-[#64748B] mb-1.5">Working Since</label>
          <input
            id="working-since"
            type="date"
            {...register("working_since")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
        </div>

        <div>
          <label htmlFor="wage-type" className="block text-xs font-semibold text-[#64748B] mb-1.5">Wage Billing Type</label>
          <select
            id="wage-type"
            {...register("wage_type")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          >
            <option value="piece_rate">Piece-rate (Job work rate)</option>
            <option value="fixed_salary">Fixed monthly salary</option>
            <option value="daily_wages">Daily wage</option>
          </select>
        </div>

        <div>
          <label htmlFor="wage-rate" className="block text-xs font-semibold text-[#64748B] mb-1.5">Base Rate (INR / pc or month)</label>
          <input
            id="wage-rate"
            type="number"
            step="0.01"
            min="0"
            {...register("wage_rate")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="preferred-stage" className="block text-xs font-semibold text-[#64748B] mb-1.5">Preferred Production Stage</label>
          <select
            id="preferred-stage"
            {...register("preferred_stage_id")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          >
            <option value="">No preference</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.type})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Stage Specialties *</label>
          <p className="text-[10px] text-slate-500 mb-3 leading-none">Select the stages this worker is qualified to handle.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stages.map((st) => {
              const isSpecChecked = stageSpecialty.includes(st.id);
              return (
                <label key={st.id} className="flex items-center gap-2 text-xs font-medium text-[#1E293B] bg-slate-50 border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isSpecChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setValue("stage_specialty", [...stageSpecialty, st.id]);
                      } else {
                        setValue("stage_specialty", stageSpecialty.filter((x) => x !== st.id));
                      }
                    }}
                    className="rounded border-[#CBD5E1] text-[#6366F1] focus:ring-[#6366F1] h-3.5 w-3.5"
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
