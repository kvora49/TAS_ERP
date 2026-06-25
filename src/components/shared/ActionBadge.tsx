import React from "react";
import { cn } from "@/lib/utils";

interface ActionBadgeProps {
  action: string;
  className?: string;
}

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const normAction = action.toLowerCase().trim();

  let styles = "bg-slate-100 text-slate-700";
  let label = action;

  if (normAction === "create") {
    styles = "bg-[#DCFCE7] text-[#15803D]";
    label = "Create";
  } else if (normAction === "update") {
    styles = "bg-[#DBEAFE] text-[#1D4ED8]";
    label = "Update";
  } else if (normAction === "delete") {
    styles = "bg-[#FEE2E2] text-[#DC2626]";
    label = "Delete";
  } else if (normAction === "login") {
    styles = "bg-[#DCFCE7] text-[#15803D]";
    label = "Login";
  } else if (normAction === "logout") {
    styles = "bg-[#F1F5F9] text-[#64748B]";
    label = "Logout";
  } else if (normAction === "export") {
    styles = "bg-[#FEF3C7] text-[#D97706]";
    label = "Export";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md select-none leading-none whitespace-nowrap",
        styles,
        className
      )}
    >
      {label}
    </span>
  );
}
