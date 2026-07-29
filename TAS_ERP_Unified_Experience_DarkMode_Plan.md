# TAS ERP — Unified Experience, Motion & Dark Mode Enforcement Plan
**Supersedes: UX Consistency Enforcement Plan + Premium Motion Profile Update — now one governing document**

> This is now the single source of truth for loaders, animations, motion profiles, AND dark mode across the entire application. All three problems (inconsistent UX states, missing premium motion, broken dark mode) are symptoms of the same root cause: rules were defined once but never enforced screen-by-screen. This document fixes all three together because they touch the same components and the same audit.

---

## Table of Contents
1. [Why These Three Problems Are One Problem](#1-why-these-three-problems-are-one-problem)
2. [The Non-Negotiable Rules (Complete Set)](#2-the-non-negotiable-rules-complete-set)
3. [Component Usage Matrix](#3-component-usage-matrix)
4. [Motion Profile Reference](#4-motion-profile-reference)
5. [Dark Mode — Root Cause of the Screenshot Bug](#5-dark-mode--root-cause-of-the-screenshot-bug)
6. [Dark Mode Token Completion](#6-dark-mode-token-completion)
7. [Audit Method (Single Combined Audit)](#7-audit-method-single-combined-audit)
8. [LOOP A — Combined Audit](#loop-a--combined-audit)
9. [LOOP B — Fix List Pages (UX + Dark Mode + Motion)](#loop-b--fix-list-pages)
10. [LOOP C — Fix Detail Pages](#loop-c--fix-detail-pages)
11. [LOOP D — Fix Forms & Wizards](#loop-d--fix-forms--wizards)
12. [LOOP E — Fix Every Modal/Dialog/Dropdown (Critical — This Is The Screenshot Bug)](#loop-e--fix-every-modaldialogdropdown)
13. [LOOP F — Fix Buttons Everywhere](#loop-f--fix-buttons-everywhere)
14. [LOOP G — Fix Navigation Feedback](#loop-g--fix-navigation-feedback)
15. [LOOP H — Dark Mode Full Sweep](#loop-h--dark-mode-full-sweep)
16. [Prevention — Lint Rules + PR Gate](#16-prevention--lint-rules--pr-gate)
17. [Final Verification Checklist](#17-final-verification-checklist)

---

## 1. Why These Three Problems Are One Problem

Every screen in TAS ERP touches the same handful of shared components: `PageState`, `Skeleton`, `AsyncButton`, `Modal`, `DataTable`, `Header`. When a screen was built without properly using these shared components (Problem 1: inconsistent loaders/empty states), it almost always ALSO means:

- It didn't pick up the motion profile CSS variables correctly (Problem 2: no premium feel)
- It has hardcoded colors instead of `var(--card-bg)` / `var(--text-primary)` etc. (Problem 3: broken dark mode)

**The screenshot you shared is proof of this pattern:** the "Add Purchase Bill" modal is stark white with black text on light borders while the entire rest of the app is dark. This means that specific `Modal` implementation has hardcoded `bg-white` and `text-black` somewhere instead of `bg-[var(--card-bg)]` and `text-[var(--text-primary)]`. It is very likely NOT using the shared `Modal` wrapper from the Experience Framework at all — it's a one-off implementation.

**This is why one unified audit and one unified loop-set fixes all three at once** — the same file, the same component, gets corrected for loading state + motion + dark mode compatibility in a single pass, instead of three separate sweeps of the same ~90 routes.

---

## 2. The Non-Negotiable Rules (Complete Set)

### UX State Rules
**Rule 1 — Every data-fetching page uses `PageState`.** No raw `useState` loading/error/empty management anywhere.

**Rule 2 — Every async button uses `AsyncButton`.** No plain `<button onClick={async ...}>` anywhere in the codebase.

**Rule 3 — Every skeleton matches its real layout.** `variant`/`rows`/`columns`/`count` must reflect the actual content shape.

**Rule 5 — Every list/table has a defined empty state.** Title + description + CTA where relevant, never bare headers with no rows.

**Rule 6 — Every error has a retry.** `onRetry` always wired to `refetch()`.

**Rule 7 — Breadcrumbs update optimistically.** Every route has a `ROUTE_METADATA` entry in `Header.tsx`.

### Motion Rules
**Rule 4 — Every navigation shows the progress bar.** All navigation goes through `useNavigation()`, never raw `router.push`.

**Rule 8 — Every component that uses the motion system reads CSS variables, never hardcodes durations.** No `transition-duration: 200ms` written directly in a component — always `duration-[var(--exp-page-duration)]` or the Tailwind arbitrary-value equivalent.

**Rule 9 — Premium profile behaviors apply uniformly.** If `motion_profile = premium` is active, EVERY modal, EVERY hoverable button/card, EVERY skeleton, and EVERY staggered list must exhibit the soft-overshoot easing — not just some of them.

### Dark Mode Rules — NEW
**Rule 10 — Zero hardcoded colors in any component.** No `bg-white`, `bg-black`, `text-black`, `text-gray-900`, `border-gray-200` etc. anywhere. Every single color reference is a CSS variable: `bg-[var(--card-bg)]`, `text-[var(--text-primary)]`, `border-[var(--border)]`.

**Rule 11 — Every modal, dialog, dropdown, popover, and tooltip is dark-mode tested individually.** These are the highest-risk components because they're often built as one-offs (exactly like the screenshot bug) rather than through the shared `Modal` wrapper.

**Rule 12 — Every third-party component (shadcn, Recharts, react-day-picker, html5-qrcode overlay) has its dark mode override explicitly set.** Third-party libraries default to light mode and need explicit dark theme props/overrides — they do not automatically inherit CSS variables.

**Rule 13 — Contrast is verified, not assumed.** Every text/background pairing in dark mode must meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text) — verified with a contrast checker, not eyeballed.

---

## 3. Component Usage Matrix

| Page Element | Component | Dark Mode Note |
|---|---|---|
| Stat cards while loading | `<Skeleton variant="stats" count={N}/>` inside `PageState` | Shimmer base uses `var(--border-light)`, already theme-aware |
| Table while loading | `<Skeleton variant="table" rows={8} columns={N}/>` inside `PageState` | Same |
| Chart while loading | `<Skeleton variant="chart"/>` in `Suspense` | Same |
| Form while loading | `<Skeleton variant="form"/>` inside `PageState` | Same |
| List while loading | `<Skeleton variant="list"/>` inside `PageState` | Same |
| **Any modal/dialog** | **Shared `Modal` wrapper — NEVER a custom one-off** | **This is the screenshot bug fix — see Loop E** |
| Any Save/Delete/status-change button | `<AsyncButton>` | Uses `VARIANT_CLASSES` — must confirm dark variants exist for primary/outline/danger |
| Page navigation | `useNavigation().navigate()` or `<Link>` | N/A |
| Empty table/list | `PageState isEmpty` | Icon color must be `var(--text-faint)` not a hardcoded gray |
| Failed fetch | `PageState isError` with `onRetry` | N/A |
| Dropdown/Select (shadcn) | shadcn `Select` component | Must verify shadcn's own CSS vars map to our tokens (Section 6) |
| Date picker | react-day-picker or native input | Explicit dark override required (Rule 12) |
| Charts (Recharts) | Recharts components | `stroke`/`fill` props must read CSS vars via JS, Recharts doesn't respect CSS `var()` natively in SVG attributes reliably — see Section 6.4 |

---

## 4. Motion Profile Reference

(Full technical values — see Section 5 of this doc's predecessor, values unchanged, now enforced uniformly per Rule 9)

| Profile | Duration | Easing | Shimmer | Stagger | Hover Scale | Active Scale |
|---|---|---|---|---|---|---|
| ultraFast | 80–120ms | linear | 1200ms | 0ms | 1.0 | 1.0 |
| balanced (default) | 160–200ms | ease-out | 1600ms | 20ms | 1.01 | 0.99 |
| premium | 300–400ms | `cubic-bezier(0.34,1.56,0.64,1)` | 2500ms | 40ms | 1.02 | 0.97 |

CSS variables: `--exp-nav-duration`, `--exp-page-duration`, `--exp-btn-duration`, `--exp-hover-duration`, `--exp-shimmer-speed`, `--exp-easing`, `--exp-stagger`, `--exp-hover-scale`, `--exp-active-scale`, `--exp-entrance-offset`, `--exp-entrance-scale` — all injected by `NavigationExperienceProvider` at `:root` and swapped instantly on profile change, zero component re-render needed.

**Selection priority:** User's `business_settings.motion_profile` → overridden by network auto-detection (`ultraFast` forced on 2G) → default `balanced`.

---

## 5. Dark Mode — Root Cause of the Screenshot Bug

Looking at your screenshot specifically: the sidebar, header, stat cards, and page background are all correctly dark (`#0F172A`/`#0F1629` family). The "Add Purchase Bill" modal is rendering with:
- White/light card background instead of `var(--card-bg)` (`#1E293B` in dark mode)
- Dark navy input fields with light borders — actually these look correctly dark, but the OVERALL modal container is light
- The backdrop behind the modal isn't dimmed/blurred consistently

**Most likely code cause:** The modal was built with a hardcoded `bg-white` Tailwind class (or a shadcn Dialog default that wasn't themed), added quickly during a phase implementation, and never routed through the shared `Modal` component from the Experience Framework — meaning it never received the dark theme treatment applied everywhere else.

**This is a Rule 11 violation** — modals are the single highest-risk surface for dark mode gaps because they're portalled outside the normal DOM tree (often rendered via `createPortal` to `document.body`), which means they can accidentally escape the `[data-theme="dark"]` attribute's CSS cascade if not handled carefully.

### The Specific Technical Trap
```tsx
// ❌ THE BUG PATTERN — likely what happened
// If [data-theme="dark"] is set on <html>, and the modal portals to document.body,
// CSS cascade STILL works (body is a descendant of html) — so this isn't a portal issue.
// The real bug is almost certainly just:

<div className="bg-white rounded-xl p-6">  {/* hardcoded, ignores theme entirely */}
  <input className="border-gray-300 text-black" />
</div>

// ✅ THE FIX
<div className="bg-[var(--card-bg)] rounded-xl p-6 border border-[var(--border)]">
  <input className="border-[var(--input-border)] text-[var(--text-primary)] bg-[var(--input-bg)]" />
</div>
```

---

## 6. Dark Mode Token Completion

The original dark mode CSS block (Phase 8 Loop 0) covered core tokens but several were never defined, which is a second contributor to visual breakage. Add these missing tokens:

```css
[data-theme="dark"] {
  /* Previously defined — confirmed correct */
  --page-bg: #0F172A;
  --card-bg: #1E293B;
  --border: #334155;
  --border-light: #1E293B;
  --text-primary: #F8FAFC;
  --text-secondary: #E2E8F0;
  --text-body: #CBD5E1;
  --text-muted: #64748B;
  --text-faint: #475569;
  --sidebar-bg: #020617;
  --sidebar-active: #1E3A5F;
  --sidebar-hover: #0F172A;
  --sidebar-border: #1E293B;
  --input-bg: #1E293B;
  --input-border: #334155;

  /* MISSING — add these now */
  --input-focus: #818CF8;              /* was using light-mode #6366F1, too dim on dark bg */
  --primary: #818CF8;                  /* lighter purple for better contrast on dark bg */
  --primary-dark: #6366F1;
  --primary-light: #1E1B4B;            /* was #EEF2FF — completely wrong for dark, this was likely never touched */

  --modal-backdrop: rgba(0,0,0,0.7);   /* was likely using a light-mode-only rgba(0,0,0,0.4) — needs to be darker/more opaque on dark bg for proper contrast separation */
  --modal-shadow: 0 20px 60px rgba(0,0,0,0.5);

  --table-header-bg: #1E293B;          /* was --page-bg equivalent #F9FAFB in light — needs distinct dark value, not same as card-bg or headers blend into body */
  --table-row-hover: #263449;

  --checkbox-checked-bg: #818CF8;
  --checkbox-unchecked-border: #475569;

  --skeleton-base: #1E293B;
  --skeleton-shine: rgba(255,255,255,0.06);  /* was rgba(255,255,255,0.6) — way too bright, this alone could cause the "worst" feeling described */

  --scrollbar-thumb: #334155;
  --scrollbar-track: #0F172A;

  /* Chart-specific (Recharts doesn't read CSS vars in SVG natively — resolve via JS, see 6.4) */
  --chart-grid: #334155;
  --chart-axis-text: #94A3B8;
  --chart-tooltip-bg: #1E293B;
  --chart-tooltip-border: #334155;
}
```

### 6.1 Fix the Shimmer Brightness Bug
The original `.animate-shimmer::after` gradient used `rgba(255,255,255,0.6)` unconditionally — in dark mode this creates a jarring bright white streak across a dark card, which likely contributes to the "worst" feeling. Fix:

```css
/* Light mode (unchanged) */
.animate-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
}

/* Dark mode — much dimmer shine, matches --skeleton-shine token above */
[data-theme="dark"] .animate-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, var(--skeleton-shine) 50%, transparent 100%);
}
```

### 6.2 shadcn/ui Component Dark Mode Mapping
shadcn components (`Dialog`, `Select`, `Checkbox`, `Switch`, `DropdownMenu`) ship with their own CSS variable names (`--background`, `--foreground`, `--popover`, `--border` etc. in shadcn's convention) which are DIFFERENT from TAS ERP's custom token names. If these were never mapped, every shadcn component silently uses shadcn's OWN light-mode defaults regardless of our `[data-theme="dark"]` attribute — this is very likely the second half of the screenshot bug (the Dialog itself is shadcn's `Dialog`, using its own unmapped light theme).

```css
/* Add a bridge — map shadcn's expected variable names to our tokens */
:root {
  --background: var(--card-bg);
  --foreground: var(--text-primary);
  --popover: var(--card-bg);
  --popover-foreground: var(--text-primary);
  --border: var(--border);       /* already same name, verify no conflict */
  --input: var(--input-border);
  --ring: var(--input-focus);
  --primary: var(--primary);
  --primary-foreground: #FFFFFF;
  --muted: var(--page-bg);
  --muted-foreground: var(--text-muted);
  --accent: var(--primary-light);
  --accent-foreground: var(--primary);
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
}
/* This single bridge, once added, makes EVERY shadcn component
   (Dialog, Select, DropdownMenu, Checkbox, Switch, Popover, Tooltip)
   automatically dark-mode-correct with zero per-component changes. */
```

### 6.3 Modal Backdrop Fix
```css
/* If the backdrop behind the modal wasn't dimmed enough, the light modal
   "floats" awkwardly as seen in the screenshot. Standardize: */
.modal-backdrop {
  background: var(--modal-backdrop, rgba(0,0,0,0.5));
  backdrop-filter: blur(4px);
}
```

### 6.4 Recharts Dark Mode (JS-resolved, not pure CSS)
```tsx
// hooks/useChartTheme.ts
export function useChartTheme() {
  const profile = useExperienceProfile() // already reads [data-theme] via context
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  return {
    grid: isDark ? '#334155' : '#E5E7EB',
    axisText: isDark ? '#94A3B8' : '#64748B',
    tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
    tooltipBorder: isDark ? '#334155' : '#E5E7EB',
  }
}

// Usage in every chart component:
const chartTheme = useChartTheme()
<CartesianGrid stroke={chartTheme.grid} />
<XAxis tick={{ fill: chartTheme.axisText }} />
<Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}` }} />
```
Every chart across Dashboard, Stock Overview, P&L, GST Summary, Job Worker Ledger must apply this hook — Recharts SVG attributes do not automatically respond to CSS variable changes the way DOM/CSS properties do.

### 6.5 html5-qrcode Scanner Overlay
The Barcode/QR scanner UI (Section 2.7 of Phase 5 plan) has its own dark-styled overlay already (`bg-black/50`) — this one is already dark-mode-safe since it's designed as an always-dark camera overlay by nature. No fix needed here, but include it explicitly in the audit as a confirmed-pass rather than an unknown.

---

## 7. Audit Method (Single Combined Audit)

One audit table now covers all three concerns per route:

```
| # | Route | PageState? | AsyncButton? | Skeleton match? | Empty state? | Retry? | ROUTE_METADATA? | Motion vars only (no hardcoded ms)? | Zero hardcoded colors? | Modal uses shared wrapper? | Dark mode visually verified? | STATUS |
```

STATUS: PASS | PARTIAL | FAIL

---

## LOOP A — Combined Audit

**Scope:** Score all ~90 routes (same master list as before — see Phase-grouped route list from the prior UX plan) against the full 10-column table above. No fixes in this loop.

### Special Sub-Task — Modal/Dialog Inventory
Before scoring routes, first produce a SEPARATE flat list of every modal/dialog/dropdown component in the codebase (not per-route, per-COMPONENT, since one modal like `RecordPaymentModal` is reused across multiple routes):

```
Add User Modal | Edit User Modal | Add Brand Modal | Add Godown Modal | Add Stage Modal
Add Size Set Modal | Add Expense Type Modal | Add GST Rate Modal | Add Bank/UPI Modal
Add Raw Material Modal | Add Colour Modal (Designs) | Confirm Delete Dialog (generic)
Record Payment Modal (Phase 3) | Record Job Work Payment (Phase 4, full-page not modal — verify)
Add Purchase Bill Modal (Phase 6 — THE SCREENSHOT BUG) | Settle Advance Modal (Phase 7)
Write-off Modal | 2FA Setup Modal | Backup Restore Confirm Dialog
[... continue for every modal found via grep: grep -rn "Dialog\|Modal" src/ --include="*.tsx" -l]
```

Each gets its own PASS/FAIL for: uses shared `Modal` wrapper (Y/N), dark mode verified (Y/N), motion profile applied (Y/N).

### Verification Checklist
- [ ] All ~90 routes scored
- [ ] Complete modal/dialog inventory produced separately (this list is likely 25-40 components)
- [ ] Screenshot bug's specific modal ("Add Purchase Bill") explicitly located in codebase and confirmed as the FAIL case
- [ ] Report counts: "X pass, Y partial, Z fail" for routes AND separately for modals

**GATE before Loop B.**

---

## LOOP B — Fix List Pages

**Scope:** Every list/table route scored PARTIAL/FAIL. Apply the standard pattern (unchanged from the original UX plan) PLUS dark mode color audit.

### Combined Fix Pattern
```tsx
export default function SomeListPage() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useSomeStats()
  const { data: items, isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useSomeList(filters)

  return (
    <div className="bg-[var(--page-bg)]">{/* never bare bg-gray-50 or similar */}
      <PageHeader title="..." />
      <FilterBar />

      <PageState isLoading={statsLoading} isError={!!statsError} skeletonVariant="stats"
        skeletonCount={/* exact count */} error={statsError} onRetry={refetchStats}>
        <StatCards data={stats!} />
      </PageState>

      <PageState isLoading={itemsLoading} isError={!!itemsError} isEmpty={items?.length === 0}
        skeletonVariant="table" skeletonRows={8} skeletonColumns={/* exact count */}
        error={itemsError} onRetry={refetchItems}
        emptyTitle="No [items] yet" emptyDescription="[specific]"
        emptyAction={<AsyncButton onClick={...}>+ Add [Item]</AsyncButton>}>
        <ItemsTable data={items!} />
      </PageState>
    </div>
  )
}
```

### Dark Mode Fix Requirement (applies to every page fixed in this loop)
Grep every file being touched for hardcoded colors before considering it done:
```bash
grep -n "bg-white\|bg-gray\|text-black\|text-gray-9\|border-gray" [filepath]
```
Any hit must be converted to the matching CSS variable per the token table in Section 6.

### Verification Checklist
- [ ] Every list page re-scored PASS on all UX columns
- [ ] Every list page grep-clean of hardcoded colors
- [ ] Every list page visually screenshotted in both light and dark mode for comparison (not just code-reviewed)

**GATE before Loop C.**

---

## LOOP C — Fix Detail Pages

**Scope:** Every `/[id]` route scored PARTIAL/FAIL — same pattern as before, same dark mode grep requirement added.

### Verification Checklist
- [ ] Every detail page re-scored PASS
- [ ] Tabbed pages: outer shell + each tab's nested PageState confirmed dark-mode clean independently
- [ ] Grep-clean of hardcoded colors

**GATE before Loop D.**

---

## LOOP D — Fix Forms & Wizards

**Scope:** Add/Edit pages and multi-step wizards — same as before, plus dark mode on form inputs specifically (highest-risk element type after modals, since inputs have background+border+text+placeholder all needing separate dark tokens).

### Form Input Dark Mode Checklist (apply to every input across every form)
```tsx
// Every text input, select, textarea, date picker must use:
className="bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]
           placeholder:text-[var(--text-faint)]
           focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent"
```

### Verification Checklist
- [ ] Every form re-scored PASS
- [ ] Every input type (text, select, textarea, date, number, checkbox, radio, toggle) verified dark-mode readable with placeholder text visible
- [ ] Wizard step indicators (numbered circles) verified dark-mode correct — these use `--wizard-active`/`--wizard-done`/`--wizard-pending` tokens, confirm these were included in the dark theme block

**GATE before Loop E.**

---

## LOOP E — Fix Every Modal/Dialog/Dropdown

**Scope: THIS IS THE LOOP THAT FIXES YOUR SCREENSHOT.** Every item in Loop A's modal inventory gets migrated to the shared `Modal` wrapper and dark-mode verified individually.

### Step 1 — Build/Confirm the Shared Modal Wrapper
```tsx
// components/shared/Modal.tsx — the ONE modal implementation for the whole app
'use client'
import { useExperienceProfile } from '@/components/experience'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  maxWidth?: string // default 'max-w-lg'
}

export function Modal({ open, onOpenChange, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const profile = useExperienceProfile()
  if (!open) return null

  const animClass = profile.level === 'premium' ? 'premium-reveal' : 'page-transition-enter-active'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
         onClick={() => onOpenChange(false)}>
      <div
        className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl
                    shadow-[var(--modal-shadow)] p-6 w-full ${maxWidth} ${animClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
          <button onClick={() => onOpenChange(false)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

### Step 2 — Migrate Every Modal in the Inventory
For each of the ~25-40 modals found in Loop A's inventory: replace its custom implementation (whatever it currently is — raw div, shadcn Dialog unmapped, or otherwise) with this shared `Modal` wrapper as the outer container, keeping the existing form content inside unchanged (just the chrome/wrapper changes).

**Priority order for migration (fix these first):**
1. **Add Purchase Bill Modal** (the screenshot bug — fix first, verify visually before continuing)
2. Record Payment Modal (Phase 3/6/7 — used across many flows)
3. Confirm Delete Dialog (used everywhere, highest frequency of use)
4. All remaining Master Data "Add X" modals (Brand, Godown, Stage, Size Set, Expense Type, GST Rate, Bank/UPI, Raw Material, Colour)
5. Settle Advance / Write-off modals (Phase 7)
6. 2FA Setup / Backup Restore Confirm (Phase 8)

### Step 3 — shadcn Component Bridge (Section 6.2)
Apply the CSS variable bridge from Section 6.2 once, globally, in `globals.css`. This alone fixes any shadcn-based `Dialog`, `Select`, `DropdownMenu`, `Popover`, `Tooltip` that wasn't manually mapped before.

### Verification Checklist
- [ ] Shared `Modal` component built/confirmed matching the spec above
- [ ] "Add Purchase Bill" modal specifically fixed and screenshot-compared against the bug image — confirm dark card background, light text, no white flash
- [ ] Every modal in the Loop A inventory migrated to the shared wrapper
- [ ] shadcn CSS variable bridge added to globals.css
- [ ] Every migrated modal tested in BOTH light and dark mode
- [ ] Modal backdrop consistently dimmed (var(--modal-backdrop)) across all modals
- [ ] Modal entrance animation (translateY 24px + scale 0.98→1 fade, when premium active) verified on at least 5 different modals
- [ ] No modal anywhere in the app still uses a hardcoded `bg-white`

**GATE before Loop F.**

---

## LOOP F — Fix Buttons Everywhere

**Scope:** Identical to the original UX plan's Loop E — codebase-wide grep for plain async buttons, PLUS confirm `AsyncButton`'s 3 variants (primary/outline/danger) each have correct dark mode colors.

### AsyncButton Dark Mode Variant Check
```tsx
// AsyncButton.tsx VARIANT_CLASSES — verify dark-mode-safe versions exist
const VARIANT_CLASSES = {
  primary: 'bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white',
  outline: 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]',
  danger:  'bg-[#DC2626] hover:bg-[#B91C1C] text-white', // red stays same in both themes, sufficient contrast either way
}
```

### Verification Checklist
- [ ] Grep for plain async buttons returns zero results
- [ ] All 6 high-risk action locations (dropdown menu actions, modal confirms, status-transition buttons, Export/Print/Download, Cheque status buttons) confirmed AsyncButton
- [ ] AsyncButton's outline variant specifically re-verified in dark mode (most likely to have been hardcoded to a light gray border that disappears on dark backgrounds)

**GATE before Loop G.**

---

## LOOP G — Fix Navigation Feedback

**Scope:** Unchanged from original UX plan — `ROUTE_METADATA` completeness, raw `router.push` audit, sidebar `<a>` tag audit. Add: RouteProgressBar color check in dark mode.

### RouteProgressBar Dark Mode
```css
.route-progress-bar {
  background: var(--primary); /* was hardcoded #6366F1 — must use the token so it lightens correctly in dark mode per Section 6 */
}
```

### Verification Checklist
- [ ] (All original checklist items unchanged)
- [ ] Route progress bar color reads `var(--primary)`, visible with sufficient contrast against dark page background

**GATE before Loop H.**

---

## LOOP H — Dark Mode Full Sweep

**Scope:** A dedicated final pass across EVERY screen (not just the ones touched in Loops B-G) specifically for dark mode, since some screens may have passed UX audit but still have color issues not caught by the other loops (e.g., a page that already used PageState/AsyncButton correctly but still has a hardcoded chart color or an icon with a fixed hex fill).

### Task 1 — Codebase-Wide Hardcoded Color Grep
```bash
grep -rn "bg-white\b" src/ --include="*.tsx" | grep -v "node_modules"
grep -rn "text-black\b" src/ --include="*.tsx"
grep -rn "text-gray-9\|bg-gray-[5-9]\|border-gray-[2-4]00" src/ --include="*.tsx"
grep -rn "#FFFFFF\|#ffffff\|#000000" src/ --include="*.tsx" | grep -v "white\": '#FFFFFF'" # allow icon "white" props where genuinely intentional (e.g. icon color on a colored badge bg)
```
Every result gets triaged: either (a) converted to a CSS variable, or (b) confirmed as an intentional exception (e.g., text inside a colored badge that's the same in both themes) and documented as such.

### Task 2 — Contrast Verification (Rule 13)
For every text/background pairing newly added or touched during this whole plan, run through a contrast checker (WebAIM or browser DevTools' built-in contrast checker):
```
Body text on card background: --text-body on --card-bg → must be ≥ 4.5:1
Muted text on card background: --text-muted on --card-bg → must be ≥ 4.5:1 (this is the most likely failure point — muted grays are often too subtle in dark mode)
Badge text on badge background: every badge color pair → must be ≥ 4.5:1
```

### Task 3 — Screenshot Comparison Pass
Take a full-page screenshot of every one of the ~90 routes in BOTH light and dark mode. Visually scan for:
- Any element that still looks "light mode" against a dark background (the exact bug from your screenshot)
- Any text that's hard to read
- Any icon that's invisible or wrong color
- Any border that's missing/too faint to see the card boundary

### Task 4 — Third-Party Component Final Check
- [ ] Recharts: all charts use `useChartTheme()` hook (Section 6.4), no hardcoded stroke/fill colors remain
- [ ] react-day-picker (or native date input): dark mode calendar popover styled explicitly
- [ ] html5-qrcode scanner overlay: confirmed already dark-safe (Section 6.5)
- [ ] Sonner toasts: dark mode variant confirmed (Sonner has a built-in theme prop — set based on `useExperienceProfile`'s resolved theme, not hardcoded)
- [ ] Framer Motion page transitions: no color values in transition configs (motion should only ever animate opacity/transform, never color — colors are instant via CSS var swap, not animated)

### Verification Checklist
- [ ] Zero hardcoded color grep results remain (except documented intentional exceptions)
- [ ] All text/background pairs pass WCAG AA contrast
- [ ] All ~90 routes screenshot-compared light vs dark, zero visual regressions found
- [ ] All 5 third-party component categories confirmed dark-mode correct
- [ ] The specific screenshot bug (Add Purchase Bill modal) re-verified fixed as the FINAL confirmation step of this entire document

**FINAL GATE.**

---

## 16. Prevention — Lint Rules + PR Gate

### ESLint Custom Rules (block these from merging, not just warn)
```js
// 1. No hardcoded bg-white / text-black / bg-gray-N / text-gray-N in className strings
// 2. No <button> with async onClick that isn't AsyncButton
// 3. No router.push/router.replace calls outside useNavigation.ts
// 4. No new Dialog/Modal implementation that doesn't import from components/shared/Modal
```

### PR Checklist Template
```markdown
## UX + Motion + Dark Mode Compliance
- [ ] Every new data-fetching component uses PageState
- [ ] Every new async button uses AsyncButton
- [ ] New route added to ROUTE_METADATA in Header.tsx
- [ ] Every new modal/dialog uses the shared Modal component from components/shared/Modal.tsx
- [ ] Zero hardcoded colors — grep clean (bg-white, text-black, bg-gray-N, text-gray-N, #FFFFFF, #000000)
- [ ] Screenshotted in both light AND dark mode before requesting review
- [ ] All durations/easings read CSS variables, no hardcoded ms values
```

### Where This Lives
Same as before — folds into **Phase 8 Loop 5 (Performance Final Pass)** as an expanded sub-task, since that loop already sweeps the entire codebase.

---

## 17. Final Verification Checklist

- [ ] Loop A combined audit complete: ~90 routes + full modal inventory (~25-40 components) all scored
- [ ] 100% PASS on all UX state rules (Rules 1,2,3,5,6,7) after Loops B-D
- [ ] 100% of modal inventory migrated to shared `Modal` wrapper after Loop E
- [ ] The exact "Add Purchase Bill" bug from your screenshot confirmed fixed with a direct before/after comparison
- [ ] shadcn CSS variable bridge in place — all shadcn components auto-correct
- [ ] Zero plain async buttons remain (Loop F grep clean)
- [ ] Zero raw router.push/<a> for internal nav remain (Loop G grep clean)
- [ ] Zero hardcoded colors remain anywhere in the codebase (Loop H grep clean, exceptions documented)
- [ ] All text/background pairs verified WCAG AA compliant
- [ ] Premium motion profile (400ms, soft-overshoot easing, 40ms stagger, 2500ms shimmer) verified applying uniformly across modals, buttons, skeletons, and lists — not just some of them
- [ ] All ~90 routes screenshot-compared light vs dark mode, zero regressions
- [ ] PR template + ESLint rules in place to prevent regression going forward
- [ ] This document supersedes both prior standalone documents — delete or archive the old UX Consistency Enforcement Plan and Premium Motion Profile Update as separate files once this is adopted

---

*TAS ERP Unified Experience, Motion & Dark Mode Enforcement Plan | June 2026*
