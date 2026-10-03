/** Read bounded database pages so PostgREST's default row cap cannot silently alter totals.
 * Existing report response contracts require detail arrays; the register renders a page only.
 */
export async function readReportRows<T = any>(query: any): Promise<{ data: T[]; error: any }> {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; offset < 100_000; offset += size) {
    const result = await query.range(offset, offset + size - 1);
    if (result.error) return { data: [], error: result.error };
    const page = result.data || [];
    rows.push(...page);
    if (page.length < size) return { data: rows, error: null };
  }
  return { data: [], error: new Error("Report exceeds the supported detail limit; narrow the period") };
}

export function requireReportResults(results: Array<{ error?: unknown }>) {
  for (const result of results) if (result.error) throw result.error;
}
