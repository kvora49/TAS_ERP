"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export function getModuleFromPath(pathname: string): string | null {
  if (pathname.startsWith("/master-data")) return "Master Data";
  if (pathname.startsWith("/parties")) return "Parties";
  if (pathname.startsWith("/purchases")) return "Purchases";
  if (pathname.startsWith("/production")) return "Production";
  if (pathname.startsWith("/finished-stock") || pathname.startsWith("/stock") || pathname.startsWith("/raw-materials")) return "Stock";
  if (pathname.startsWith("/scan")) return "Scan (PWA)";
  if (pathname.startsWith("/sales")) return "Sales & Billing";
  if (pathname.startsWith("/payments") || pathname.startsWith("/expenses") || pathname.startsWith("/finance") || pathname.startsWith("/misc-income") || pathname.startsWith("/salary")) return "Payments & Finance";
  if (pathname.startsWith("/reminders")) return "Reminders & WhatsApp";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  return null;
}

interface ModuleGuardProps {
  children: React.ReactNode;
}

export function ModuleGuard({ children }: ModuleGuardProps) {
  const pathname = usePathname();
  const { canView, isLoading } = usePermissions();

  const moduleName = getModuleFromPath(pathname);

  // If page doesn't map to a restricted module or is root dashboard
  if (!moduleName || pathname === "/") {
    return <>{children}</>;
  }

  // If permissions are loading
  if (isLoading) {
    return <>{children}</>;
  }

  // Check permission
  const allowed = canView(moduleName);

  if (!allowed) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-xs my-6 max-w-lg mx-auto select-none">
        <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Access Denied</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1.5 mb-6 leading-relaxed">
          Your role does not have permission to view the <strong className="text-[var(--text-primary)]">{moduleName}</strong> module. Please contact your company administrator to request access.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[var(--primary)]/20"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
