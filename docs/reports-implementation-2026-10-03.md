# Reports implementation ? 3 October 2026

## Delivered in the workspace

The six approved heavy aggregation routes use one Supabase RPC each. Existing response fields remain compatible, with additive completeness and insight fields. SQL aggregation was not extended to Medium/Low routes or external GST/IRIS calls. Three conversions were already committed and three existed as working changes; forward migrations correct and complete those implementations without rewriting migration history.

| Route | SQL function | Approximate JS fetch/aggregation lines displaced | Volatility |
| --- | --- | ---: | --- |
| /api/reports/payments | fn_report_payments | 740 | STABLE |
| /api/reports/analysis | fn_report_analysis | 340 | STABLE |
| /api/reports/financial/pl | fn_report_financial_pl | 435 | STABLE |
| /api/reports/financial/balance | fn_report_financial_balance | 350 | STABLE |
| /api/parties/[id]/ledger | fn_party_ledger | 530 | STABLE |
| /api/reports/stock-valuation | fn_report_stock_valuation | 55 | STABLE |

Counts include query/mapping boilerplate and prior conversions; they are approximate net route-line differences, not exact reduction-expression counts. First three compare against eaf5324^; last three against HEAD. All six functions use SECURITY INVOKER and include CPU/edge compatibility comments. STABLE is PostgreSQL statement snapshot semantics, not cross-request caching. The separate subscription queue claim is intentionally VOLATILE because it writes leases.

### Correctness and performance

- Posted payment received/payment made vouchers appear in party statements with references, signs and allocations; draft/cancelled vouchers are excluded.
- Invoice headers are counted once despite multiple items; P&L drill amounts reconcile with header totals. Legacy finished-goods purchases and recorded purchase returns are included.
- Due-date aging and historical outstanding use later unified allocation rollback, including backdated allocation creation and later write-off postings/reversals. Known assigned account movements roll back balances to the cutoff. These remain partial historical reconstructions where legacy sources are absent.
- Cash flow includes recorded expenses and salaries, adds payment modes rather than overwriting them, and exposes unassigned movement gaps.
- GST includes available raw/finished purchases, expenses and recorded adjustments; linked adjustments are deduplicated. Missing components remain source exceptions rather than invented splits. It is a provisional source summary, not a statutory eligibility/setoff calculation.
- Inventory uses recorded cost, separates quantities by unit and stops writing reconciliation data during report reads. Production and worker reports remove synthetic efficiency, recovery and WIP assumptions.
- Raw-row routes retain their existing computation but fetch complete pages, check errors and fail explicitly at the safety ceiling rather than silently truncating.
- Report query keys include company, user and filters; results remain fresh for five minutes and cached inactive for thirty. Mutation invalidation and explicit payment/advance invalidation refresh affected reports. URL filters restore before initial queries.

### Premium report features

All eight report pages use shared report controls: saved views/favourites, recent views, authenticated filtered links, search, sorting, pagination, column visibility, pinning, resizing, density and grouping. Private saved views sync to owner/company-scoped database preferences. Supported registers export all filtered rows to Excel/PDF and print, not just the visible page. Unsupported complex table structures retain native rendering. PDF uses TAS ERP branding; custom company logos and visual export QA remain pending.

Analysis adds recorded design contribution with missing-cost exceptions, size/colour demand versus current stock, current lot aging/activity and supplier recorded delivery evidence. Contribution excludes returns, charges and shared overhead; it is not full net design profit. Comparison modes use actual previous periods and zero-base growth remains unavailable.

Receivable/payable scenarios allow private collection/payment assumptions. P&L targets and revenue/COGS scenarios are private planning inputs, not posted budgets or committed forecasts.

Owner/admin users can schedule private Analysis, Payments, P&L, Balance Sheet, Party Ledger and Stock Valuation snapshots and download complete multi-sheet exports from an in-app history. Ledger snapshots include full posted history; stock snapshots capture current stock at execution, rather than claiming historical period stock. Daily/weekly/monthly periods use India time. There is no email delivery, public link or subscription support for every report. User/company access is checked at scheduling, execution and snapshot retrieval; service-only queue claims use exclusive leases.

### Accountant-reviewed source workflow

Migration 23 adds audited corrections: a financial user creates a correction draft from an approved position, a different financial user reviews it, and approval atomically supersedes the former position while preserving both records and histories.

The new /reports/opening-balances page supports company-scoped drafts with recorded account values, stock/WIP quantities, units and source references. Owner/admin/accountant users prepare and submit balanced entries; a different financial user reviews them and explicitly confirms a complete company position before approval. Version checks prevent stale writes. Approved entries are immutable, and each transition is atomically audited. Direct authenticated table writes are not granted.

The Balance Sheet uses an approved position only for its exact requested date; otherwise it displays the existing preliminary projection. Equity, non-current assets and independent reconciliation are unavailable without reviewed records. Company-wide historical WIP uses exact opening/closing approval dates and stays unavailable for unsupported filtered cohorts. P&L and Analysis use approved inventory/WIP values only when both period boundaries exist, with the accounting basis disclosed. The workflow captures actual accountant-entered values; no records were populated or approved here.

Analysis includes an exception centre with complete counts and explicitly bounded drill rows. Missing costs, overdue invoices, negative stock, unclassified purchases and overdue lots link to sources. Financial users can correct legacy purchase classification, due dates and recorded tax fields without resetting existing settlements. Credit/debit-note and return APIs preserve recorded tax values, including the distinction between unknown and zero. Linked return adjustments are deduplicated and copied only where compatible source fields are missing.

### PWA/mobile coverage

Sales, Purchases, Payments, Party Reports, Inventory, Production, Financial and Analysis share mobile section selectors and complete stacked register fields with column labels. Names/amounts wrap, resized widths are overridden on phones, and desktop-only abbreviated mobile lists no longer hide information. Pagination bounds rendered rows while exports include all filtered rows. Financial trace cards stack on phones.

These changes have source and rendering regression checks. An authenticated browser was unavailable in this environment, so actual installed-PWA visual verification, touch interaction, screen-width and print/PDF visual QA have not been performed.

## Validation and rollout

npm run test:reports passes: real SQL execution in PGlite, six RPC shapes and volatility/security, JavaScript fixture parity, invoice totals, vouchers, historical cutoffs, tenant RLS, garment insights, preferences privacy, subscription access/leases, cashflow/GST/worker/production facts, and mobile register field labels/full export counts. Fixture tables are minimal; tests do not prove every production edge case or deployed schema compatibility.

npm run typecheck passed. Targeted report lint passed. Repository-wide lint previously encountered an existing unescaped apostrophe in settings/companies/page.tsx:597. No live database migration or production deployment occurred.

Apply any pending September RPC migrations through 20260928000006, then October migrations 20261003000000 through 20261003000023 in order. Verify deployed source columns, caller RLS, authenticated grants and service-role permissions before release. Analysis replaces its original five-argument function with a six-argument function with a default comparison mode.

The existing hourly Worker scheduled handler now invokes the trusted subscription job. The bearer-protected /api/cron/report-subscriptions endpoint remains available for a trusted scheduler. Deploy and configure the Worker/required secrets to activate it; no scheduler was deployed or executed here. Snapshot access expires after thirty days, and each job deletes a bounded batch of expired snapshots. Failed jobs store generic errors; recipient access is rechecked before execution.

## Remaining capability/source gaps

The attached roadmap still contains source-model and operational work. Verified opening/closing accounting records must be entered and reviewed; there is no rolling general ledger or automated depreciation/asset schedule. Approved positions support audited superseding corrections, but do not post journal transactions into operational ledgers. Historical WIP is company-wide at reviewed dates, not a reconstructed per-lot movement ledger. Complete legacy settlement/advance sources, separate internal-transfer records and independent bank reconciliation remain gaps.

Recorded source capture is wired for the note/return and legacy purchase paths above; other existing entry screens and historical records still need source-specific backfill. Shared company costs cannot always be attributed to brands/bill cohorts. Promised supplier dates, committed corporate budgets, reserved stock and complete design cost attribution are not available and are not invented. Planning targets remain private assumptions.

SQL preserves detail rows for API compatibility, so large registers can still produce large payloads. Complete server-side register pagination, deployed EXPLAIN/load/edge CPU measurements, subscriptions for the remaining report pages, real-device PWA QA and production rollout remain outstanding. No sub-10ms performance claim is made.
