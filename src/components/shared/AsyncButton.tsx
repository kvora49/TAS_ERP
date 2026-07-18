"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  children?: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive" | "link";
}

export default function AsyncButton({
  children,
  onClick,
  disabled,
  className,
  variant = "default",
  ...props
}: AsyncButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    setLoading(true);
    try {
      await onClick(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={handlePress}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
