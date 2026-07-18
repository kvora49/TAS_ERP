"use client";

import React, { useState } from "react";
import { Info, FileSpreadsheet, FileText, Printer, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportPageHeaderProps {
  title: string;
  infoTooltip: string;
  breadcrumbs: string[];
  filters?: React.ReactNode;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
}

export default function ReportPageHeader({
  title,
  infoTooltip,
  breadcrumbs,
  filters,
  onExportPDF,
  onExportExcel,
  onPrint,
}: ReportPageHeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Top Breadcrumbs and Actions row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium mb-1.5">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                <span>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
          {/* Title and Info icon */}
          <div className="flex items-center gap-2 relative">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
            <div
              className="relative cursor-pointer"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Info className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" />
              {showTooltip && (
                <div className="absolute left-6 top-0 z-50 w-64 p-3.5 bg-[var(--sidebar-bg)] text-white text-xs rounded-lg shadow-lg border border-[var(--sidebar-border)] leading-relaxed">
                  {infoTooltip}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              className="flex items-center gap-1.5 text-xs font-semibold h-9 px-3 border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--border-light)]"
            >
              <FileText className="h-4 w-4 text-red-500" />
              <span>Export PDF</span>
            </Button>
          )}
          {onExportExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              className="flex items-center gap-1.5 text-xs font-semibold h-9 px-3 border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--border-light)]"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span>Export Excel</span>
            </Button>
          )}
          {onPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="flex items-center gap-1.5 text-xs font-semibold h-9 px-3 border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--border-light)]"
            >
              <Printer className="h-4 w-4 text-gray-500" />
              <span>Print</span>
            </Button>
          )}
          {filters && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs font-semibold h-9 px-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row container */}
      {filters && showFilters && (
        <div className="p-4 bg-white rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-light)] transition-all duration-200">
          {filters}
        </div>
      )}
    </div>
  );
}
