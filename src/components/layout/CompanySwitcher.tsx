"use client";

import React from "react";
import { useCompany } from "@/components/providers/CompanyProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleBadge } from "@/components/shared/RoleBadge";

export function CompanySwitcher() {
  const {
    activeCompany,
    companies,
    isMultiCompany,
    isSwitching,
    switchCompany,
  } = useCompany();

  const logoUrl = activeCompany?.logo_url;
  const companyName = activeCompany?.name || "TAS ERP";
  const activeRole = activeCompany?.role || "staff";

  // Single-company view: Plain static branding (no dropdown, no caret, zero clutter)
  if (!isMultiCompany) {
    return (
      <div className="flex items-center gap-2 select-none min-w-0">
        <img
          src={logoUrl || "/logo.png"}
          alt={companyName}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-[var(--card-bg)] border border-[var(--border)] p-0.5 shadow-xs shrink-0"
        />
        <div className="flex flex-col justify-center leading-tight min-w-0">
          <span className="font-extrabold text-[var(--text-primary)] tracking-wide text-xs sm:text-sm leading-none truncate">
            TAS ERP
          </span>
          {companyName && (
            <span className="text-[9px] sm:text-[10px] font-bold text-[var(--primary)] tracking-wider uppercase leading-tight mt-0.5 truncate hidden sm:inline-block max-w-[120px] md:max-w-[180px]">
              {companyName}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Multi-company view (2+ companies): Interactive dropdown switcher
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 select-none min-w-0 px-2 py-1 -ml-1 rounded-xl transition-all cursor-pointer outline-none group",
          "hover:bg-[var(--page-bg)] border border-transparent hover:border-[var(--border)]"
        )}
        disabled={isSwitching}
      >
        <div className="relative shrink-0">
          <img
            src={logoUrl || "/logo.png"}
            alt={companyName}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-[var(--card-bg)] border border-[var(--border)] p-0.5 shadow-xs shrink-0"
          />
          {isSwitching && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center text-left leading-tight min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-extrabold text-[var(--text-primary)] tracking-wide text-xs sm:text-sm leading-none truncate">
              TAS ERP
            </span>
            <ChevronDown
              size={12}
              className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0"
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold text-[var(--primary)] tracking-wider uppercase leading-tight mt-0.5 truncate hidden sm:inline-block max-w-[110px] md:max-w-[160px]">
            {companyName}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-64 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-lg mt-1 p-1.5 z-50 animate-in fade-in-80 duration-150"
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
          <span>Switch Company</span>
          <span className="text-[9px] font-medium text-[var(--text-faint)] lowercase">
            {companies.length} companies
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--border)] my-1" />

        <div className="max-h-64 overflow-y-auto space-y-1">
          {companies.map((company) => {
            const isCurrent = company.isActive || company.id === activeCompany?.id;
            return (
              <DropdownMenuItem
                key={company.id}
                onClick={() => switchCompany(company.id)}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs font-medium",
                  isCurrent
                    ? "bg-[var(--primary-light)] text-[var(--primary-dark)] dark:text-[var(--primary)]"
                    : "text-[var(--text-body)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      <Building2 size={13} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-[130px]">
                      {company.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] capitalize">
                      {company.role}
                    </span>
                  </div>
                </div>

                {isCurrent && (
                  <Check size={14} className="text-[var(--primary)] shrink-0 stroke-[2.5]" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
