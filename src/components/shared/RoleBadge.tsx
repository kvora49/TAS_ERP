import React from "react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normRole = role.toLowerCase().replace(/_/g, " ").trim();

  let styles = "bg-[#F1F5F9] text-[#64748B]"; // Default / Inactive
  let label = role;

  if (normRole === "super admin") {
    styles = "bg-[#EDE9FE] text-[#6D28D9]";
    label = "Super Admin";
  } else if (normRole === "owner") {
    styles = "bg-[#EDE9FE] text-[#6D28D9]";
    label = "Owner";
  } else if (normRole === "admin") {
    styles = "bg-[#EDE9FE] text-[#6D28D9]";
    label = "Admin";
  } else if (normRole === "manager") {
    styles = "bg-[#DBEAFE] text-[#1D4ED8]";
    label = "Manager";
  } else if (normRole === "accountant") {
    styles = "bg-[#FEF3C7] text-[#D97706]";
    label = "Accountant";
  } else if (normRole === "store incharge" || normRole === "staff") {
    styles = "bg-[#D1FAE5] text-[#065F46]";
    label = "Store Incharge";
  } else if (normRole === "production user" || normRole === "intern") {
    styles = "bg-[#E0F2FE] text-[#0369A1]";
    label = "Production User";
  } else if (normRole === "inactive") {
    styles = "bg-[#F1F5F9] text-[#64748B]";
    label = "Inactive";
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
