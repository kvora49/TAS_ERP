/**
 * Returns the base application URL for link generation.
 * Uses `NEXT_PUBLIC_APP_URL` env variable in production if provided,
 * otherwise falls back to `window.location.origin` or `http://localhost:3000`.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

/**
 * Returns the public customer invoice view URL for a given bill ID.
 */
export function getPublicBillUrl(billId: string): string {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/p/bill/${billId}`;
}
