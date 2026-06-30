"use client";

import {
  Package,
  IndianRupee,
  Users,
  FileText,
  Clock,
  User,
  Briefcase,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CardSectionVariant =
  | "quantity"
  | "job_work"
  | "worker"
  | "info"
  | "timeline"
  | "personal"
  | "employment"
  | "bank";

interface CardSectionHeaderProps {
  variant: CardSectionVariant;
  title: string;
  subtitle?: string | null;
}

const variantsConfig = {
  quantity: {
    bg: "bg-[#EEF2FF]",
    text: "text-[#6366F1]",
    icon: Package,
  },
  job_work: {
    bg: "bg-[#F0FDF4]",
    text: "text-[#16A34A]",
    icon: IndianRupee,
  },
  worker: {
    bg: "bg-[#EEF2FF]",
    text: "text-[#6366F1]",
    icon: Users,
  },
  info: {
    bg: "bg-[#FEF9C3]",
    text: "text-[#D97706]",
    icon: FileText,
  },
  timeline: {
    bg: "bg-[#EEF2FF]",
    text: "text-[#6366F1]",
    icon: Clock,
  },
  personal: {
    bg: "bg-[#EEF2FF]",
    text: "text-[#6366F1]",
    icon: User,
  },
  employment: {
    bg: "bg-[#F0FDF4]",
    text: "text-[#16A34A]",
    icon: Briefcase,
  },
  bank: {
    bg: "bg-[#FEF9C3]",
    text: "text-[#D97706]",
    icon: CreditCard,
  },
};

export default function CardSectionHeader({ variant, title, subtitle }: CardSectionHeaderProps) {
  const config = variantsConfig[variant] || variantsConfig.info;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-3.5 mb-5 border-b border-[#F3F4F6] pb-4">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
          config.bg,
          config.text
        )}
      >
        <IconComponent className="h-[18px] w-[18px]" />
      </div>
      <div className="flex flex-col">
        <h4 className="text-sm font-bold text-[#0F172A] tracking-tight">{title}</h4>
        {subtitle && (
          <span className="text-xs text-[#94A3B8] font-medium mt-0.5 leading-none">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
