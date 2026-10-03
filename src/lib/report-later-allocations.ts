import { readReportRows, requireReportResults } from "@/lib/report-data";

/** Match report_paid_at: later allocation entry OR later voucher date.
 * A backdated voucher allocated after the cutoff must not rewrite historical dues.
 */
export async function readLaterAllocations(client: any, business: string, cutoff: string) {
  const next = new Date(`${cutoff}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const query = () => client.from("payment_allocations")
    .select("id,bill_id,bill_type,allocated_amount,created_at,payment:payments!inner(payment_date,status)")
    .eq("business_id", business).in("payment.status", ["completed", "success"]).order("id");
  const results = await Promise.all([
    readReportRows(query().gt("payment.payment_date", cutoff)),
    readReportRows(query().gte("created_at", next.toISOString())),
  ]);
  requireReportResults(results);
  const writeoffs = () => client.from("write_offs").select("id,bill_id,bill_type,amount,written_off_at,reversed_at")
    .eq("business_id", business).order("id");
  const adjustments = await Promise.all([
    readReportRows(writeoffs().gte("written_off_at", next.toISOString())),
    readReportRows(writeoffs().gte("reversed_at", next.toISOString())),
  ]);
  requireReportResults(adjustments);
  const recorded = Array.from(new Map(adjustments.flatMap(result => result.data).map(row => [row.id, row])).values());
  const deltas = recorded.map(row => {
    const activeAtCutoff = row.written_off_at?.slice(0, 10) <= cutoff && (!row.reversed_at || row.reversed_at.slice(0, 10) > cutoff);
    const current = !row.reversed_at ? Number(row.amount) : 0;
    return { id: `writeoff:${row.id}`, bill_id: row.bill_id, bill_type: row.bill_type, allocated_amount: current - (activeAtCutoff ? Number(row.amount) : 0) };
  });
  return [...Array.from(new Map(results.flatMap(result => result.data).map(row => [row.id, row])).values()), ...deltas];
}
