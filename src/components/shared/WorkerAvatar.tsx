"use client";

import { cn } from "@/lib/utils";

interface WorkerAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function WorkerAvatar({ name, size = "md", className }: WorkerAvatarProps) {
  const getInitials = (str: string) => {
    if (!str) return "?";
    return str
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const initials = getInitials(name);

  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-14 h-14 text-xl",
    lg: "w-16 h-16 text-2xl",
  };

  return (
    <div
      className={cn(
        "rounded-full bg-[#6366F1] flex items-center justify-center font-bold text-white shadow-sm shrink-0 select-none",
        sizeClasses[size],
        className
      )}
    >
      <span>{initials}</span>
    </div>
  );
}
