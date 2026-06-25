import React from "react";
import { Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoBannerProps {
  variant?: "info" | "warning" | "danger" | "about";
  title?: string;
  text: string;
  className?: string;
}

export function InfoBanner({
  variant = "info",
  title,
  text,
  className,
}: InfoBannerProps) {
  const configs = {
    info: {
      wrapper: "bg-[#EFF6FF] border border-[#DBEAFE]",
      icon: Info,
      iconColor: "text-[#6366F1]",
      textColor: "text-[#374151]",
    },
    warning: {
      wrapper: "bg-[#FEF9C3] border border-[#FDE68A]",
      icon: AlertTriangle,
      iconColor: "text-[#D97706]",
      textColor: "text-[#92400E]",
    },
    danger: {
      wrapper: "bg-[#FEF2F2] border border-[#FECACA]",
      icon: AlertCircle,
      iconColor: "text-[#DC2626]",
      textColor: "text-[#991B1B]",
    },
    about: {
      wrapper: "bg-[#EDE9FE] border border-[#DDD6FE]",
      icon: Info,
      iconColor: "text-[#7C3AED]",
      textColor: "text-[#5B21B6]",
      titleColor: "text-[#6D28D9]",
    },
  };

  const current = configs[variant];
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg mt-4 text-sm w-full select-none",
        current.wrapper,
        className
      )}
    >
      <Icon className={cn("size-4 shrink-0 mt-0.5", current.iconColor)} />
      <div className="flex flex-col">
        {(title || (variant === "about" && !title)) && (
          <span
            className={cn(
              "font-semibold mb-0.5",
              variant === "about" ? "text-[#6D28D9]" : "text-slate-800"
            )}
          >
            {title || "About"}
          </span>
        )}
        <span className={current.textColor}>{text}</span>
      </div>
    </div>
  );
}
