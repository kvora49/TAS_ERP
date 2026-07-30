"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { getFutureProofYearOptions } from "@/lib/utils";

interface DateFilters {
  financialYear: string;
  fromDate: string;
  toDate: string;
  asOnDate?: string;
  compareWith: string;
}

interface FinancialYearDateFiltersProps {
  onApply: (filters: DateFilters) => void;
  onClear: () => void;
  mode?: "range" | "asOn";
}

export default function FinancialYearDateFilters({
  onApply,
  onClear,
  mode = "range",
}: FinancialYearDateFiltersProps) {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [fromDate, setFromDate] = useState(`${currentYear - 1}-04-01`);
  const [toDate, setToDate] = useState(`${currentYear}-03-31`);
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [compareWith, setCompareWith] = useState("none");

  // Dynamic future-proof Financial Years
  const fyYears = getFutureProofYearOptions(2020, 10);
  const fyOptions = fyYears.map((y) => {
    const nextShort = (y + 1).toString().slice(-2);
    return { value: `${y}-${nextShort}`, label: `FY ${y}-${nextShort}` };
  });

  const handleApply = () => {
    onApply({
      financialYear,
      fromDate,
      toDate,
      asOnDate: mode === "asOn" ? asOnDate : undefined,
      compareWith,
    });
  };

  const handleClearLocal = () => {
    setFinancialYear(defaultFY);
    setFromDate(`${currentYear - 1}-04-01`);
    setToDate(`${currentYear}-03-31`);
    setAsOnDate(new Date().toISOString().split("T")[0]);
    setCompareWith("none");
    onClear();
  };

  return (
    <div className="flex flex-wrap items-end gap-4 text-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
          Financial Year
        </label>
        <select
          value={financialYear}
          onChange={(e) => setFinancialYear(e.target.value)}
          className="h-9 pl-3 pr-8 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none min-w-[120px] cursor-pointer"
        >
          {fyOptions.map((fy) => (
            <option key={fy.value} value={fy.value}>{fy.label}</option>
          ))}
        </select>
      </div>

      {mode === "range" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            As On Date
          </label>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
          Compare With
        </label>
        <select
          value={compareWith}
          onChange={(e) => setCompareWith(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none min-w-[140px]"
        >
          <option value="none">No Comparison</option>
          <option value="previous_period">Previous Period</option>
          <option value="previous_year">Previous Year</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleApply}
          className="h-9 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold px-4 rounded-lg"
        >
          Apply
        </Button>
        <Button
          variant="outline"
          onClick={handleClearLocal}
          className="h-9 border-[var(--input-border)] hover:bg-[var(--border-light)] text-[var(--text-body)] text-xs font-semibold px-4 rounded-lg"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
