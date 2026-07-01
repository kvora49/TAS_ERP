import React from "react";
import { cn } from "@/lib/utils";

interface ColourDotProps {
  colourHex?: string | null;
  colourName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function ColourDot({
  colourHex,
  colourName,
  size = "md",
  className,
}: ColourDotProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const bgStyle = colourHex ? { backgroundColor: colourHex } : undefined;

  return (
    <span
      className={cn(
        "inline-block rounded-full border border-[#E5E7EB] shadow-sm shrink-0 align-middle",
        sizeClasses[size],
        !colourHex && "bg-gradient-to-tr from-red-500 via-green-500 to-blue-500",
        className
      )}
      style={bgStyle}
      title={colourName || (colourHex ? `Color: ${colourHex}` : "Multi-colour")}
    />
  );
}
