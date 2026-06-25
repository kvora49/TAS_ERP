import React from "react";
import {
  UserCircle,
  Package,
  CreditCard,
  Receipt,
  Settings2,
  Settings,
  Factory,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleBadgeProps {
  module: string;
  className?: string;
}

export function ModuleBadge({ module, className }: ModuleBadgeProps) {
  const normModule = module.toLowerCase().replace(/&/g, "and").trim();

  let styles = "bg-slate-100 text-slate-700";
  let Icon = Layers;
  let label = module;

  if (normModule.includes("user")) {
    styles = "bg-[#EDE9FE] text-[#7C3AED]";
    Icon = UserCircle;
    label = "Users";
  } else if (normModule.includes("inventory")) {
    styles = "bg-[#DCFCE7] text-[#15803D]";
    Icon = Package;
    label = "Inventory";
  } else if (normModule.includes("payment")) {
    styles = "bg-[#FEE2E2] text-[#DC2626]";
    Icon = CreditCard;
    label = "Payments";
  } else if (normModule.includes("sale") || normModule.includes("bill")) {
    styles = "bg-[#FEF3C7] text-[#D97706]";
    Icon = Receipt;
    label = "Sales & Billing";
  } else if (normModule.includes("master") || normModule.includes("brand") || normModule.includes("godown")) {
    styles = "bg-[#DBEAFE] text-[#1D4ED8]";
    Icon = Settings2;
    label = "Master Data";
  } else if (normModule.includes("setting")) {
    styles = "bg-[#EDE9FE] text-[#7C3AED]";
    Icon = Settings;
    label = "Settings";
  } else if (normModule.includes("production")) {
    styles = "bg-[#DBEAFE] text-[#1D4ED8]";
    Icon = Factory;
    label = "Production";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md select-none whitespace-nowrap",
        styles,
        className
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
    </span>
  );
}
