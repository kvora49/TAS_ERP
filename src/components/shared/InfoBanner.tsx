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
      wrapper: "bg-blue-500/10 border border-blue-500/20",
      icon: Info,
      iconColor: "text-[var(--primary)]",
      textColor: "text-[var(--text-body)]",
    },
    warning: {
      wrapper: "bg-amber-500/10 border border-amber-500/20",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    danger: {
      wrapper: "bg-red-500/10 border border-red-500/20",
      icon: AlertCircle,
      iconColor: "text-red-500",
      textColor: "text-red-700 dark:text-red-300",
    },
    about: {
      wrapper: "bg-purple-500/10 border border-purple-500/20",
      icon: Info,
      iconColor: "text-purple-500",
      textColor: "text-purple-700 dark:text-purple-300",
      titleColor: "text-purple-600 dark:text-purple-400",
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
              variant === "about" ? "text-purple-600 dark:text-purple-400" : "text-[var(--text-primary)]"
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
