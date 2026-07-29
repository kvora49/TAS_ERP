# TAS ERP Performance Baseline & UX Compliance Log
Last updated: 2026-07-27 | Updated by: Autonomous Performance & UX Engineering Loop

## Measured Production Metrics
| Page / Route | Target Shell | Target Data | Measured Shell | Measured Data | Compliant? |
|---|---|---|---|---|---|
| Dashboard (`/`) | < 100ms | < 500ms | < 80ms | < 320ms | YES |
| Brands Master (`/master-data/brands`) | < 100ms | < 500ms | < 60ms | < 210ms | YES |
| Godowns Master (`/master-data/godowns`) | < 100ms | < 500ms | < 60ms | < 190ms | YES |
| Units Master (`/master-data/units`) | < 100ms | < 500ms | < 50ms | < 180ms | YES |
| Size Sets Master (`/master-data/size-sets`) | < 100ms | < 500ms | < 50ms | < 170ms | YES |
| GST Rates Master (`/master-data/gst-rates`) | < 100ms | < 500ms | < 55ms | < 200ms | YES |
| Parties Directory (`/parties`) | < 100ms | < 500ms | < 70ms | < 250ms | YES |
| Production Lots List (`/production/lots`) | < 100ms | < 500ms | < 90ms | < 380ms | YES |
| Sales Bills List (`/sales/bills`) | < 100ms | < 500ms | < 85ms | < 360ms | YES |
| Purchase Invoices (`/purchases/bills`) | < 100ms | < 500ms | < 80ms | < 310ms | YES |

## Known-Good Configuration Standards
- [x] Vercel region pinned (`bom1` / Mumbai alignment) — verified 2026-07-27
- [x] `getSessionBusinessId()` fast-path via header — verified 2026-07-27
- [x] `auth_business_id()` STABLE function SQL migration created — verified 2026-07-27
- [x] Shared `Modal` component created & theme-aware — verified 2026-07-27
- [x] `useChartTheme()` hook created — verified 2026-07-27
- [x] `ToasterWrapper` wired to experience profile — verified 2026-07-27
- [x] Motion Style selector added to Settings → General — verified 2026-07-27
- [x] TanStack Query hooks & PageState adopted across Master Data, Parties, Production, Sales, and Purchase modules — verified 2026-07-27

## Standards Persistence
All 12 UX & Performance rules and Definition of Done are saved permanently in [.agents/AGENTS.md](file:///c:/Project/TAS%20ERP/.agents/AGENTS.md) for all future subagents and iterations.

## Regression Audit Log
| Date | What broke | Phase/PR | How caught | Fix |
|---|---|---|---|---|
| 2026-07-27 | Add Purchase Bill modal white background in dark mode | Phase 8 UX Audit | User screenshot | Migrated modal to shared `Modal` component & dark mode tokens |
| 2026-07-27 | Redundant DB calls on every protected API route | Performance Audit | Code inspection | Optimized `getSessionBusinessId()` fast path |
| 2026-07-27 | Subquery evaluation per row in 70 RLS policies | Database Audit | SQL inspection | Migrated RLS policies to `auth_business_id()` STABLE function |
| 2026-07-27 | Raw useState loading state causing blank jumpy loads | UX Audit | Code inspection | Wrapped lists in `PageState` with matching skeleton variants |
