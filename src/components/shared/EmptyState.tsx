import React from "react";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  shortcutHint?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon = <Plus className="h-4 w-4" />,
  shortcutHint,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 lg:p-12 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] min-h-[300px]">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-[var(--page-bg)] flex items-center justify-center text-[var(--text-faint)] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md"
        >
          {actionIcon}
          <span>{actionLabel}</span>
          {shortcutHint && (
            <kbd className="ml-1 text-[10px] bg-[var(--primary-dark)] text-white/90 px-1.5 py-0.5 rounded font-mono border border-white/20">
              {shortcutHint}
            </kbd>
          )}
        </button>
      )}
    </div>
  );
}
