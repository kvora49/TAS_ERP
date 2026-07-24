"use client";

import { LogOut } from "lucide-react";
import { useLogout } from "@/hooks/useLogout";

interface SidebarUserProps {
  user: {
    fullName: string;
    role: string;
  } | null;
}

export function SidebarUser({ user }: SidebarUserProps) {
  const { logout: handleLogout } = useLogout();

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="mt-auto border-t border-[#1E293B] p-3 flex items-center justify-between gap-2 relative group">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-lg shadow-[#6366F1]/10">
          {getInitials(user.fullName)}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold text-white truncate leading-none mb-0.5">
            {user.fullName}
          </p>
          <p className="text-[10px] text-[#94A3B8] truncate leading-none font-semibold uppercase">
            {user.role}
          </p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B] transition-colors cursor-pointer"
        title="Log Out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
