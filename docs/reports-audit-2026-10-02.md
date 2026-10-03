# Reports and analysis inspection — 2 October 2026

Scope: static inspection of report pages, API routes, payment creation routes, and committed database migrations. No application or database changes were made. This is not a live-database reproduction or visual browser review. Deployed schema and migration state still need verification.

## Priority findings

### P0 — Payment vouchers silently disappear from party reports

- `src/app/api/reports/party-reports/route.ts:110` requests `reference_number` and `notes` from payments; the all-transactions query at line 1027 also requests `reference_number`.
- The committed payments schema (`20260719000000_phase7_setup.sql`) defines `reference_no` and `remarks`. Payment creation APIs and RPCs use these names too.
- The report does not check `paymentsRes.error` before using `paymentsRes.data ?? []`. Against the committed schema, the invalid select fails and is rendered as no payment entries. This explains the reported symptom in the report ledger and all-transactions paths; production confirmation requires checking the deployed schema and actual response.
- The separate party-detail ledger already unions unified payments. Do not conclude payments are absent from every ledger implementation or that payment creation failed.
- Fix the field contract, check every component query, and display an explicit report failure instead of plausible partial totals.

### P0 — Payments / Receipts filter excludes receipts

- `src/app/(dashboard)/reports/party-reports/page.tsx` gives this combined option the value `payment`.
- The API emits received payments as `voucher_type: receipt`, then matches the selected value exactly at line 321.
- Either provide separate Receipt and Payment filters or make the combined filter include both.

### P0 — Statement balances do not belong to the selected period

- Both party-report statement and standalone party-statement routes build balances over all fetched dates, then filter visible rows by date.
- They return the master opening balance and the all-history ending balance. Transactions after the selected end date affect the displayed closing figure.
- Required: opening at the start date, movements in the period, and closing at the end date. Voucher/search filters need separate visible-row subtotals without silently redefining the actual account balance.

### P0 — Analysis contains fabricated breakdowns

In `20260928000002_rpc_fn_report_analysis.sql`:

- Sales categories are fixed at 93% manufactured and 7% purchased (lines 154–155).
- Raw-material purchase categories are split using 53%, 33%, and 14% (lines 222–225).
- Stock health uses fixed 35%, 24%, 14%, and 12% multipliers (lines 517–521).
- Overdue payables are 49% of outstanding (line 352).
- Overdue receivables use payment status `unpaid`, rather than due dates (line 342).

The analysis UI additionally derives Rewash and Rejected from fixed percentages (`analysis/page.tsx:388`). The supplier report displays a fixed 26 Days for average payment days. These should be calculated from records or shown as unavailable, with any legitimate estimates explicitly identified.

### P1 — Filters and comparisons promise behavior they do not implement

- Analysis RPC accepts `p_brand_id` and `p_bill_type` but never references them beyond its signature.
- Analysis UI stores `compareWith`, but does not include it in the query key or API request.
- Analysis links use `tab=customer` and `tab=supplier`; party reports initialize local state to `statement`, without reading these parameters, and actual tab IDs are `customer_report` and `supplier_report`.
- Purchase-report invoices are supplier-filtered while the parallel returns/payment queries are not equivalently filtered. The outgoing payment query also lacks a cancellation filter.
- Apply the same scope to every contributor to a total, chart, row set, and export. Do not expose unsupported controls.

### P1 — Aging is not remaining invoice debt

- Party statement aging sums transaction debit/credit amounts based on age, not unpaid balances after allocations. Paid invoices can remain in aging.
- Statement aging uses today's date rather than the selected historical cutoff.
- The standalone statement ages debit rows only, which does not represent supplier invoice liabilities.
- Required: outstanding per invoice at cutoff, due-date or invoice-date basis, not-yet-due bucket, and overdue buckets. Keep unapplied advances and credits separately visible.

### P1 — Return adjustments can be counted twice

- The party-report statement adds sales returns and all credit notes, including notes linked to those returns. It similarly adds purchase returns and all debit notes, including linked notes.
- The party-detail ledger has different rules: credit notes represent sales returns, and purchase-return-linked debit notes are excluded.
- Reconcile a linked return/note pair and define one financial posting per business event across all reports.

### P1 — Profit and historical financial position use inconsistent bases

- Analysis gross profit is net sales minus net purchases (`analysis.sql:235`). It does not account for inventory consumption or manufacturing cost flows.
- Financial P&L RPC uses purchases less current closing stock, clamped to zero, without an opening-stock component in that calculation (`financial_pl.sql:372`).
- Financial balance RPC reads current bank balances even for a historical `p_to` (`financial_balance.sql:69`).
- Analysis reads current finished stock and current bank balances; its opening cash is inferred from current balance and only period unified payments.
- Define inventory valuation, cost recognition, and cutoff rules once. Reconstruct historical balances from dated movements or validated snapshots. Label current snapshot cards distinctly from period metrics.

### P1 — Multiple report implementations have drifted

- Party-detail ledger RPC, standalone party statement, and combined party reports construct their own transaction lists.
- Coverage differs for job work, legacy payments, salary/advances, write-offs, pending cheques, allocation detail, opening signs, and voucher numbers.
- The unified-payment branch in the party ledger displays reference number or a shortened UUID rather than `payment_number`.
- Several routes consume unpaginated source arrays and suppress component query errors. Large-data completeness requires explicit verification against the configured API row cap; no production truncation was proven in this inspection.

## Expected content and current coverage

| Area | Present in implementation | Required improvements / validation |
|---|---|---|
| Party ledger | Date, voucher, debit/credit, running balance, filters; detail ledger has allocations and pending cheques | Restore receipts/payments, real voucher numbers, period opening/closing, consistent transaction coverage, reversal handling, direct voucher details |
| Outstanding and aging | Dedicated tabs, party summaries, aging buckets | Remaining allocated debt at cutoff, due-date calculation, advances/credits, customer/supplier dual-role clarity, reconciliation to ledger |
| Sales and purchases | Registers, totals, returns, party breakdowns, bill-type filters | Identical scope for invoices/returns/payments, separate taxable amounts/taxes/gross totals, consistent cancellation/deletion handling |
| Payment reporting | Dedicated reporting page and RPC; receive/make workflows | Reconcile posted receipts/payments with party ledger and cash/bank movements; distinguish draft/pending/cleared/bounced/cancelled; allocations and unapplied amounts |
| Analysis | KPI cards, trends, categories, rankings, alerts, comparison UI | Remove fixed business figures, working filters/comparison periods, real movement-based inventory health, metric definitions and drill-down |
| Inventory | Stock report and valuation report; raw and finished stock queries | Historical valuation, movement reconciliation, warehouse/brand consistency, slow/non-moving based on dated movements, WIP visibility |
| Production | Production reporting and stage/worker data | Recorded defect/rework metrics rather than constants, clear stage-vs-finished-output denominators, lot cost and WIP reconciliation |
| Financial | P&L, balance sheet, cash-flow and consolidated financial routes | Shared calculation basis, historical balances, inventory cost treatment, actual cash-movement coverage, account-level reconciliation |
| GST | Summary route and financial GST reporting exist | Reconcile invoices and adjustments to report scope; separately inspect detailed tax calculations before claiming correctness |
| Export and navigation | Excel/print utilities and report links exist | Export complete filtered records with scope/cutoff metadata; preserve filters in drill-down; verify totals against screen and source |

## Recommended implementation sequence

1. Restore payment queries and voucher filters; stop silent partial reports; show actual payment voucher numbers.
2. Establish a shared party-transaction projection with source IDs, direction, status, allocation details, reversal relationships, and consistent signs. Use it in all ledger surfaces.
3. Correct period balances, returns/notes deduplication, advances, outstanding and aging.
4. Replace invented analysis metrics; connect filters and comparison periods; fix drill-down links.
5. Reconcile profit, stock, cash flow and historical balances using shared definitions.
6. Improve usability: distinct Receipt/Payment labels, expandable allocations, clear Dr/Cr balances, scoped totals, accurate refresh timestamps, clear unavailable/error/empty states, consistent export metadata.

## Acceptance scenarios for the repair

- Customer invoice 1,000 plus receipt 400: one receipt voucher, credit 400, remaining receivable 600 across all ledger surfaces.
- Supplier invoice 1,000 plus payment 300: one payment voucher, debit 300, remaining payable 700.
- A payment before the start date changes brought-forward balance; one after the end date does not change period closing balance.
- A fully paid overdue invoice contributes zero to remaining-debt aging; a partial invoice contributes only the residual.
- A return with a linked note affects the account once.
- An advance appears once when received/paid; later allocation does not create a second cash movement.
- Pending, cleared, bounced, cancelled and reversed transactions follow explicit posting rules.
- Mixed customer/supplier parties, legacy payments, job work, write-offs and opening balances reconcile.
- Brand, bill type, party, date and comparison controls produce matching rows, cards, charts and exports.
- Records exceeding the API row cap remain complete; failed queries cannot appear as successful zero-value reports.
- Historical balances remain unchanged when unrelated later transactions are added.

Before implementation sign-off, validate these against the deployed schema, migration history and a read-only sample of affected vouchers, then perform browser and export checks. No live records were inspected in this audit.
