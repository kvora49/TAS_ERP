import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 select-none">
      <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
      <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
        Loading View...
      </span>
    </div>
  );
}
