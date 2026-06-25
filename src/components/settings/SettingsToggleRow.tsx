import React from "react";
import { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SettingsToggleRowProps {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function SettingsToggleRow({
  icon: Icon,
  label,
  subtitle,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: SettingsToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3.5 border-b border-[#F3F4F6] last:border-0 select-none",
        disabled && "opacity-60",
        className
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3 text-left">
        <div className="w-8 h-8 rounded-md bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
          <Icon className="size-4 text-[#64748B]" />
        </div>
        <div>
          <span className="text-sm font-medium text-[#374151] block leading-none">
            {label}
          </span>
          {subtitle && (
            <span className="text-xs text-[#94A3B8] block mt-1.5 leading-none">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
      />
    </div>
  );
}
