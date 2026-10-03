export function reportSubscriptionPeriod(cadence: string, at: Date) {
  const day = at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end);
  if (cadence === "monthly") { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 1); end.setUTCDate(0); }
  else { end.setUTCDate(end.getUTCDate() - 1); start.setUTCDate(start.getUTCDate() - (cadence === "weekly" ? 7 : 1)); }
  const next = new Date(`${day}T03:30:00Z`);
  if (cadence === "monthly") { next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1); }
  else next.setUTCDate(next.getUTCDate() + (cadence === "weekly" ? 7 : 1));
  return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10), next: next.toISOString() };
}
