"use client";

import { AlertTriangle, CheckCircle2, Landmark } from "lucide-react";

interface Props {
  pendingValue: number;
  clearedValue: number;
  bouncedValue: number;
}

export function ChequeStatsBar({ pendingValue, clearedValue, bouncedValue }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-[#FEF3C7] text-[#D97706] rounded-lg">
          <Landmark className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Outstanding PDC / Pending</span>
          <span className="text-xl font-bold text-slate-800">
            ₹{pendingValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Value Cleared</span>
          <span className="text-xl font-bold text-slate-800">
            ₹{clearedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-[#FEE2E2] text-[#DC2626] rounded-lg">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Value Bounced</span>
          <span className="text-xl font-bold text-[#DC2626]">
            ₹{bouncedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
