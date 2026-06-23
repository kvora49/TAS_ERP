import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "green"
  | "red"
  | "orange"
  | "blue"
  | "purple"
  | "gray"
  | "primary";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = "gray", children, className, ...props }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    green: "bg-[#DCFCE7] text-[#15803D]",
    red: "bg-[#FEE2E2] text-[#DC2626]",
    orange: "bg-[#FEF3C7] text-[#D97706]",
    blue: "bg-[#DBEAFE] text-[#1D4ED8]",
    purple: "bg-[#EDE9FE] text-[#7C3AED]",
    gray: "bg-[#F1F5F9] text-[#64748B]",
    primary: "bg-[#EEF2FF] text-[#6366F1]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold select-none leading-none h-6 whitespace-nowrap",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
