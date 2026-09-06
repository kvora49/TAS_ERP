import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 select-none">
      <Loader2 className="h-8 w-8 text-[var(--primary)] animate-spin" />
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Loading View...
      </span>
    </div>
  );
}
