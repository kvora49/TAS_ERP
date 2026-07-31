import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(dateString: string | Date | null | undefined, customFormat?: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, '0');
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  const monthName = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();

  const fmt = customFormat || "";
  if (fmt.includes("DD MMM YYYY")) {
    return `${day} ${monthName} ${year}`;
  }
  if (fmt.includes("YYYY-MM-DD")) {
    return `${year}-${monthNum}-${day}`;
  }
  if (fmt.includes("MM/DD/YYYY")) {
    return `${monthNum}/${day}/${year}`;
  }
  // Default fallback: DD/MM/YYYY
  return `${day}/${monthNum}/${year}`;
}

export function formatCurrency(val: number, currencyStr?: string): string {
  let currencyCode = "INR";
  let locale = "en-IN";

  if (currencyStr) {
    if (currencyStr.includes("USD")) {
      currencyCode = "USD";
      locale = "en-US";
    } else if (currencyStr.includes("EUR")) {
      currencyCode = "EUR";
      locale = "de-DE";
    } else if (currencyStr.includes("GBP")) {
      currencyCode = "GBP";
      locale = "en-GB";
    }
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(val || 0);
  } catch {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  }
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
