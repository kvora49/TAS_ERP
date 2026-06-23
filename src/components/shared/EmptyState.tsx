import React from "react";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon = <Plus className="h-4 w-4" />,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 lg:p-12 bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] min-h-[300px]">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-[#0F172A]">{title}</h3>
      <p className="text-xs text-[#64748B] mt-1 max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-[#6366F1]/10"
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}
