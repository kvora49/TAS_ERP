# Reports capability comparison and enhancement plan

Date: 2 October 2026. Companion to `reports-audit-2026-10-02.md`.

## Scope and interpretation

Inspected the report hub, all report page routes, tab definitions, shared reporting components, their API handlers, and the relevant committed RPC migrations. This is a source-based capability review, not a claim that every screen works in production. Live schema, real records, browser layout, performance, and exported-file rendering still require validation. No application or database behavior was changed.

“Present” below means a UI and/or calculation path exists. It does not imply verified correctness. “Recommended” means a proposed product enhancement, not an existing feature. Missing features refer to the inspected report area; equivalent capabilities may exist elsewhere in the ERP.

## Current navigation

The hub exposes 14 destinations but there are eight substantive report pages: Sales, Purchases, Payments, Party Reports, Inventory, Production, Financial, and Analysis.

- Profit & Loss, Balance Sheet, Cash Flow and GST Summary all redirect to `/reports/financial` without selecting their intended tab. Financial initializes to P&L.
- Stock Valuation redirects to Inventory, whose initial tab is valuation.
- Party Ledger redirects to Party Reports with `tab=statement`; the page already defaults to statement, but URL tab selection is not generally implemented there.
- Legacy API handlers remain for several redirected pages. These should not be mistaken for the calculations actually used by the current consolidated page.

Recommendation: keep familiar hub shortcuts, but deep-link them into one authoritative page/tab, preserving dates, filters and selected party. Avoid duplicate report definitions.

## Detailed current-versus-target comparison

### Sales

Present: Combined/Kacha/Pakka scopes; customer, payment-status and brand controls; summary cards, monthly trend, Excel export and inline details.

| Existing tab | Present | Complete baseline | Premium enhancement |
|---|---|---|---|
| Bill Register | Invoice/date/customer, totals, paid/outstanding, status, details | Distinguish taxable revenue, tax, discount, freight and gross value; consistent returns/payment scope; complete source rows | Configurable columns; group by customer/brand/design; period comparison; saved views |
| Ageing Analysis | Residual invoice amounts and current/overdue buckets | Explicit cutoff date, due date, all outstanding invoices at cutoff, credits and advances | Collection priority list; promised-payment date and follow-up owner when those records exist |
| Sales Returns | Return register, amounts and status | Original invoice, item quantities, reason, disposition and linked credit note, counted once | Return-rate trend by design, size, colour, customer and reason |
| Payment Modes | Received-payment distribution | Explain whether scope is receipts during period or allocations against selected invoices; match filters | Receipt-to-invoice allocation view, collection lag trend |
| Top Customers | Ranked sales, bill count, outstanding | Net sales after returns and clear ranking/share denominator | Contribution margin, repeat purchase, concentration and inactive-customer analysis |

Findings: sales aging uses today's date even for an earlier report period. Invoice-date filtering is different from “all outstanding as of cutoff”; expose these as distinct views. Confirm equivalent filters on every contributing dataset rather than assuming all cards inherit invoice scope.

### Purchases

Present: All/Raw Materials/Finished Goods scope; supplier and status controls; totals, monthly trend, drill-down and Excel export.

| Existing tab | Present | Complete baseline | Premium enhancement |
|--- | --- |--- |---|
| Purchase Register | Invoice, supplier, type, value, paid/outstanding and status | Quantity/UOM, taxable/tax/gross values, supplier reference, due dates, freight and landed cost | Item price history; supplier price comparison; purchase-to-receipt matching where linked records exist |
| Category Breakdown | Raw purchase item categories | Reconcile category amounts to selected invoices; disclose allocation of tax/freight | Spend concentration and price variance by fabric/accessory |
| Payables Ageing | Buckets using unpaid invoice residuals | Due-date-based cutoff view, payment terms, credits and advances | Weekly payment planning with projected cash effect |
| Purchase Returns | Return rows and supplier links | Apply supplier/type scope; link original purchase and debit adjustment | Supplier quality/return-rate scorecard |
| Top Suppliers | Purchase ranking, counts and outstanding | Net spend and consistent returns scope | Lead time, delivery reliability and rejection rates after sourcing those events |

Findings: aging currently uses invoice date and today's date. Returns/payment queries are not equivalently supplier-filtered; payment query lacks cancellation exclusion. Correct totals before adding rankings.

### Payments — all nine tabs

| Existing tab | Present | Complete baseline | Premium enhancement |
|---|---|---|---|
| Receivables | Unpaid bills, residual amounts, aging, top dues/recent receipts | Reconcile to party accounts; cutoff-aware allocations; credit and advance visibility | Collection worklist by amount, lateness and agreed commitment |
| Payables | Raw/finished purchase liabilities and aging | Consistent due-date basis, credits, advances and supplier/worker scope | Payment calendar and proposed payment batches |
| Receipts | Receipt register, payment-mode mix and trends | Real voucher number/status, account/reference, allocated and unapplied portions | Expand allocations and navigate directly to original voucher |
| Payments | Outgoing register, modes and trends | Distinguish supplier, worker, refund and other purposes; posted-status rules | Spend by purpose and payment approval trace where recorded |
| Accounts | Account cards, opening/current balances, received/paid, recent transactions | Period opening/closing from complete account movements; real transfers; full history | Bank reconciliation with unmatched and cleared items |
| Cheques | Received/issued views; pending, cleared, bounced summaries | Separate issue, due, deposit, clearing and bounce dates; financial effect once | Maturity calendar, upcoming liquidity exposure and linked reversal trail |
| Advances | Customer/supplier views; original/used/remaining values | Direction-safe classification; allocation history; refunds and cancellation | Unused-advance aging and candidate invoice matching |
| Transfers | Non-cash party payments labelled transfers | Distinguish party bank payments from internal bank/cash transfers; source/destination and paired movement IDs | Account transfer audit and reconciliation |
| All Transactions | UI tab exists | Implement matching backend branch and a documented scope of transaction sources | Searchable cash/bank day book, running account balance and source drill-down |

Confirmed findings in `20260928000001_rpc_fn_report_payments.sql`:

- UI sends `all_transactions`; RPC has no dedicated branch, and its fallback only accepts combined/upi/bank/cash. The committed function therefore yields no matching base rows for this tab.
- Accounts hardcodes transfers and netTransfers to zero, uses master/current balances, and limits transaction rows to 50. Recent-history limits must be explicit and must not limit full exports.
- Transfers selects non-cash payments, including cheques and UPI, to/from a party, and labels them Completed. This is not an internal-transfer register.
- The generic Excel handler expects `data.rows`; Accounts returns `accounts` and `txRows`. Export should be tab-specific rather than assuming one shape.

### Party Reports

| Existing tab | Present | Complete baseline | Premium enhancement |
|---|---|---|---|
| Statement / Ledger | Voucher rows, debit/credit, running balance, date/voucher scope | Repair payment query and Receipt filter; period balances; consistent opening signs and return/note handling | Statement pack with expandable allocations, voucher preview and clear reconciliation |
| Outstanding | Party balances and invoice dues | Separate debit/credit positions, unapplied advances and invoice debt; reconcile account balance | Credit exposure, limits and collection/payment priority |
| Aging | Bucket summaries | Residual debt at cutoff, selectable invoice/due-date basis, not-yet-due bucket | Aging migration across periods |
| Customer Report | Summary, customer-wise, top-customer and transaction subviews | Consistent sales/returns/receipts and balance measures | Customer profitability and retention |
| Supplier Report | Supplier purchases/payments/dues | Actual payment-days calculation, net spend and adjustment matching | Supplier reliability and price/quality history |
| All Party Transactions | Cross-party voucher list and breakdowns | Fix payment field contract, include intended source coverage and prevent duplicates | Search/group by voucher, party, document or amount; saved accountant views |

See the companion audit for detailed payment, aging and period-balance defects. Keep party reporting financially consistent with payment reports while giving each screen a distinct purpose.

### Inventory

| Existing tab | Present | Complete baseline | Premium enhancement |
|---|---|---|---|
| Stock Valuation | Finished goods/raw materials/accessories; quantity/value; brand breakdown and bill-type split | Recorded valuation basis, current-vs-historical distinction, separate units, scope-consistent totals | Value/quantity aging, turnover, slow/dead stock with last-movement evidence |
| Warehouse Stock | Warehouse totals and category breakdowns | Warehouse-specific balances and source movements, in-transit/reserved stock where tracked | Warehouse comparison and transfer recommendations based on actual demand |
| Design Stock | Design/colour/size stock detail | Trace to lots and movements; available vs reserved; variant-level completeness | Size-by-colour matrix, broken size sets, sell-through and stock-cover days |

Confirmed findings in `src/app/api/reports/inventory/route.ts`:

- GET invokes `reconcileFinishedStock`; the helper deletes finished-stock rows and inserts reconstructed rows. Report reads should not rebuild business records. Move reconciliation to a controlled, atomic process and expose its result/freshness.
- Missing cost can fall back to 60% of sale price. Show missing valuation or an explicitly labelled estimate, never an indistinguishable recorded cost.
- Bill-type valuation is apportioned by aggregate purchase ratios, not traced stock ownership/source. Label or replace it with a supported movement-based classification.
- Grand quantity adds finished pieces and raw/accessory quantities, potentially mixing units. Present quantities by UOM rather than one misleading total.
- Brand filtering applies to finished goods; raw materials remain. Define and explain attribution before presenting a whole-report brand total.
- Low-stock filtering filters raw materials but leaves finished goods unchanged. Dates are not consumed by this API; treat this as a current snapshot until historical support exists.

### Production — all eleven subviews

| Existing subview | Present | Complete baseline | Premium enhancement |
|---|---|---|---|
| Production Overview | Lots, status, input/output and yield summaries | Separate lot output from repeated stage throughput; scope defects and costs consistently | Plan vs actual, on-time completion and bottleneck alerts |
| Stage Analysis | Input/output, defects, stage cost and efficiency | Actual stage records; zero denominator shown as unavailable | Stage throughput, waiting time, cycle time and WIP queue |
| Rework & Damage | Defect-category counts/charts | Recorded defect reasons, quantities, outcomes and dates | Pareto view, recurring causes and recoverable-value analysis |
| Production Cost | Stage/cost breakdown | Actual material, labour, rework and allocated overhead; cost per good piece | Standard vs actual cost and variance by lot/design |
| Lot Timeline | Timeline presentation | Actual timestamped events for the selected lot | Interactive trace from materials to dispatch, highlighting holds and delay |
| Reconciliation | Opening/input/output/rework/damage/closing WIP | Actual opening WIP and conserved quantities; no double-counted recovered units | Exception drill-down to missing or inconsistent stage entries |
| Worker Summary | Jobs, quantities, due/paid, worker totals | Same period and worker identity across jobs, defects and payments | Quality-adjusted output and workload trends |
| Job Wise Register | Entry, lot/stage, quantity/rate/amount/payment status | Working lot filter, source entry and payment allocations | Group and compare jobs by lot, worker, stage and date |
| Worker Stage Breakdown | Worker-stage quantities/rates/amounts | Weighted rates and comparable work units | Stage-specific rate/productivity comparison |
| Efficiency Analysis | Yield/rework/damage and recovered values | Recorded recovery outcomes and consistent time scope | Trend normalized for stage and garment complexity |
| Payment Summary | Worker charges/payments/balances | Reconcile to worker ledger and unified/legacy payments, advances and reversals | Period worker statement and payment planning |

Confirmed findings:

- Production API supplies invented stage input/output/defect data when actual stage input is absent; defect categories also have percentage fallbacks.
- Cost percentages are constants, even where displayed amounts come from records.
- Opening WIP is hardcoded to 250; lot timeline uses fabricated timestamps and quantity deductions for the first lot.
- Worker API assumes 80% rework recovery, queries defects without the report date scope, and reads `lot_id` without applying it.

These make Production a high-priority correctness repair, not merely a visual enhancement.

### Financial — four tabs and GST subviews

| Existing tab/subview | Present | Complete baseline | Premium enhancement |
|---|--- |---|---|
| Profit & Loss | Revenue, returns, COGS, labour, expenses, salaries, other income, write-offs, margins and drill-down | Agreed recognition/valuation policy, opening/closing inventory and WIP, no duplicated costs; same profit as Analysis | Monthly side-by-side statements; budget vs actual and profit waterfall |
| Balance Sheet | Current assets/liabilities, stock, bank/cash, receivables/payables, worker/expense dues, working capital | Historical balances and reconciliation; clearly state account coverage | Comparative positions, account schedules, working-capital movement |
| GST Overview | Output/input/RCM and net summary | Complete source coverage and adjustment records; explain calculation scope | Reconciliation exceptions and period-close checklist |
| GST Outward Supplies | GST sales invoice register | Linked returns/credit/debit adjustments, complete tax-component fields | Grouping by rate, customer and classification where recorded |
| GST Input Supplies | Raw material purchases and expense data | Cover finished-goods purchase taxes and adjustments; recorded tax components and eligibility fields | Import-and-match reconciliation when external statement ingestion is added |
| GST RCM | RCM register and liability summary | Recorded liability, payment and credit lifecycle; validated rules | Outstanding-action list and linked documents |
| Cash Flow | Opening/closing, inflow/outflow breakdown and recent transactions | Every actual cash/bank movement exactly once; accurate rollback/snapshots | Cash calendar, scenario forecast, operating/investing/financing views when classification exists |

GST findings concern source coverage, not a certification of statutory calculations. The active GST API fetches sales, raw-material purchases, expenses and business details; it does not fetch finished-goods purchases or returns/notes. Some UI category figures are literal zeroes. Review actual tax rules separately before compliance-oriented export claims.

Cash-flow API selects unified payments, job-work payments and account-linked miscellaneous income; it does not independently query salary/expense cash movements. Verify whether those post to its included sources before declaring them covered. Its outflows-by-mode merges objects using spread, so job-work totals overwrite supplier-payment totals when modes coincide.

### Executive Analysis

Present: sales/profit/margin/inventory/outstanding/cash cards; sales-vs-purchases trend; sales and purchase breakdowns; production metrics; top customers/suppliers; alerts; comparison selector; Excel summary.

Complete baseline:

- Use the same definitions as detailed reports and reconcile every figure.
- Apply brand/bill-type filters and chosen comparison period to all relevant datasets.
- Distinguish period activity, historical closing position and today's snapshot.
- Replace fixed percentages and synthetic overdue values with actual records or “not available”.
- Return actual prior-period values, rather than reconstructing them from growth in exports; handle zero bases and negative values explicitly.
- Explain metric units, basis, cutoff and data freshness.

Premium target: owner overview with a short list of actionable exceptions, meaningful period changes, contribution explanations and direct source links. Example template: “Margin changed by X points; design A and increased washing cost explain Y of the change.” Generate this only from traceable calculations; no invented explanations.

## Shared experience: retain and extend

Already present: shared report shell, date presets, KPI cards, charts, mobile table/card variants, loading/error components, refresh actions, Excel utilities, financial PDF export, and searchable inline drill-down with PDF/Excel support. Retain these building blocks.

| Improvement | Target experience | Dependency / effort |
|---|---|---|
| Visible report context | Always show selected period/as-of date, business and active filters; keep advanced controls collapsible | Small UI change; preserve existing collapsed-filter preference |
| Saved views | “Overdue customers”, “This month's supplier payments”, chosen columns and grouping | Medium; user-scoped persistence and URL state |
| Better registers | Sort, search, pin columns, resize/hide columns, density option, grouped subtotals, complete pagination | Medium; shared table plus server filtering/counts |
| Traceable metrics | Card → filtered register → original voucher; clear back navigation | Medium; shared report scope and metric definitions |
| Comparison mode | Current, previous, absolute change and percentage; no misleading growth at zero base | Medium; backend comparison data |
| Honest states | Distinguish zero, unavailable, estimated, incomplete and failed; freshness from successful fetch | Small-to-medium; API metadata |
| Professional exports | Branded heading, filter/period metadata, page numbers, totals, consistent precision, full rows and typed Excel cells | Medium; per-tab schemas and render checks |
| Personal report hub | Favourites, recent reports, saved views and role-oriented entry points | Medium; preferences and existing authorization |
| Exception centre | Missing costs, overdue balances, unallocated receipts, stock discrepancies and stalled lots | Medium-to-large; trustworthy underlying calculations |
| Report subscriptions | Scheduled exports with explicit recipients, access checks and execution history | Later; job infrastructure and delivery integration |
| Controlled sharing | Permission-aware saved links or time-limited snapshots | Later; authorization, expiry and audit trail |

PDF behavior is currently inconsistent: ReportShell falls back to browser print when no PDF handler is passed. Email is an optional callback in the shell, not evidence of a working delivery system. Do not label these as completed premium capabilities.

## Most valuable additions for this garment ERP

1. Design profitability: net revenue, returns, actual material/job-work/overhead cost and margin per good piece. Depends on item-to-lot cost linkage.
2. Size/colour demand and availability matrix: sell-through, missing sizes, surplus variants, current/reserved stock. Stock cover requires a defined demand window and treatment of stockouts.
3. Lot cost and WIP aging: stage quantities, value, last activity, waiting days and responsible worker. Requires timestamped movements and actual opening WIP.
4. Collection and payment planner: invoice residuals, due dates, advances, commitments and projected account liquidity. Forecast assumptions must remain visible.
5. Supplier performance: price variance, lead time, returns and quality; delivery measures require promised and actual dates.
6. Report reconciliation centre: explain differences between party ledger, invoice dues, bank movement and financial totals. Show unresolved exceptions rather than forcing totals to match.

Do not add every metric to the first screen. A useful layout is a few headline measures, one primary trend, the working register and an exceptions section. Offer detail through tabs or drill-down, use restrained status colours, readable typography and consistent numeric alignment, and preserve mobile access and keyboard interaction.

## Delivery sequence and completion gates

### Phase 1 — Reliability

Repair payment contracts/tab mapping, silent errors, fabricated metrics, report-triggered stock writes, date/filter scope, ledger balances, allocations and return deduplication. Gate: representative vouchers reconcile across all affected reports and report GETs do not mutate business records.

### Phase 2 — Complete reporting foundation

Shared definitions for period/cutoff/status/scope, complete source coverage, historical positions, server-side aggregation/pagination and tab-specific exports. Gate: large datasets are complete; cards/rows/exports reconcile; earlier historical results do not change merely because later transactions were added.

### Phase 3 — Premium daily workflow

Saved views, consistent deep links, column controls, comparative periods, polished exports, meaningful empty states and exception drill-down. Gate: a user can move from a flagged total to its exact source and back without losing context.

### Phase 4 — Business intelligence

Garment profitability, size/colour insights, actual lot costing, supplier performance and cash planning. Add budgets, commitments, capacity or promise dates where missing rather than inferring facts. Gate: each insight states its scope and can be explained from source records.

### Phase 5 — Automation

Subscriptions, controlled sharing and forecast scenarios once permissions, infrastructure and source accuracy support them. Do not schedule or send anything as part of this inspection.

No calendar estimates are assigned here: source coverage, deployed schema and sample-data reconciliation should be checked before estimating implementation duration.

## Evidence index

- Navigation: `src/app/(dashboard)/reports/page.tsx` and redirect pages under profit-loss, balance-sheet, cash-flow, gst-summary, stock-valuation and party-statement.
- Current page capabilities: `src/app/(dashboard)/reports/{sales,purchases,payments,party-reports,inventory,production,financial,analysis}/page.tsx`.
- Sales/purchases: `src/app/api/reports/{sales,purchases}/route.ts`.
- Payment tab behavior: `src/app/api/reports/payments/route.ts`, `supabase/migrations/20260928000001_rpc_fn_report_payments.sql`.
- Inventory valuation and mutation path: `src/app/api/reports/inventory/route.ts`, `src/lib/finished-stock-reconciliation.ts:482`.
- Synthetic production values: `src/app/api/reports/production/route.ts:202`; worker assumptions: `src/app/api/reports/worker-job-work/route.ts:85`.
- Active GST/cash flow: `src/app/api/reports/financial/{gst,cashflow}/route.ts`.
- Financial and analysis RPCs: `supabase/migrations/20260928000002_rpc_fn_report_analysis.sql`, `20260928000003_rpc_fn_report_financial_pl.sql`, `20260928000004_rpc_fn_report_financial_balance.sql`.
- Shared experience: `src/components/reports/{ReportShell,ReportKPICard,InlineDrillDownPanel}.tsx`, `src/lib/report-export.ts`, `src/lib/pdf/report-pdf-generator.ts`.
