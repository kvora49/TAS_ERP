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
