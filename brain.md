# TAS ERP — Project Brain (Root)
This file is read automatically at the start of every agent session. Keep it short — its job is to orient and redirect, not to contain everything. Deeper, module-specific detail lives in per-module `brain.md` files and in Serena's seeded memory.

## Before doing anything else
1. **Do not explore the codebase broadly before starting a task.** Check this file, the relevant module's `brain.md` (if one exists in the folder you're working in), and Serena's seeded memory first. Use Serena for *targeted* symbol/reference lookup once you know what you need — not for open-ended discovery.
2. **Check the priority docs before flagging anything as a new problem.** `TAS-ERP-P0-Security-DataIntegrity.md`, `P1-Architecture.md`, `P2-Rollout.md`, `P3-Polish.md`, `P4-Future-ProductIdeas.md` cover the full verified findings across the codebase, each with exact file paths and line-level detail. If something looks broken, it's very likely already documented there with a specific solution — check first, then either work the existing item or explain why it's genuinely new before writing a fresh audit of something already covered.
3. **Status as of last update:** verify current per-tier status directly against the P-docs rather than assuming — this line should be updated whenever a tier's real status changes, since stale status here is worse than no status at all.

## Tech stack
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes (`app/api/`), Supabase (PostgreSQL with Row Level Security)
- **Data fetching:** TanStack Query, via the shared `useERPQuery()` / `useERPMutation()` hooks (P1 #9) — new code should use these, not raw `fetch()` + `useState`/`useEffect`
- **State:** Zustand (`store/index.ts`) — one small global store for cross-cutting UI state; most state should live in React Query cache or component state, not here
- **Forms/validation:** React Hook Form + Zod, schemas shared between frontend forms and API routes via `schemas/` (P0 #4)
- **File storage:** Cloudflare R2, accessed via presigned URLs (`/api/upload/presigned`)
- **UI primitives:** shadcn/ui on top of Radix (`components/ui/`) — these already handle ARIA correctly; plain hand-built form fields elsewhere often don't (P2 #23)
- **Animation:** Framer Motion, wired up per P1 #12 — check current adoption in that file before assuming it's unused

## Multi-tenancy
Every business-scoped table has a `business_id` column. Every API route must scope reads/writes by the caller's `business_id`, resolved via `getSessionBusinessId()` in `lib/supabase/server.ts` or custom headers. Never trust a `business_id` passed in a request body — always resolve it server-side from the session/headers. When accepting any other foreign-key id from a request body (e.g. `party_id`), verify it belongs to the same `business_id` before using it.

## Folder map
```
src/app/(auth)/            public routes: login, register
src/app/(dashboard)/        authenticated pages, one folder per module
src/app/api/                API routes, mirrors the frontend module structure
src/components/ui/          shadcn/Radix primitives — don't modify casually
src/components/shared/       ConfirmDialog, EmptyState, StatusBadge, WizardHeader, etc.
src/components/tables/       DataTable.tsx, TableSkeleton.tsx
src/components/forms/        large domain forms — see per-module brain.md for refactor status
src/components/layout/       Sidebar.tsx, Header.tsx — see P1 #17, P2 #20.12
src/hooks/                  useBusinessId.ts, useRole.ts (clean), useFileUpload.ts (see P1 #17-18)
src/lib/supabase/           client.ts (browser), server.ts (server + session resolution)
src/lib/schemas/             shared zod schemas (frontend + backend)
src/store/index.ts           single small Zustand store
src/repositories/            one file per domain, only layer touching Supabase directly
src/services/                 business logic + validation, between repositories and hooks/routes
supabase/migrations/          managed via Supabase CLI (`supabase db push`) — never write ad hoc migration scripts
```

## Core conventions (apply to all new/touched code)
- **API response shape:** `{ data: T, meta?: {...} }` on success, `{ error: string, details?: unknown }` on failure (P1 #8). Older routes returning a resource-named key are a known migration-in-progress, not a new bug.
- **Data fetching:** `useERPQuery()` / `useERPMutation()` for anything hitting an API route.
- **Server-side validation:** every route parses `request.json()` through a shared zod schema from `schemas/`, returning 400 with `parsed.error.flatten()` on failure.
- **Multi-step writes:** anything touching more than one table as a unit goes through a Postgres function via `.rpc()`, not a sequence of independent Supabase calls.
- **Component size:** target ~250-350 lines per file. See P2 #20 for worked split plans per current oversized file — don't invent a new pattern per file.
- **Component keys:** never `key={index}` on editable/reorderable lists — use a stable id.
- **Search inputs:** debounce before using as a query dependency.
- **Auth:** don't construct a Supabase client or call `.auth.*` directly inside UI components — use the shared `AuthProvider`/`useLogout()`.
- **Errors:** `catch (err: unknown)` with `instanceof Error` narrowing, not `catch (err: any)`. Log via the `Logger` abstraction, not raw `console.*`.

## Framework Architecture Map

| Original layer / engine | Where it was built (P1) | Where it's used now (P2) |
|---|---|---|
| **Experience Framework** | P1 items 8–12, 18 | Consumed by every migrated page in item 19, plus new items **44–46** addressing raw speed directly |
| — Loading Engine / Page Skeleton System | P1 item 9 (`useERPQuery`'s pending state) + item 10 (skeleton components) | Item 19 |
| — Raw speed | Not built in P1 — direct to P2 as items **44–46** | Items 44 (double auth-session fetch), 45 (sequential-to-parallel API calls), 46 (dev-vs-production compilation check) |
| — Progressive Rendering | P1 item 10 (skeletons per section) | Item 20 — component breakup enables independent section loading once pages aren't monolithic |
| — Navigation Engine | P1 item 11 (Sidebar prefetch extension + route-level `loading.tsx`) | Item 20.12 (Sidebar split completes the config-driven nav this depends on) |
| — Animation/Motion Engine | P1 item 12 | Item 20 (wizard step transitions, dialog animations) |
| — Feedback Engine / Async Button System | P1 item 9 (`useERPMutation`'s pending/disabled/toast handling) | Item 19 |
| **UI Framework** | shadcn/Radix primitives, `DataTable`, `TableSkeleton`, `ConfirmDialog`, `EmptyState` | Item 23 (accessibility pass) extends this layer further |
| **Business Framework** | P1 items 13, 16–17 — repository + service layer | Item 22 — rolled out to every remaining module |
| **ERP Modules** | N/A — built on top of everything above | Items 19–20 — the actual module-by-module migration onto the now-proven foundation |

## 25. UX Experience Checklist & Engineering conventions

### UX Experience Checklist
1. **Tables**: Every data list table must include a structured skeleton loader during pending status, an explicit empty state placeholder, and pagination controls.
2. **Buttons**: Every action button must display clear loading, disabled, or success states corresponding to its operation/mutation lifecycle.
3. **Forms**: All form inputs must have programmatic `<label htmlFor="...">` bindings, standard inline validation messages, and disabled states during submit submission.
4. **Dialogs**: All modal components must handle Radix-managed keyboard trapping, backdrop dismissal, and focus-locking bounds.

### Engineering conventions
1. **Type Safety**: Never use `any`. Always narrow exception types with `catch (err: unknown)` and `if (err instanceof Error)`.
2. **List Keys**: Never map lists with `key={index}` in editable lists. Use database `id` or client-side generated UUID constants.
3. **Inputs**: Debounce search inputs using `useDebounce` hook before sending them as dependencies for queries or backend fetches.
4. **API Responses**: Standardize all API route returns to `{ data: T }` for successes and `{ error: string }` for exceptions.

## Where to look for more detail
- Full findings + solutions, organized by priority: `TAS-ERP-P0-Security-DataIntegrity.md` through `TAS-ERP-P4-Future-ProductIdeas.md`
- Sales Bills is the reference implementation for the repository/service/hook pattern — see `app/(dashboard)/sales/bills/brain.md` before replicating the pattern elsewhere
- Product ideas intentionally *not* being worked on right now, and why: `TAS-ERP-P4-Future-ProductIdeas.md`
