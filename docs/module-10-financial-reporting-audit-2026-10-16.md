# Module 10 financial reporting audit — 16 October 2026

## Scope and verification status

This was a source-level audit of the committed code and migrations. No production data, deployed function definitions, or staging database was available. Existing historical records were not changed and no migration was applied.

The repository has two reporting generations:

- The active Financial Reports workspace calls `fn_report_financial_pl`, `fn_report_financial_balance`, the GST source-facts route, and the cash-flow source-facts route.
- `/api/reports/financial` is an older combined compatibility endpoint. No internal caller was found by static search.

## Implemented remediation

| Finding | Status | Change |
| --- | --- | --- |
| RPT-01 — failed legacy source queries became empty totals | Fixed in compatibility endpoint | Every parallel source result and GST query is now checked before calculations. An error returns a failure response rather than zero totals. |
| RPT-02 — legacy gross-profit label conflicts with COGS-based P&L | Contained, not redefined | The endpoint now labels the value as `purchase_margin_estimate` and carries a compatibility warning. The authoritative P&L remains `fn_report_financial_pl`. |
| RPT-06 — cash-flow cutoff queries | Verified | The missing upper bounds are intentional: post-cutoff movements are required to reverse current bank balances back to the selected cutoff. Applying `lte(to)` without a new opening-balance source would make historical balances inaccurate. |
| RPT-11 — company-safe cache keys | Verified | `useReportQuery` appends `report-company`, business ID, and user ID. Company switch changes the query key; report invalidation uses that marker. |

## Authoritative source map (current implementation)

| Metric | Current authoritative implementation | Important date basis |
| --- | --- | --- |
| P&L | `fn_report_financial_pl` | `p_from` through `p_to`; stock ledger opening and closing cutoffs |
| Balance sheet | `fn_report_financial_balance` | as of `p_to`; requires staging verification against later movements |
| GST source summary | `gstReportFacts` | document/note/return dates, with linked return-note deduplication |
| Cash flow | `cashflowReportFacts` | transaction dates plus movements after cutoff to derive account balances |
| Party historical residual | `paidAtCutoff` / `dueDateAging` | payment allocations after cutoff are reversed from current paid totals |
| Stock valuation | `fn_report_stock_valuation` and stock-ledger migrations | ledger position; deployment verification required |

## Confirmed remaining risks requiring accounting approval or a migrated staging database

1. `fn_report_financial_pl` uses the available stock-ledger valuation model. Its COGS policy, labour/overhead treatment, return valuation, and inventory cutoffs need approved accounting fixtures before it can be called statutory P&L.
2. Historical balance-sheet correctness must be tested against a database with post-cutoff bank activity and earlier unpaid/partially-paid invoices. Static source cannot prove deployed migration order or live data completeness.
3. Cash flow has no canonical persisted cash-movement identity. Payments, expenses, salaries, job-work payments, cheque effects, and internal transfers need reconciliation fixtures to prove there is no source overlap.
4. GST is deliberately a provisional source summary. It does not claim statutory filing compliance, eligibility, RCM settlement lifecycle, or amendment handling.
5. Report access is session and tenant scoped, but role-level finance/salary/profit permissions need a policy decision and role matrix before enforcing narrower access.
6. `readReportRows` protects against silent PostgREST truncation but remains capped at 100,000 detail rows. Summary reports should move to SQL aggregation and exports need an explicit asynchronous/export limit policy.

## Required staging tests before deployment

- Inject a failed source query and confirm a 5xx report failure, never a zero total.
- Earlier invoice with later partial payment: validate receivable and balance sheet at cutoff.
- Internal transfer, cheque clear/bounce, advance allocation, salary, expense and job-work payment: reconcile cash flow to account balances.
- Linked return plus credit/debit note: validate GST and party totals are affected once.
- Mixed-role party and two businesses with overlapping document numbers: validate tenant isolation and signs.
- Export every financial tab and compare totals, filters, and cutoffs with the rendered screen.
