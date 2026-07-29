# Security & Reliability Guardrail (Project-Wide)

This rule applies to every implementation throughout the TAS ERP project.

Security, reliability, and data integrity are mandatory acceptance criteria alongside functionality, performance, and maintainability.

Every feature must be designed assuming it will be used in a production environment by multiple companies and concurrent users.

---

## Security First

Before implementing any feature, evaluate its security implications.

Consider:

* Authentication
* Authorization
* Multi-tenant isolation
* Data exposure
* Input validation
* Output encoding
* File handling
* API security
* Database permissions
* Business logic abuse

Security must be built into the implementation—not added afterward.

---

## Multi-Tenant Protection

TAS ERP is a multi-tenant application.

Every database query, API endpoint, and business operation must ensure that one company's data can never be accessed by another company.

Verify:

* Row-Level Security (RLS)
* `business_id` filtering where applicable
* Permission checks
* Ownership validation

Never trust values supplied by the client.

Always derive sensitive identifiers from the authenticated user/session whenever possible.

---

## Authentication & Authorization

Every protected operation must verify:

* User authentication
* Active session
* Correct role
* Required permissions
* Business ownership

Do not rely on frontend checks alone.

All authorization decisions must be enforced on the backend.

---

## Input Validation

Validate every input received from:

* Forms
* APIs
* Query parameters
* URL parameters
* File uploads
* Barcode/QR scans
* Imported files

Reject invalid, malformed, or unexpected input gracefully.

Never assume client-side validation is sufficient.

---

## Sensitive Data

Never expose sensitive information unnecessarily.

Examples include:

* Internal IDs
* Secrets
* API keys
* Tokens
* Passwords
* Financial data
* Payroll information
* Supplier pricing
* Inventory valuation

Expose only the minimum information required for each operation.

---

## Barcode & QR Security

QR codes and barcodes must never contain readable business data.

Encode only secure identifiers (UUIDs or opaque tokens).

All stock information must be resolved through authenticated backend lookups.

Scanning a code outside TAS ERP should never reveal meaningful business information.

---

## Database Safety

Review every schema change for:

* Correct foreign keys
* Appropriate indexes
* Cascading behaviour
* Constraints
* Data integrity
* Transaction safety

Critical operations affecting multiple tables should use transactions where supported.

---

## Error Handling

Handle failures gracefully.

Never expose:

* Stack traces
* SQL errors
* Internal implementation details
* Server paths
* Secrets
* Debug information

Return meaningful but safe error messages.

Log detailed errors internally.

---

## Reliability

Ensure operations are resilient.

Consider:

* Retry strategies where appropriate
* Network failures
* Partial failures
* Duplicate requests
* Idempotent operations
* Concurrent users
* Race conditions

Critical workflows should leave the system in a consistent state even if an operation fails midway.

---

## Auditability

For important business actions, consider whether they should be recorded.

Examples:

* Inventory adjustments
* Billing changes
* Stock transfers
* User permission changes
* Payroll modifications
* Manufacturing updates

Maintain audit logs where appropriate to support traceability and accountability.

---

## Security Review

After completing every feature, verify:

* No unauthorized data exposure.
* No privilege escalation.
* No cross-tenant data leakage.
* No missing permission checks.
* No insecure API endpoints.
* No insecure database queries.
* No exposed secrets.
* No unsafe assumptions about client input.

Resolve all critical findings before considering the feature complete.

---

## Definition of Done (Security)

A feature is **not complete** unless:

* Authentication is enforced where required.
* Authorization is correctly implemented.
* Multi-tenant isolation is preserved.
* Input validation is complete.
* Sensitive data is protected.
* Database integrity is maintained.
* Error handling is secure.
* Reliability has been considered.
* No critical security risks remain.

Only after these checks pass may development proceed to the next task.

---

## Project Principle

Every completed phase should make TAS ERP not only more feature-rich, but also more secure, more reliable, and more trustworthy.

Security and reliability are continuous responsibilities throughout the entire development lifecycle, not final-stage activities.

---

# TAS ERP Autonomous Performance Engineering Loop

## Mission

You are authorized to autonomously profile, benchmark, optimize, and repeat this loop without asking for confirmation between iterations. Only stop if you require a product decision, an architectural trade-off, or user input that materially affects functionality.

You are the Principal Performance Engineer for TAS ERP.

Your responsibility is **not only to implement features**, but to ensure that the application remains extremely fast throughout the entire development lifecycle.

Performance is a mandatory acceptance criterion.

No task is considered complete until the application meets the defined performance targets.

---

## Critical Objective

The application currently suffers from severe performance problems.

Observed behaviour:

* Route navigation takes approximately **5–10 seconds**.
* Screen data loading takes another **5–10 seconds**.
* User experience feels slow and unresponsive.

Your primary objective is to continuously reduce these timings until they meet the required targets.

This responsibility continues throughout the entire project.

---

## Performance Targets

These targets apply to every feature.

| Metric                | Target | Ideal  |
| --------------------- | ------ | ------ |
| Route Transition      | <100ms | <50ms  |
| Screen Data Load      | <500ms | <200ms |
| API Response          | <200ms | <100ms |
| Database Query        | <100ms | <50ms  |
| Duplicate Requests    | 0      | 0      |
| Blank Loading Screens | Never  | Never  |

A feature is NOT complete unless these targets are maintained or any justified exceptions are documented.

---

## Autonomous Optimization Loop

After EVERY implementation automatically execute the following loop.

```
WHILE any performance target is not satisfied

STEP 1 — Benchmark the application.
Measure: Route transition, Screen load, API latency, Database latency,
React render duration, Bundle size, Memory usage, Network waterfall,
Number of requests.

STEP 2 — Find the SINGLE largest bottleneck.
Never optimize multiple unrelated problems simultaneously.

STEP 3 — Explain: Why this bottleneck exists. Which file(s) cause it.
Why fixing it will improve performance.

STEP 4 — Implement ONLY the smallest safe optimization.
Avoid unnecessary rewrites.

STEP 5 — Benchmark again. Collect the exact same metrics.

STEP 6 — Compare: Before vs After.

STEP 7 — If measurable improvement occurred, accept the optimization
and move to the next bottleneck. Else revert if appropriate and choose
another optimization strategy.

Repeat.
```

This loop continues until every performance target is achieved or no further meaningful improvements remain.

---

## Performance Investigation Priority

Always investigate in the following order unless measurements clearly indicate otherwise.

### 1. Database

Check: Missing indexes, Slow filters, Slow joins, N+1 queries, Large scans, Missing pagination, SELECT *, Excessive columns.

### 2. Backend APIs

Check: Duplicate requests, Sequential requests, Large payloads, Slow endpoints, Missing batching, Missing compression.

### 3. React Rendering

Check: Unnecessary re-renders, Large Context updates, Heavy components, Large lists, Missing virtualization, Missing memoization, Expensive calculations.

### 4. Client Data Layer

Check: Missing cache, Missing prefetching, Duplicate fetching, Cache invalidation, Background refetching.

### 5. Bundle

Check: Large dependencies, Unused packages, Missing lazy loading, Missing code splitting, Large images.

### 6. User Experience

Check: Skeleton loaders, Progressive rendering, Optimistic updates, Background loading.

---

## Mandatory Optimizations

Continuously look for opportunities to implement:

✓ Query optimization ✓ Database indexing ✓ Promise.all() ✓ Request batching ✓ Response compression ✓ React.memo where measured ✓ useMemo where beneficial ✓ useCallback where beneficial ✓ Route prefetching ✓ Data prefetching ✓ TanStack Query caching ✓ Lazy loading ✓ Code splitting ✓ Image optimization ✓ Virtualized tables ✓ Progressive rendering ✓ Skeleton loaders

---

## Things You Must Prevent

Never allow:

❌ Sequential API requests when they can be parallelized.
❌ Fetching entire tables.
❌ Large JSON payloads.
❌ Duplicate requests.
❌ Missing pagination.
❌ Missing indexes.
❌ Excessive React renders.
❌ Huge Context Providers.
❌ Heavy synchronous calculations.
❌ Rendering thousands of rows.
❌ Loading unnecessary assets.
❌ Blocking navigation.

---

## Continuous Validation

This loop must automatically execute after: Every new screen, Every component, Every API, Every database migration, Every query modification, Every route, Every optimization, Every phase.

Never wait until project completion.

---

## Regression Policy

If a new feature causes: Slower navigation, Slower loading, More API calls, Larger bundle, Higher memory, or Slower SQL:

Immediately pause feature development. Identify the regression. Optimize. Benchmark again. Only continue when the regression is eliminated or documented.

---

## Reporting Format

For every optimization iteration produce:

* Iteration number
* Current Bottleneck
* Root Cause
* Files Modified
* Measurements Before (Navigation, Screen Load, API, SQL, Render Time)
* Optimization Applied
* Measurements After (Navigation, Screen Load, API, SQL, Render Time)
* Improvement
* Remaining Bottleneck
* Decision: Continue Optimization Loop or Complete.

---

## Completion Rule

Never stop after one optimization. Continue optimizing until:

✓ Navigation meets target.
✓ Loading meets target.
✓ APIs meet target.
✓ SQL meets target.
✓ No major bottlenecks remain.

Only then is the implementation considered complete.

Performance optimization is a permanent responsibility and must execute automatically after every feature throughout the entire TAS ERP project.

---

# TAS ERP — UI, Dark Mode & Component Standards
**Permanent rules for every new screen, module, component, and modal.**
These are non-negotiable. A screen is not complete unless every rule below is satisfied.

---

## Rule 1 — ZERO Hardcoded Colors (Dark Mode Compatibility)

**Never write a hardcoded color anywhere in a component or page.**

Every color — background, text, border, icon fill — must come from a CSS variable defined in `globals.css`.

### Forbidden patterns (will break dark mode):
```tsx
// ❌ NEVER DO THIS
className="bg-white text-black border-gray-200"
className="bg-[#F9FAFB] text-[#0F172A]"
className="bg-gray-50 text-slate-900"
style={{ background: '#FFFFFF', color: '#000000' }}
```

### Required pattern — always use CSS variables:
```tsx
// ✅ ALWAYS DO THIS
className="bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border)]"
className="bg-[var(--page-bg)] text-[var(--text-body)]"
```

### Complete color token reference — use these exclusively:

| Purpose | CSS Variable | Light value | Dark value |
|---|---|---|---|
| Page background | `var(--page-bg)` | `#F1F5F9` | `#0F172A` |
| Card / panel background | `var(--card-bg)` | `#FFFFFF` | `#1E293B` |
| Table header background | `var(--table-header-bg)` | `#F9FAFB` | `#1E293B` |
| Table row hover | `var(--table-row-hover)` | `#F8FAFC` | `#263449` |
| Primary border | `var(--border)` | `#E5E7EB` | `#334155` |
| Light border | `var(--border-light)` | `#F3F4F6` | `#1E293B` |
| **Heading / primary text** | `var(--text-primary)` | `#0F172A` | `#F8FAFC` |
| **Secondary text** | `var(--text-secondary)` | `#1E293B` | `#E2E8F0` |
| **Body text** | `var(--text-body)` | `#374151` | `#CBD5E1` |
| **Muted / label text** | `var(--text-muted)` | `#64748B` | `#94A3B8` |
| **Faint / placeholder text** | `var(--text-faint)` | `#94A3B8` | `#475569` |
| Input background | `var(--input-bg)` | `#FFFFFF` | `#1E293B` |
| Input border | `var(--input-border)` | `#D1D5DB` | `#334155` |
| Input focus ring | `var(--input-focus)` | `#6366F1` | `#818CF8` |
| Brand primary | `var(--primary)` | `#6366F1` | `#818CF8` |
| Brand primary dark | `var(--primary-dark)` | `#4F46E5` | `#6366F1` |
| Brand primary light | `var(--primary-light)` | `#EEF2FF` | `#1E1B4B` |
| Shadow small | `var(--shadow-sm)` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` |
| Shadow medium | `var(--shadow-md)` | `0 4px 6px rgba(0,0,0,0.07)` | `0 4px 6px rgba(0,0,0,0.4)` |
| Modal backdrop | `var(--modal-backdrop)` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` |
| Modal shadow | `var(--modal-shadow)` | `0 20px 60px rgba(0,0,0,0.15)` | `0 20px 60px rgba(0,0,0,0.5)` |
| Skeleton base | `var(--skeleton-base)` | `#E5E7EB` | `#1E293B` |
| Skeleton shine | `var(--skeleton-shine)` | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.06)` |

### Intentional exceptions (document these explicitly):
- **Print pages** (`/print`): `bg-white text-black` is correct — print always renders on white paper
- **Auth pages** (`/login`, `/register`, `/forgot-password`): hardcoded light bg acceptable — these appear before theme is resolved
- **Scan overlay**: always dark by nature, `bg-black/50` is correct

---

## Rule 2 — Every Form Input Must Be Dark-Mode Ready

Every `<input>`, `<select>`, `<textarea>` must include ALL of these classes:

```tsx
className="
  bg-[var(--input-bg)]
  border border-[var(--input-border)]
  text-[var(--text-primary)]
  placeholder:text-[var(--text-faint)]
  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
  rounded-lg px-3 h-10 text-sm
  transition-colors
"
```

Missing any one of these = the input will look broken in dark mode (white text on white background, or invisible placeholder, or wrong focus ring color).

---

## Rule 3 — Font / Text Color Pairing Rules

Never pick a text color without thinking about the background it sits on.

| Content type | Use this token | Never use |
|---|---|---|
| Page headings, modal titles | `text-[var(--text-primary)]` | `text-[#0F172A]`, `text-black`, `text-slate-900` |
| Section labels, card subtitles | `text-[var(--text-secondary)]` | `text-[#1E293B]`, `text-slate-800` |
| Body paragraphs, table cell values | `text-[var(--text-body)]` | `text-[#374151]`, `text-gray-700` |
| Helper text, column headers, form labels | `text-[var(--text-muted)]` | `text-[#64748B]`, `text-slate-500` |
| Placeholders, disabled text, timestamps | `text-[var(--text-faint)]` | `text-[#94A3B8]`, `text-gray-400` |
| Error messages | `text-red-500` (same both themes — OK) | any hardcoded hex |
| Success messages | `text-green-600` (same both themes — OK) | any hardcoded hex |
| Brand/primary actions | `text-[var(--primary)]` | `text-[#6366F1]` hardcoded |

### Badge / status colors — these are intentional and exempt:
Badge backgrounds and text (green/red/orange/blue/purple) are intentional semantic colors and defined as CSS variable pairs (e.g. `--badge-green-bg` / `--badge-green-text`). Always use the variable, never the raw hex.

---

## Rule 4 — Every Data-Fetching Page Uses PageState

No page may manage loading/error/empty state with raw `useState` flags. Always use the shared `PageState` component from `@/components/shared/PageState`.

```tsx
// ❌ NEVER DO THIS
const [loading, setLoading] = useState(true)
if (loading) return <div>Loading...</div>
if (error) return <div>Error</div>
if (data.length === 0) return <div>No data</div>

// ✅ ALWAYS DO THIS
const { data, isLoading, error, refetch } = useMyListQuery(filters)

return (
  <PageState
    isLoading={isLoading}
    isError={!!error}
    error={error?.message}
    onRetry={refetch}
    isEmpty={data?.length === 0}
    skeletonVariant="table"
    skeletonRows={8}
    skeletonColumns={5}
    emptyTitle="No [items] yet"
    emptyDescription="[Specific, helpful description]"
    emptyAction={<AsyncButton onClick={handleAdd}>+ Add First [Item]</AsyncButton>}
  >
    <MyTable data={data!} />
  </PageState>
)
```

### PageState Skeleton Variants — match to actual content shape:
| Page type | skeletonVariant | skeletonRows / skeletonCount |
|---|---|---|
| List with table | `"table"` | rows = actual table rows shown, columns = exact column count |
| Stat cards row | `"stats"` | count = exact number of stat cards |
| Detail / edit form | `"form"` | default |
| Card grid | `"card"` | count = cards in grid |
| Chart | `"chart"` | default |

---

## Rule 5 — Every API Call Uses TanStack Query

Never use raw `fetch` inside `useEffect`. Every data fetch must go through a TanStack Query hook.

```tsx
// ❌ NEVER DO THIS
useEffect(() => {
  fetch('/api/something').then(r => r.json()).then(setData)
}, [])

// ✅ ALWAYS DO THIS
// 1. Create a query hook in src/hooks/queries/
export function useMyData(filters: MyFilters) {
  return useQuery({
    queryKey: ['my-domain', 'list', filters],
    queryFn: () => fetch(`/api/my-route?${new URLSearchParams(filters as any)}`).then(r => r.json()),
    staleTime: 30_000,
  })
}

// 2. Use it in the page component
const { data, isLoading, error, refetch } = useMyData(filters)
```

### Query key conventions:
```ts
queryKey: ['domain', 'list', filters]         // for list pages
queryKey: ['domain', 'detail', id]            // for detail/edit pages
queryKey: ['domain', 'stats']                 // for stat cards
queryKey: ['settings', 'general']             // for settings pages
```

### Mutations — always invalidate on success:
```tsx
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: (payload) => fetch('/api/...', { method: 'POST', body: JSON.stringify(payload) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['domain'] })
    toast.success('Saved successfully')
  }
})
```

---

## Rule 6 — Every Async Button Uses AsyncButton

No raw `<button>` may have an `async onClick` or manage its own loading state.

```tsx
// ❌ NEVER DO THIS
const [saving, setSaving] = useState(false)
<button onClick={async () => { setSaving(true); await save(); setSaving(false) }}>
  {saving ? 'Saving...' : 'Save'}
</button>

// ✅ ALWAYS DO THIS
import AsyncButton from '@/components/shared/AsyncButton'
<AsyncButton onClick={save} variant="primary">Save</AsyncButton>
```

### AsyncButton variants:
- `variant="primary"` — brand purple, white text (default for main actions)
- `variant="outline"` — bordered, transparent bg (secondary actions)
- `variant="destructive"` — red bg, white text (delete/dangerous actions)

---

## Rule 7 — Every Modal Uses the Shared Modal Component

Never build a one-off modal with a raw `<div>` overlay or an unmapped shadcn `<Dialog>`.

```tsx
// ❌ NEVER DO THIS
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="bg-white"> {/* hardcoded — breaks dark mode */}
    ...
  </DialogContent>
</Dialog>

// Also ❌ NEVER DO THIS
{open && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white rounded-xl p-6"> {/* hardcoded */}
      ...
    </div>
  </div>
)}

// ✅ ALWAYS DO THIS
import { Modal } from '@/components/shared/Modal'

<Modal open={open} onOpenChange={setOpen} title="Modal Title" maxWidth="max-w-lg">
  {/* Your form/content here — the chrome is fully theme-aware */}
</Modal>
```

The shared `Modal` component handles:
- `bg-[var(--card-bg)]` automatically
- `border-[var(--border)]` automatically  
- Premium motion entrance animation automatically
- Backdrop `rgba(0,0,0,var(--modal-backdrop))` automatically
- ESC to close, click-outside to close, focus-trap

---

## Rule 8 — Every New Route Gets a ROUTE_METADATA Entry

Every new page added to the app needs a breadcrumb/metadata entry in `Header.tsx`'s `ROUTE_METADATA` map. Without this, the breadcrumb shows a broken or empty path.

```tsx
// In src/components/layout/Header.tsx — ROUTE_METADATA object:
'/my-new-route': { title: 'My New Page', parent: '/parent-route' },
'/my-new-route/[id]': { title: 'Detail', parent: '/my-new-route' },
'/my-new-route/new': { title: 'Add New', parent: '/my-new-route' },
```

---

## Rule 9 — Recharts Charts Must Use useChartTheme Hook

Recharts SVG attributes (`stroke`, `fill`) cannot read CSS variables automatically. Every chart must use the `useChartTheme()` hook from `src/hooks/useChartTheme.ts`:

```tsx
import { useChartTheme } from '@/hooks/useChartTheme'

export function MyChart({ data }) {
  const chartTheme = useChartTheme()

  return (
    <LineChart data={data}>
      <CartesianGrid stroke={chartTheme.grid} />
      <XAxis tick={{ fill: chartTheme.axisText }} />
      <YAxis tick={{ fill: chartTheme.axisText }} />
      <Tooltip
        contentStyle={{
          background: chartTheme.tooltipBg,
          border: `1px solid ${chartTheme.tooltipBorder}`,
          color: chartTheme.text,
        }}
      />
    </LineChart>
  )
}
```

Never hardcode `stroke="#E5E7EB"` or `fill="#64748B"` in any chart — these become invisible in dark mode.

---

## Rule 10 — New Screens: Pre-Implementation Checklist

Before writing a single line of code for any new screen or module, confirm:

1. **Does the page fetch data?** → Plan which TanStack Query hook you'll create
2. **What does the skeleton look like?** → Choose `skeletonVariant` and exact `rows`/`columns` to match real content
3. **What is the empty state?** → Write `emptyTitle`, `emptyDescription`, and `emptyAction` CTA
4. **What are the async actions?** → Every save/delete/submit → `AsyncButton`
5. **Does the page have modals?** → Plan to use shared `Modal` wrapper from the start
6. **Are there charts?** → Plan to use `useChartTheme()`
7. **Does the route need breadcrumbs?** → Add to `ROUTE_METADATA` before or when adding the page

---

## Rule 11 — Definition of Done for Every New Screen

A screen is **not complete** unless ALL of the following pass:

### UX State
- [ ] All data fetching uses TanStack `useQuery` — zero raw `useEffect` fetches
- [ ] All data-dependent sections wrapped in `PageState`
- [ ] Skeleton variant matches real content shape (correct rows/columns/count)
- [ ] Empty state has title, description, and CTA where applicable
- [ ] Error state has retry button wired to `refetch`

### Dark Mode
- [ ] Zero `bg-white` in the file (except documented print/auth exceptions)
- [ ] Zero hardcoded hex color in any `text-`, `bg-`, `border-` className
- [ ] All inputs use the 5-class dark mode input pattern (Rule 2)
- [ ] Page **visually inspected** in both light AND dark mode before marking done
- [ ] If page has charts → `useChartTheme()` applied to all Recharts attributes
- [ ] If page has modals → shared `Modal` component used, not bare shadcn Dialog

### Components
- [ ] All async actions use `AsyncButton`
- [ ] All modals use `Modal` from `@/components/shared/Modal`
- [ ] New route added to `ROUTE_METADATA` in `Header.tsx`

### Performance
- [ ] No sequential `await` chains in API routes (use `Promise.all` where possible)
- [ ] No raw DB queries without pagination on list endpoints
- [ ] TanStack query key follows naming conventions
- [ ] `staleTime` set appropriately for the data type

### Before PR
- Run this grep — must return zero results for the new files:
  ```powershell
  Select-String -Pattern "bg-white|text-black|bg-gray-|text-gray-9" -Path [your-new-file]
  ```

---

## Rule 12 — Never Regress These

These rules were established after finding real bugs. Do not reintroduce them:

| Bug | Root Cause | Rule that prevents it |
|---|---|---|
| Modal white background in dark mode | `bg-white` on modal container | Rule 1 + Rule 7 |
| Skeleton bright white flash in dark | `rgba(255,255,255,0.6)` shine gradient | Rule 1 (use `--skeleton-shine`) |
| Invisible input placeholder in dark | No `placeholder:text-[var(--text-faint)]` | Rule 2 |
| Missing loading state on new page | Raw `useState(true)` instead of PageState | Rule 4 |
| No cache — every nav hits network | Raw `useEffect` fetch | Rule 5 |
| Loading spinner with no skeleton layout | PageState without `skeletonVariant` | Rule 4 |
| Chart grid invisible in dark | Hardcoded `stroke="#E5E7EB"` | Rule 9 |
| Broken breadcrumb on new route | Missing `ROUTE_METADATA` entry | Rule 8 |

---

## RLS Policy Standard

All Row-Level Security policies must use the `auth_business_id()` STABLE function, NOT an inline subquery:

```sql
-- ✅ CORRECT (use this for every new table)
CREATE POLICY "tenant_isolation" ON my_new_table
  FOR ALL USING (business_id = auth_business_id());

-- ❌ NEVER DO THIS (inline subquery re-runs per row)
CREATE POLICY "tenant_isolation" ON my_new_table
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
```

The `auth_business_id()` function is defined in migration `20260727110000_rls_stable_function.sql`. Use it on every new table that has a `business_id` column.

---

## API Route Standard

Every new API route handler must:

1. Call `getSessionBusinessId()` first — stop immediately if null
2. Use `auth_business_id()` in RLS (automatic via the Supabase client + RLS)
3. Use `Promise.all()` for parallel fetches — never sequential `await` chains for unrelated queries
4. Never expose internal error details — log internally, return safe message
5. Return proper HTTP status codes (401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict)

```ts
// ✅ Standard API route pattern:
export async function GET(request: Request) {
  const supabase = createClient()
  const businessId = await getSessionBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [listResult, statsResult] = await Promise.all([
      supabase.from('my_table').select('*').eq('business_id', businessId),
      supabase.from('my_stats').select('count').eq('business_id', businessId),
    ])

    if (listResult.error) throw listResult.error

    return NextResponse.json({ items: listResult.data, stats: statsResult.data })
  } catch (err: any) {
    console.error('GET /api/my-route error:', err)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
```
