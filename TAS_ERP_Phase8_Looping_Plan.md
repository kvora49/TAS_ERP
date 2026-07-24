# TAS ERP — Phase 8 Implementation Plan (Looping Methodology)
**Polish & Launch | Weeks 17–18 | Loop-Driven Execution**

> This is the final phase. It makes everything production-ready — no new business modules, only the features that make the ERP secure, fast, installable, and commercially deployable. Same loop protocol as Phases 6 & 7.

---

## Table of Contents
1. [Phase 8 Scope & Principles](#1-phase-8-scope--principles)
2. [LOOP 0 — Dark Mode](#loop-0--dark-mode)
3. [LOOP 1 — Security Hardening](#loop-1--security-hardening)
4. [LOOP 2 — Custom Bill Builder](#loop-2--custom-bill-builder)
5. [LOOP 3 — Bulk Import](#loop-3--bulk-import)
6. [LOOP 4 — Backup Automation](#loop-4--backup-automation)
7. [LOOP 5 — Performance Final Pass](#loop-5--performance-final-pass)
8. [LOOP 6 — PWA Finalization](#loop-6--pwa-finalization)
9. [LOOP 7 — Go-Live Hardening](#loop-7--go-live-hardening)
10. [Final Go-Live Checklist](#10-final-go-live-checklist)

---

## 1. Phase 8 Scope & Principles

### What This Phase Is NOT
- No new business modules
- No new DB tables for business logic
- No new navigation items (exception: Dark Mode toggle in header)

### What This Phase IS
- Making existing features unbreakable in production
- Adding security layers that matter when real money is involved
- Making the app installable and fast on mobile
- Giving businesses tools to migrate from their existing systems

### New DB tables (only 3, all infrastructure)
```sql
-- 2FA secrets
CREATE TABLE user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_row" ON user_2fa FOR ALL USING (user_id = auth.uid());

-- IP whitelist per user
CREATE TABLE user_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  label TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ip_address)
);
ALTER TABLE user_ip_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON user_ip_whitelist
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Custom bill layout config (Layer 3 builder output)
CREATE TABLE custom_bill_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id),
  name TEXT NOT NULL,
  layout_json JSONB NOT NULL,
  canvas_width INTEGER DEFAULT 794,
  canvas_height INTEGER DEFAULT 1123,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE custom_bill_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON custom_bill_layouts
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
```

---

## LOOP 0 — Dark Mode

**Scope:** System-wide dark theme using CSS variable swap. Zero JS overhead — pure CSS.

### How It Works
Dark mode swaps `:root` CSS variables directly — every component using `var(--primary)`, `var(--sidebar-bg)` etc. automatically responds with zero code changes.

```css
[data-theme="dark"] {
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
  --badge-green-bg: #14532D;  --badge-green-text: #86EFAC;
  --badge-red-bg: #450A0A;    --badge-red-text: #FCA5A5;
  --badge-orange-bg: #431407; --badge-orange-text: #FDBA74;
  --badge-blue-bg: #1E3A5F;   --badge-blue-text: #93C5FD;
  --badge-purple-bg: #2E1065; --badge-purple-text: #C4B5FD;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
}
```

### Implementation
```tsx
// store/theme.ts — Zustand store, persisted to localStorage
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'
interface ThemeStore {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: (theme) => {
        const resolved = theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          : theme
        document.documentElement.setAttribute('data-theme', resolved)
        set({ theme, resolvedTheme: resolved })
      },
    }),
    { name: 'tas-erp-theme' }
  )
)
```

Apply an inline script in `layout.tsx` before render to prevent flash-of-wrong-theme, reading the persisted Zustand value from localStorage and setting `data-theme` on `<html>` synchronously.

### Dark Mode Toggle (Header)
```
Location: Header, between notification bell and user avatar
3-way toggle: Sun / Monitor / Moon icons
Active state: bg-[var(--primary-light)] text-[var(--primary)]
Style: flex items-center gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-1
```

### Verification Checklist
- [ ] Toggle persists across refresh and new tabs
- [ ] System mode responds to OS preference change live
- [ ] No flash of wrong theme on load
- [ ] All screens tested in dark mode — zero hardcoded hex colors outside CSS vars
- [ ] Charts use CSS variables for labels/legends
- [ ] Skeleton shimmer works in dark mode
- [ ] PDF export always renders light-mode regardless of active theme
- [ ] Print always light-mode via `@media print` override

**GATE before Loop 1.**

---

## LOOP 1 — Security Hardening

**Scope:** 2FA (TOTP), IP Whitelist, Session Timeout enforcement.

### 1.1 Two-Factor Authentication (TOTP)
Setup flow (Settings → Users & Roles → Edit User → Enable 2FA):
1. Generate secret server-side (otplib), encrypt AES-256, store in `user_2fa.totp_secret`
2. Show QR code (otpauth:// URI) — scan with Google Authenticator/Authy
3. User enters 6-digit code → server verifies → `is_enabled = true`, generates 10 hashed one-time backup codes shown once
4. Success confirmation

Login flow with 2FA active: after password verified, redirect to `/auth/2fa-verify` before completing the Supabase session. Backup code option available, single-use.

**UI:** Same split-screen layout as Login. Shield icon in `#EEF2FF` circle. 6 individual digit inputs, auto-advance. "Use a backup code instead" link.

### 1.2 IP Whitelist
Settings → Users & Roles → Edit User → "IP Restrictions" toggle (off by default). When on: table of allowed IPs + labels, "Add Current IP" button. Enforced in `middleware.ts` — request IP checked against whitelist before allowing access; blocked requests redirect to an IP-blocked page.

### 1.3 Session Timeout
`useSessionTimeout(minutes)` hook tracks mouse/keyboard/touch activity, shows a 60-second warning modal before forced logout, resets on "Stay Logged In".

### Verification Checklist
- [ ] 2FA QR scans correctly in Google Authenticator and Authy
- [ ] Wrong TOTP code rejected
- [ ] Backup code works once then invalidated
- [ ] IP restriction blocks unlisted IP, allows whitelisted IP
- [ ] Session timeout fires at exactly the configured duration
- [ ] Warning modal appears 1 minute prior
- [ ] All three features work simultaneously without conflict

**GATE before Loop 2.**

---

## LOOP 2 — Custom Bill Builder

**Scope:** Drag-and-drop bill layout designer at `/settings/bill-builder`, opened from Brands → Bill Format tab.

### Architecture
Uses `@dnd-kit/core` + custom canvas renderer (no external bill-builder library).
```
Left: Field Palette (Business Info / Party Info / Bill Info / Totals / Items Table columns / Extras)
Center: A4 Canvas (794x1123px @ 96dpi), grid-snap optional
Right: Properties Panel (changes per selected element type)
Top: Toolbar — Save / Preview / Undo-Redo / Reset to Template
```

Element types: TEXT (bound to a field), IMAGE (logo), TABLE (items, configurable columns), BOX (divider), STATIC_TEXT (free text).

Layout persists as JSON to `custom_bill_layouts.layout_json` — array of positioned/styled elements with field bindings.

### PDF Rendering
`lib/pdf/custom-layout-renderer.ts` walks the layout JSON, scales canvas coordinates to the jsPDF page, and renders each element type (text, table, image) using real bill data.

### Verification Checklist
- [ ] All field types drag from palette to canvas
- [ ] Reposition via drag, resize via handles
- [ ] Properties panel updates styling live
- [ ] Table columns show/hide/reorder correctly
- [ ] Preview renders using a real bill's data
- [ ] Save persists to `custom_bill_layouts`
- [ ] PDF output has no element overflow
- [ ] "Reset to Template" restores a Phase 6 system template
- [ ] Usable at 1024px+ viewport (not mobile — canvas needs space)

**GATE before Loop 3.**

---

## LOOP 3 — Bulk Import

**Scope:** `/settings/import` — flexible column-mapped import for Parties, Designs, Raw Materials, Opening Balances.

### 4-Step Flow
1. **Upload** — .xlsx/.xls/.csv, select what to import, 10MB max
2. **Map Columns** — required fields (*) mapped against the file's actual header row via dropdown; "Auto-Map" fuzzy-matches common names; live preview of first 5 rows
3. **Validate** — shows Valid/Warning/Error row counts, error table with reasons, "Skip errors and import valid rows" toggle
4. **Import & Result** — chunked async import (50 rows/batch) with progress bar, downloadable result report

### Verification Checklist
- [ ] 500+ row files import without timeout (chunked)
- [ ] Auto-Map correctly identifies ≥70% of standard Tally column names
- [ ] Required-field validation blocks incomplete rows
- [ ] Skip-errors mode imports valid rows despite some failures
- [ ] Duplicate detection (GSTIN/phone) warns rather than hard-fails
- [ ] Opening Balance import creates correct `opening_balances` records
- [ ] Re-importing the same file is idempotent (upsert on unique key)
- [ ] Import report CSV documents every row's outcome

**GATE before Loop 4.**

---

## LOOP 4 — Backup Automation

**Scope:** Weekly automated backup to the second R2 account, extending Phase 2's manual backup.

### Architecture
Vercel Cron (Sunday 11:45 PM IST) → `/api/cron/backup` → exports all business tables → compresses → uploads to R2 backup bucket → inserts `backup_history` (type='automatic') → FCM notification to owner.

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/backup", "schedule": "45 18 * * 0" }] }
```

Retention: backups older than 30 days deleted from both R2 and `backup_history` after each successful run.

Settings UI (Phase 2's Backup & Restore page) gets a new "Automated Backups" card: enable toggle, read-only schedule/retention display, last automated backup status, "Test Backup Now" (admin only).

### Verification Checklist
- [ ] Cron endpoint requires correct `CRON_SECRET` header
- [ ] Backup includes all business tables
- [ ] Stored in the BACKUP R2 bucket, not the FILES bucket
- [ ] `backup_history` row created per run
- [ ] FCM notification sent on success
- [ ] 30-day retention enforced correctly
- [ ] Settings UI reflects automated backup status accurately
- [ ] Failed cron run logs status='failed' with error_message

**GATE before Loop 5.**

---

## LOOP 5 — Performance Final Pass

**Scope:** Apply the Performance Strategy document across all Phase 3–7 modules.

### 5.1 Sequential Query Audit
Find and fix every API route with sequential `await` chains — replace with `Promise.all`.

### 5.2 Column Selection Audit
Replace every `select('*')` on a list endpoint with only the columns actually rendered.

### 5.3 TanStack Query Migration — 7 Highest-Traffic Pages
Dashboard, Parties List, Purchases List, Production Lots List, Finished Stock Overview, Sales Bills List, Party Ledger — each gets a dedicated hook with an appropriate `staleTime`. Financial reports (Balance Sheet, P&L, GST) intentionally stay outside TanStack Query — always computed fresh via aggregate SQL functions.

### 5.4 Missing Index Audit
Run the standard "FK columns without an index" query against the schema; add indexes for `party_id`, `bill_id`, `design_id`, `lot_id` wherever missing on high-traffic tables.

### 5.5 Materialized View — Stock Summary
`mv_stock_summary` aggregates `finished_stock` by design/colour/godown, refreshed via trigger on every `finished_stock` write, unique-indexed for `REFRESH CONCURRENTLY`.

### Performance Targets
| Screen | Target |
|---|---|
| Dashboard KPI cards | < 300ms (cached) |
| Production Lots list | < 400ms |
| Finished Stock Overview | < 300ms (materialized view) |
| Sales Bills list | < 300ms |
| Balance Sheet | < 800ms (aggregate function) |
| Party Ledger | < 200ms |

### Verification Checklist
- [ ] Zero sequential await chains remain in Phase 3-7 routes
- [ ] Zero `select('*')` on list endpoints
- [ ] 7 pages migrated to TanStack Query with correct stale times
- [ ] All FK columns on high-traffic tables indexed
- [ ] Materialized view refreshes correctly on stock changes
- [ ] All 6 performance targets met, measured via DevTools
- [ ] No functional regressions introduced

**GATE before Loop 6.**

---

## LOOP 6 — PWA Finalization

**Scope:** Installable, offline-capable, fast-repeat-load Progressive Web App.

### 6.1 Manifest
`public/manifest.json` — name, icons (192/512/180), standalone display, theme colors matching brand, app shortcuts (Scan QR, Add Sale Bill).

### 6.2 Service Worker
Custom `sw.js`: Network-first for `/api/*` (always fresh data), cache-first for fonts/images, stale-while-revalidate for page routes.

### 6.3 Install Prompt
`InstallPromptBanner` — captures `beforeinstallprompt`, shows after the 3rd visit if not previously dismissed, permanently dismissible.

### 6.4 Offline Detection
`useOnlineStatus()` hook + the Experience Framework's `OfflineState` component; list/detail pages show cached data with an explicit "viewing offline data" notice when offline.

### Verification Checklist
- [ ] Installable on Android Chrome and iOS Safari
- [ ] Standalone launch with no browser chrome
- [ ] App shortcuts work from home screen long-press
- [ ] Static assets served from cache offline
- [ ] API calls never serve stale data offline (network-first honored)
- [ ] Offline banner appears/disappears correctly with connectivity changes
- [ ] Install prompt timing and dismissal persistence correct
- [ ] Scan (PWA) works correctly as an installed app
- [ ] FCM push received while app installed but closed

**GATE before Loop 7.**

---

## LOOP 7 — Go-Live Hardening

**Scope:** Final production readiness — Supabase upgrade, environment audit, security headers, full QA sweep.

### 7.1 Supabase Pro Upgrade
Upgrade before go-live: daily backups, no project pausing, 500 concurrent Realtime connections, 8GB DB, 7-day point-in-time recovery.

### 7.2 Environment Variables Audit
All 22 required variables (Supabase, R2 primary + backup, Firebase, CRON_SECRET, APP_URL, AES_ENCRYPTION_KEY) confirmed set in Vercel Production — not just `.env.local`.

### 7.3 Security Headers
`next.config.ts` adds X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and a scoped Content-Security-Policy covering Supabase, R2, and FCM origins.

### 7.4 Final QA Sweep — 8 Critical End-to-End Flows
1. New business onboarding (Register → Brand → Godown → Design → Party)
2. Raw material purchase → payment → ledger reconciliation
3. Full production cycle → lot complete → finished stock created
4. Sale bill with charges + discount → stock deducted → PDF
5. Partial then full payment collection → status transitions correctly
6. Security: 2FA login flow + IP whitelist block test
7. Reports: Balance Sheet identity holds, GST nets credit notes correctly
8. Mobile: PWA install → scan QR → add to bill

### Verification Checklist
- [ ] Supabase Pro active, daily backups visible in dashboard
- [ ] All 22 environment variables set in Vercel Production
- [ ] Security headers present (verified via securityheaders.com)
- [ ] All 8 QA flows pass in production deployment
- [ ] `npm run build` — zero errors, zero TypeScript errors
- [ ] Lighthouse: Performance ≥ 80, Accessibility ≥ 90, PWA ≥ 90
- [ ] No console errors across the 8 flows
- [ ] Custom domain + HTTPS active
- [ ] FCM verified on real Android and iOS devices
- [ ] Cron job confirmed running in Vercel Dashboard

**FINAL GATE.**

---

## 10. Final Go-Live Checklist

### Business Logic
- [ ] Balance Sheet: Assets = Liabilities + Equity, verified against real data
- [ ] GST auto-tier applies 5%/12% correctly by per-piece rate
- [ ] Multi-brand bills always use business letterhead, never brand-specific
- [ ] Profit panel inaccessible to non-owner/admin at the API level
- [ ] Stock QR codes contain only a raw UUID, never a URL

### Security
- [ ] 2FA verified against 3 different authenticator apps
- [ ] IP whitelist blocks correctly
- [ ] Session timeout fires at the configured duration
- [ ] RLS active on all 40+ tables, zero exceptions
- [ ] `bill_profit` confirmed inaccessible to staff/manager/accountant via direct API test

### Performance
- [ ] Dashboard < 300ms cached
- [ ] Finished Stock Overview < 300ms (materialized view)
- [ ] Balance Sheet < 800ms
- [ ] Zero sequential await chains remain anywhere
- [ ] TanStack Query active on the 7 highest-traffic pages

### PWA
- [ ] Installable on Android and iOS
- [ ] Shortcuts functional
- [ ] Service worker caching correct
- [ ] Install prompt behavior correct

### Infrastructure
- [ ] Supabase Pro active
- [ ] Weekly cron backup running to second R2 bucket
- [ ] 30-day retention enforced
- [ ] All 22 production environment variables set

### Final
- [ ] `npm run build` — zero errors
- [ ] Lighthouse Performance ≥ 80
- [ ] All 8 QA flows pass in production
- [ ] Deployed at production URL with HTTPS
- [ ] GO LIVE

---

*TAS ERP Phase 8 Implementation Plan — Polish & Launch | June 2026*
