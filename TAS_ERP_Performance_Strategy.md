# TAS ERP — Performance Strategy & Implementation Plan
**Engineering Specification | Applies to all phases from Phase 3 onwards**

> This document translates the TAS ERP Performance Objective into concrete, stack-specific implementation steps. Every fix is tied to a measurable target and a specific file or pattern change.

---

## Table of Contents
1. [Problem Diagnosis](#1-problem-diagnosis)
2. [Performance Targets](#2-performance-targets)
3. [Phase 1 — Eliminate Functional Errors](#3-phase-1--eliminate-functional-errors)
4. [Phase 2 — Backend Optimization](#4-phase-2--backend-optimization)
5. [Phase 3 — Frontend Data Loading](#5-phase-3--frontend-data-loading)
6. [Phase 4 — TanStack Query](#6-phase-4--tanstack-query)
7. [Phase 5 — Progressive Rendering](#7-phase-5--progressive-rendering)
8. [Phase 6 — Navigation Prefetching](#8-phase-6--navigation-prefetching)
9. [Measurement Tooling](#9-measurement-tooling)
10. [Definition of Done](#10-definition-of-done)

---

## 1. Problem Diagnosis

### Root Causes in TAS ERP Stack

| Bottleneck | Where It Happens | Typical Impact |
|---|---|---|
| Dev-mode route compilation | Next.js dev server only | +3–8s first page visit in dev |
| DB schema mismatches → HTTP 500 | Supabase API routes | Retries + error states block render |
| Sequential Supabase queries | API route handlers | N queries × 100ms = N×100ms latency |
| Sequential `fetch()` calls in pages | Page components | Each awaits previous before starting |
| No client-side caching | Every navigation re-fetches | 5–10s on every page switch |
| No request deduplication | Multiple components calling same API | Same data fetched 3–5× per page |
| Blocking render until all data ready | Page-level `await` | Blank screen while slowest request runs |
| No skeleton loaders | Tables, charts, stat cards | Perceived wait longer than actual |
| Large JS bundles | Next.js App Router | Slow initial load on first visit |

### Why 5–10s Navigation Happens

Current pattern in most pages:
```ts
// ❌ CURRENT — Sequential, blocking, no cache
export default async function PurchasesPage() {
  const purchases = await fetch('/api/raw-materials/purchases')
  const suppliers = await fetch('/api/parties?type=supplier')
  const godowns = await fetch('/api/master-data/godowns')
  const stats = await fetch('/api/raw-materials/purchases/stats')
  // Nothing renders until ALL 4 requests complete
  // If each takes 300ms → 1.2s minimum
  // If any fails → blank page
}
```

With 10 such pages open in a session → 10 × 1.2s = 12s+ of wait time per working day session.

---

## 2. Performance Targets

| Metric | Target | Stretch Goal |
|---|---|---|
| Route navigation (cached) | < 100ms | < 50ms |
| Route navigation (first visit) | < 500ms | < 300ms |
| Common screen first meaningful paint | < 500ms | < 300ms |
| API response time (simple queries) | < 200ms | < 100ms |
| API response time (complex joins) | < 500ms | < 300ms |
| DB query time | < 100ms | < 50ms |
| Duplicate API requests per page | 0 | 0 |
| Pages with loading waterfalls | 0 | 0 |

---

## 3. Phase 1 — Eliminate Functional Errors

Fix all HTTP 500s first. A failed request that retries costs 3× the time of a successful one.

### 1.1 Schema Mismatch Checklist

Run this after every new phase SQL migration:

```sql
-- Verify all foreign keys resolve
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

```sql
-- Check for tables missing RLS policies
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public'
  );
```

### 1.2 API Route Error Handling Standard

Every API route must return structured errors — never let Supabase errors bubble as unhandled exceptions:

```ts
// lib/api/response.ts
export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 500, details?: unknown) {
  console.error(`[API Error ${status}]:`, message, details)
  return Response.json({ success: false, error: message }, { status })
}

// Usage in every route:
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data, error } = await supabase.from('brands').select('*')
    if (error) return apiError(error.message, 500, error)

    return apiSuccess(data)
  } catch (err) {
    return apiError('Unexpected server error', 500, err)
  }
}
```

### 1.3 Required DB Indexes

Add these indexes immediately — missing indexes on FK columns cause full table scans:

```sql
-- Every table that has business_id (most important index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brands_business_id ON brands(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_godowns_business_id ON godowns(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_business_id ON designs(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parties_business_id ON parties(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_material_purchases_business_id ON raw_material_purchases(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_lots_business_id ON production_lots(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stage_entries_business_id ON stage_entries(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finished_stock_business_id ON finished_stock(business_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challans_business_id ON challans(business_id);

-- Soft delete filter (very frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brands_deleted_at ON brands(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parties_deleted_at ON parties(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_deleted_at ON designs(deleted_at) WHERE deleted_at IS NULL;

-- Lookup by status (production lots, purchases, challans)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_lots_status ON production_lots(business_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_material_purchases_payment_status ON raw_material_purchases(business_id, payment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challans_status ON challans(business_id, status);

-- Date range queries (purchases, ledger, reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_invoice_date ON raw_material_purchases(business_id, invoice_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stage_entries_entry_date ON stage_entries(business_id, entry_date DESC);

-- QR UUID lookup (must be instant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_finished_stock_qr_uuid ON finished_stock(qr_uuid);

-- Audit log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_business_created ON audit_log(business_id, created_at DESC);
```

---

## 4. Phase 2 — Backend Optimization

### 2.1 Parallelize Independent Supabase Queries

**Rule:** Any two queries that don't depend on each other's results must run in parallel using `Promise.all`.

```ts
// ❌ BEFORE — Sequential: 300ms + 200ms + 150ms = 650ms minimum
const purchases = await supabase.from('raw_material_purchases').select('*')
const suppliers = await supabase.from('parties').select('id, name').eq('type', ['supplier'])
const godowns = await supabase.from('godowns').select('id, name')

// ✅ AFTER — Parallel: max(300ms, 200ms, 150ms) = 300ms
const [purchasesRes, suppliersRes, godownsRes] = await Promise.all([
  supabase.from('raw_material_purchases')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false })
    .range(0, 9),

  supabase.from('parties')
    .select('id, name, code')
    .eq('business_id', businessId)
    .contains('type', ['supplier'])
    .is('deleted_at', null),

  supabase.from('godowns')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('is_active', true)
])
```

**Applies to every list page with filters** — stat cards, dropdown options, and table data all run in parallel.

### 2.2 Stat Cards — Single Aggregate Query

Instead of 4–5 separate count queries for stat cards, use a single SQL function:

```sql
-- Create once in Supabase SQL Editor
CREATE OR REPLACE FUNCTION get_purchase_stats(p_business_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_purchases',   COUNT(*),
    'total_amount',      COALESCE(SUM(grand_total), 0),
    'total_paid',        COALESCE(SUM(paid_amount), 0),
    'total_pending',     COALESCE(SUM(grand_total - paid_amount), 0),
    'total_items',       COALESCE(SUM(
                           (SELECT COUNT(*) FROM raw_material_purchase_items
                            WHERE purchase_id = rmp.id)
                         ), 0),
    'unpaid_count',      COUNT(*) FILTER (WHERE payment_status = 'unpaid'),
    'partial_count',     COUNT(*) FILTER (WHERE payment_status = 'partial'),
    'paid_count',        COUNT(*) FILTER (WHERE payment_status = 'paid')
  ) INTO result
  FROM raw_material_purchases rmp
  WHERE business_id = p_business_id
    AND deleted_at IS NULL;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```ts
// One RPC call instead of 4 queries
const { data: stats } = await supabase.rpc('get_purchase_stats', {
  p_business_id: businessId
})
```

Create equivalent functions for: `get_production_stats`, `get_stock_stats`, `get_party_stats`, `get_job_work_stats`.

### 2.3 Select Only Required Columns

Never use `select('*')` in production. Specify exact columns needed:

```ts
// ❌ Fetches all 25 columns including ones never displayed
const { data } = await supabase.from('raw_material_purchases').select('*')

// ✅ Fetches only the 8 columns shown in the table
const { data } = await supabase
  .from('raw_material_purchases')
  .select('id, purchase_number, invoice_date, supplier_id, grand_total, paid_amount, payment_status, created_at')
```

For list pages: select only columns shown in the table.
For detail pages: select all columns needed for that specific view.

### 2.4 Pagination — Never Fetch Unbounded Data

Every list query must have `.range()`:

```ts
const PAGE_SIZE = 10

const { data, count } = await supabase
  .from('production_lots')
  .select('id, lot_number, brand_id, design_id, status, total_quantity, completed_quantity', { count: 'exact' })
  .eq('business_id', businessId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
```

**Never omit `.range()` on any list endpoint.** Even if the UI shows "all", paginate and lazy-load.

---

## 5. Phase 3 — Frontend Data Loading

### 5.1 Replace Sequential fetch Chains

**Pattern: Never `await` multiple fetches in sequence.**

```ts
// ❌ BEFORE — Each fetch waits for previous
export default async function Page() {
  const a = await fetchA()
  const b = await fetchB()
  const c = await fetchC()
  return <UI a={a} b={b} c={c} />
}

// ✅ AFTER — All fire simultaneously
export default async function Page() {
  const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()])
  return <UI a={a} b={b} c={c} />
}
```

### 5.2 Separate Critical from Non-Critical Data

Not all data is equally important for initial render. Split it:

```tsx
// Critical: needed to show the page shell (loads immediately)
// Non-critical: loads after shell is visible (can show skeleton)

// app/(dashboard)/raw-materials/purchases/page.tsx
export default async function PurchasesPage() {
  // CRITICAL — loads in parallel, page blocked until done
  const [purchases, stats] = await Promise.all([
    fetchPurchases({ page: 1 }),
    fetchPurchaseStats(),
  ])

  return (
    <>
      <PageHeader title="Purchases" ... />
      <StatCards data={stats} />
      <PurchasesTable data={purchases} />

      {/* NON-CRITICAL — loads client-side, shows skeleton first */}
      <Suspense fallback={<ChartSkeleton />}>
        <PurchaseCharts />   {/* fetches its own data client-side */}
      </Suspense>
    </>
  )
}
```

### 5.3 Dropdown Options — Fetch Once, Reuse Everywhere

Dropdown options (brands, godowns, parties, stages) are fetched on EVERY page that has a filter bar. This is wasteful.

```ts
// lib/data/master-options.ts
// These are stable data — fetch once, cache aggressively

export async function getBrandOptions(businessId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brands')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')
  return data ?? []
}
// Called with Next.js cache: fetch(..., { next: { revalidate: 300 } })
// or using unstable_cache for Supabase queries
```

---

## 6. Phase 4 — TanStack Query

### 6.1 Setup

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

```tsx
// app/(dashboard)/layout.tsx — wrap with QueryClientProvider
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export default function DashboardLayout({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,      // data stays fresh for 2 minutes
        gcTime: 1000 * 60 * 10,        // keep in cache for 10 minutes
        retry: 1,                       // retry once on failure
        refetchOnWindowFocus: false,    // don't refetch when user switches tabs
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### 6.2 Query Key Convention

Consistent query keys enable targeted cache invalidation:

```ts
// lib/query-keys.ts
export const queryKeys = {
  // Master data — rarely changes, long cache
  brands:           (bizId: string) => ['brands', bizId],
  godowns:          (bizId: string) => ['godowns', bizId],
  productionStages: (bizId: string) => ['production-stages', bizId],
  designs:          (bizId: string, filters?: object) => ['designs', bizId, filters],

  // Transactional — changes frequently, shorter cache
  purchases:        (bizId: string, filters?: object) => ['purchases', bizId, filters],
  purchaseStats:    (bizId: string) => ['purchases', bizId, 'stats'],
  purchaseDetail:   (bizId: string, id: string) => ['purchases', bizId, id],

  lots:             (bizId: string, filters?: object) => ['lots', bizId, filters],
  lotDetail:        (bizId: string, id: string) => ['lots', bizId, id],
  stageEntries:     (bizId: string, lotId: string) => ['stage-entries', bizId, lotId],

  parties:          (bizId: string, filters?: object) => ['parties', bizId, filters],
  partyLedger:      (bizId: string, partyId: string) => ['ledger', bizId, partyId],

  finishedStock:    (bizId: string, filters?: object) => ['finished-stock', bizId, filters],
  stockDetail:      (bizId: string, designId: string) => ['stock-detail', bizId, designId],

  dashboard:        (bizId: string) => ['dashboard', bizId],
}
```

### 6.3 Standard useQuery Hook Pattern

```ts
// hooks/usePurchases.ts
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useBusinessId } from '@/hooks/useBusinessId'

export function usePurchases(filters?: PurchaseFilters) {
  const businessId = useBusinessId()

  return useQuery({
    queryKey: queryKeys.purchases(businessId, filters),
    queryFn: () => fetchPurchases(filters),
    enabled: !!businessId,
    staleTime: 1000 * 60 * 2,   // 2 min — purchases change frequently
  })
}

// hooks/useBrands.ts
export function useBrands() {
  const businessId = useBusinessId()

  return useQuery({
    queryKey: queryKeys.brands(businessId),
    queryFn: () => fetchBrands(),
    staleTime: 1000 * 60 * 30,  // 30 min — brands rarely change
  })
}
```

### 6.4 Cache Invalidation After Mutations

```ts
// When a purchase is saved, invalidate related caches:
const queryClient = useQueryClient()

const createPurchase = useMutation({
  mutationFn: (data: CreatePurchaseInput) => savePurchase(data),
  onSuccess: () => {
    // Invalidate the purchases list (will refetch on next view)
    queryClient.invalidateQueries({ queryKey: queryKeys.purchases(businessId) })
    // Invalidate stats (total amount changed)
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseStats(businessId) })
    // Invalidate dashboard (pending dues changed)
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) })

    toast.success('Purchase saved successfully')
    router.push('/raw-materials/purchases')
  },
  onError: (error) => {
    toast.error('Failed to save purchase')
  }
})
```

### 6.5 Stale Time Strategy Per Data Type

```ts
// Different data changes at different rates — cache accordingly:

const STALE_TIMES = {
  // Master data — user changes these rarely
  brands:           30 * 60 * 1000,   // 30 minutes
  godowns:          30 * 60 * 1000,
  productionStages: 30 * 60 * 1000,
  designs:          10 * 60 * 1000,   // 10 minutes (new designs added more often)
  parties:          10 * 60 * 1000,

  // Transactional — changes during active work session
  purchases:        2 * 60 * 1000,    // 2 minutes
  productionLots:   2 * 60 * 1000,
  stageEntries:     1 * 60 * 1000,    // 1 minute (active production)
  finishedStock:    2 * 60 * 1000,

  // Live / real-time — managed by Supabase Realtime, not staleTime
  dashboard:        0,                // always fresh (Realtime handles it)
}
```

---

## 7. Phase 5 — Progressive Rendering

### 7.1 Rule: Page Shell Renders Immediately

The page title, header, breadcrumb, filter bar, and stat card skeletons must render before any data arrives.

```tsx
// ✅ CORRECT pattern — shell renders instantly, data fills in
export default function PurchasesPage() {
  const { data: purchases, isLoading } = usePurchases()
  const { data: stats, isLoading: statsLoading } = usePurchaseStats()

  return (
    <div>
      {/* Shell renders immediately — no loading state */}
      <PageHeader title="Purchases" ... />

      {/* Stat cards: skeleton while loading, real data after */}
      {statsLoading
        ? <StatCardsSkeleton count={5} />
        : <StatCards data={stats} />
      }

      {/* Table: skeleton while loading */}
      {isLoading
        ? <TableSkeleton columns={10} rows={8} />
        : <PurchasesTable data={purchases} />
      }
    </div>
  )
}
```

### 7.2 Skeleton Components — Required for Every Data Surface

Every component that loads data must have a skeleton version. Skeletons use Tailwind `animate-pulse`:

```tsx
// components/tables/TableSkeleton.tsx
export function TableSkeleton({ columns = 6, rows = 8 }: { columns?: number, rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      {/* Header row */}
      <div className="bg-[#F9FAFB] h-11 flex items-center gap-4 px-6">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-[#E5E7EB] rounded animate-pulse flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 flex items-center gap-4 px-6 border-b border-[#E5E7EB]">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className={`h-3 bg-[#F1F5F9] rounded animate-pulse flex-1
              ${j === 0 ? 'max-w-[40px]' : ''}
              ${j === columns - 1 ? 'max-w-[80px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// components/dashboard/StatCardsSkeleton.tsx
export function StatCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#F1F5F9] rounded-xl" />
            <div className="flex-1">
              <div className="h-7 bg-[#F1F5F9] rounded w-24 mb-2" />
              <div className="h-3 bg-[#F1F5F9] rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// components/shared/ChartSkeleton.tsx
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 animate-pulse">
      <div className="h-4 bg-[#F1F5F9] rounded w-32 mb-4" />
      <div className={`h-[${height}px] bg-[#F1F5F9] rounded-lg`} />
    </div>
  )
}
```

### 7.3 Optimistic Updates for Mutations

For fast perceived performance on creates/edits:

```ts
const createBrand = useMutation({
  mutationFn: saveBrand,

  // Optimistic: add to UI immediately before server confirms
  onMutate: async (newBrand) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.brands(businessId) })
    const previous = queryClient.getQueryData(queryKeys.brands(businessId))

    queryClient.setQueryData(queryKeys.brands(businessId), (old: Brand[]) => [
      ...old,
      { ...newBrand, id: 'temp-id', created_at: new Date().toISOString() }
    ])

    return { previous }
  },

  // If server fails: rollback
  onError: (err, newBrand, context) => {
    queryClient.setQueryData(queryKeys.brands(businessId), context?.previous)
    toast.error('Failed to save brand')
  },

  // On success: invalidate to get real data from server
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.brands(businessId) })
  }
})
```

---

## 8. Phase 6 — Navigation Prefetching

### 8.1 Prefetch on Hover (Link Prefetching)

```tsx
// components/layout/Sidebar.tsx — prefetch on nav item hover
import { useQueryClient } from '@tanstack/react-query'

function SidebarNavItem({ href, prefetchFn, ...props }) {
  const queryClient = useQueryClient()

  return (
    <Link
      href={href}
      onMouseEnter={() => {
        // Start fetching data 200ms before user clicks
        prefetchFn && queryClient.prefetchQuery(prefetchFn())
      }}
      {...props}
    />
  )
}

// Usage:
<SidebarNavItem
  href="/raw-materials/purchases"
  prefetchFn={() => ({
    queryKey: queryKeys.purchases(businessId),
    queryFn: () => fetchPurchases({ page: 1 }),
    staleTime: 30 * 1000, // only prefetch if data older than 30s
  })}
>
  Purchases
</SidebarNavItem>
```

### 8.2 Next.js Route Prefetching

Next.js App Router prefetches routes automatically for visible `<Link>` components. Ensure all nav items use `<Link>` not `<a>` or `router.push()` for navigation:

```tsx
// ✅ Next.js prefetches the route JS chunk on hover/viewport
import Link from 'next/link'
<Link href="/raw-materials/purchases">Purchases</Link>

// ❌ No prefetching
<a href="/raw-materials/purchases">Purchases</a>
router.push('/raw-materials/purchases')  // no prefetch
```

### 8.3 Prefetch Master Data at Login

At login, prefetch brands, godowns, and other stable dropdown data. By the time user reaches any page, dropdown options are already in cache:

```ts
// app/(auth)/login/page.tsx — after successful login
async function onLoginSuccess(businessId: string) {
  // Fire and forget — prefetch common data
  queryClient.prefetchQuery({
    queryKey: queryKeys.brands(businessId),
    queryFn: () => fetchBrands(),
    staleTime: 30 * 60 * 1000,
  })
  queryClient.prefetchQuery({
    queryKey: queryKeys.godowns(businessId),
    queryFn: () => fetchGodowns(),
    staleTime: 30 * 60 * 1000,
  })
  queryClient.prefetchQuery({
    queryKey: queryKeys.productionStages(businessId),
    queryFn: () => fetchProductionStages(),
    staleTime: 30 * 60 * 1000,
  })

  router.push('/') // Navigate to dashboard while data pre-loads
}
```

---

## 9. Measurement Tooling

### 9.1 Benchmark Before Every Optimization

Use browser DevTools Network tab + Performance tab. Record these numbers before and after each change:

```
Page: [page name]
Date: [date]
Before optimization:
  - Time to first render: Xms
  - Time to meaningful content: Xms
  - Number of API requests: N
  - Total data transferred: X KB
  - Duplicate requests: N

After optimization:
  - Time to first render: Xms (Δ = -Xms = X% faster)
  - Time to meaningful content: Xms
  - Number of API requests: N (Δ = -N)
  - Total data transferred: X KB
  - Duplicate requests: 0
```

### 9.2 API Route Timing Middleware

Add timing to every API route to measure slow endpoints:

```ts
// middleware.ts — add timing header to all API responses
export function middleware(request: NextRequest) {
  const start = Date.now()
  const response = NextResponse.next()
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
  return response
}
```

Check `X-Response-Time` headers in DevTools Network tab. Any route consistently > 200ms needs investigation.

### 9.3 Supabase Query Analysis

For slow DB queries, use Supabase Dashboard → SQL Editor:

```sql
-- Find slow queries (requires pg_stat_statements extension)
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 10. Definition of Done

A feature is complete only when ALL of the following are true:

### Functional
- [ ] Feature works correctly per spec
- [ ] All edge cases handled (empty state, error state, loading state)
- [ ] No console errors or warnings

### Security
- [ ] All API routes require authentication
- [ ] All queries include `business_id` filter
- [ ] RLS policies active on all tables used

### Performance
- [ ] No sequential fetch chains — all parallel with `Promise.all`
- [ ] Stat card data fetched with single aggregate function (not N queries)
- [ ] List queries have `.range()` pagination
- [ ] Only required columns selected (no `select('*')` on list endpoints)
- [ ] TanStack Query used for all client-side data fetching
- [ ] Skeleton loader shown while data loads
- [ ] Page shell renders before data arrives
- [ ] No duplicate API requests for the same data on the same page

### Measurement
- [ ] Time to meaningful content measured and recorded
- [ ] Meets target: < 500ms for common screens
- [ ] API response time measured: < 200ms for simple queries

---

## Quick Reference — Antipatterns to Avoid

| ❌ Never Do This | ✅ Do This Instead |
|---|---|
| `select('*')` in list endpoints | Select only displayed columns |
| Sequential `await fetch()` chains | `Promise.all([...])` |
| Fetch same data in multiple components | Single `useQuery` hook, share via cache |
| No loading state while fetching | Always show skeleton |
| Count queries 4× for stat cards | Single aggregate SQL function |
| Fetch all rows without pagination | Always use `.range()` |
| `router.push()` for navigation | `<Link>` component |
| Invalidate entire cache on mutation | Invalidate only affected query keys |
| Fetch dropdown options on every page | Prefetch once at login, cache 30 min |
| Missing DB index on `business_id` | Create index on every FK column |

---

*TAS ERP Performance Strategy | Engineering Specification | June 2026*
