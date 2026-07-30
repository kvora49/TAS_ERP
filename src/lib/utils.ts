import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val || 0);
}

/**
 * Generates a future-proof list of years starting from a baseline year (e.g. 2020)
 * dynamically extending up to currentYear + futureBuffer (default 10 years).
 * Automatically rolls forward over time without requiring code changes in future years.
 */
export function getFutureProofYearOptions(startYear = 2020, futureBuffer = 10): number[] {
  const currentYear = new Date().getFullYear();
  const maxYear = Math.max(currentYear + futureBuffer, currentYear);
  const length = maxYear - startYear + 1;
  return Array.from({ length }, (_, i) => maxYear - i);
}
