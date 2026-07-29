"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExperienceProfile } from "@/components/experience/NavigationExperienceProvider";

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  children?: React.ReactNode;
  variant?: "primary" | "default" | "outline" | "ghost" | "destructive" | "link";
  isLoading?: boolean;
}

export default function AsyncButton({
  children,
  onClick,
  disabled,
  className,
  variant = "primary",
  isLoading: externalLoading,
  ...props
}: AsyncButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const profile = useExperienceProfile();
  const loading = externalLoading || internalLoading;

  const handlePress = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    setInternalLoading(true);
    try {
      await onClick(e);
    } finally {
      setInternalLoading(false);
    }
  };

  const variantStyles = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] shadow-[var(--shadow-sm)] border-transparent",
    default:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] shadow-[var(--shadow-sm)] border-transparent",
    outline:
      "bg-[var(--card-bg)] text-[var(--text-body)] border-[var(--border)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)] shadow-[var(--shadow-sm)]",
    ghost:
      "bg-transparent text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)] border-transparent",
    destructive:
      "bg-red-600 text-white hover:bg-red-700 shadow-[var(--shadow-sm)] border-transparent",
    link: "bg-transparent text-[var(--primary)] underline-offset-4 hover:underline p-0 border-transparent",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={handlePress}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer px-4 py-2",
        profile?.level === "premium" && "premium-hoverable",
        variantStyles[variant] || variantStyles.primary,
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
