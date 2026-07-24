# TAS ERP — P2: Rollout
Once the Sales Bills reference module (P1 #13) and the core framework pieces (`useERPQuery`, skeletons, motion) are proven, this is where they get applied everywhere else. Nothing here should start before P1 is far enough along to have a working pattern to copy — building this in parallel with an unfinished reference module means guessing at the pattern twice.

---

## Framework Architecture Map — reference

**P0 and P1 are implemented.** This map is kept here rather than in P1 because P2 is where the map now matters day to day — it's the reference every rollout item below points back to when applying the already-built pattern to a new module. The original layered vision — `Experience Framework → UI Framework → Business Framework → ERP Modules`, and the 8 "engines" (Loading, Navigation, Animation, Feedback, Motion, Progressive Rendering, Page Skeleton System, Async Button System) — didn't get dropped during the audit-merging process; it got decomposed into P1's numbered items, which is easy to lose track of after several rounds of consolidation:

| Original layer / engine | Where it was built (P1) | Where it's used now (P2) |
|---|---|---|
| **Experience Framework** | P1 items 8–12, 18 | Consumed by every migrated page in item 19, plus new items **44–46** below addressing raw speed directly |
| — Loading Engine | P1 item 9 (`useERPQuery`'s pending state) + item 10 (skeleton components) — always one system, not two; "Loading Engine" and "Page Skeleton System" are the same thing viewed from two ends | Item 19 |
| — Raw speed (not originally named as an engine, but the actual cause of multi-second waits) | Not built in P1 — identified early in the audit, dropped during consolidation, added directly to P2 as items **44–46** since P1 is already closed | Items 44 (double auth-session fetch), 45 (sequential-to-parallel API calls), 46 (dev-vs-production compilation check) — these solve *why it's slow*; P1 items 9-11 solve *how it feels while it's loading*. Both halves are needed — skeletons alone don't fix a genuinely slow backend, they just make the wait less frustrating |
| — Progressive Rendering | P1 item 10 (skeletons per section) | Item 20 — component breakup enables independent section loading once pages aren't monolithic |
| — Page Skeleton System | P1 item 10 | Item 19 |
| — Navigation Engine | P1 item 11 (Sidebar prefetch extension + route-level `loading.tsx`) | Item 20.12 (Sidebar split completes the config-driven nav this depends on) |
| — Animation Engine / Motion Engine | P1 item 12 — these two names were the same concept duplicated in the original ask, merged into one | Item 20 (wizard step transitions, dialog animations become straightforward once components are split) |
| — Feedback Engine / Async Button System | P1 item 9 (`useERPMutation`'s pending/disabled/toast handling) — also the same concept from two ends, a button's state *is* the mutation's state | Item 19 |
| **UI Framework** | Already existed (shadcn/Radix primitives, `DataTable`, `TableSkeleton`, `ConfirmDialog`, `EmptyState`) — the best-built layer per earlier audit rounds. P1 item 10 extended it with missing skeleton shapes; item 18 fixed `useFileUpload`'s fake progress | Item 23 (accessibility pass) extends this layer further |
| **Business Framework** | P1 items 13, 16–17 — repository + service layer, proven on Sales Bills | Item 22 — rolled out to every remaining module |
| **ERP Modules** | N/A — this is the layer built *on top of* everything above | Items 19–20 — the actual module-by-module migration onto the now-proven foundation; this is the bulk of P2 |

**Why it was scoped as 4 real pieces instead of 8 separate "engines":** several of the original 8 were the same underlying problem described twice (Loading Engine/Page Skeleton System; Animation Engine/Motion Engine; Feedback Engine/Async Button System). Building them as 8 literally separate systems would have meant two systems fighting each other for the same concern. Collapsing to the query/mutation hook, skeletons, navigation prefetch, and motion — plus the repository/service layer — kept the same coverage with less duplication, and it's that collapsed set that's now being rolled out below.

---

## Two distinct delays, two distinct causes — read this before items 44-46

"5-10 seconds to switch pages" and "5-10 seconds to load the data" are being treated as one symptom, but they likely have **different root causes**, and the fix for one won't necessarily fix the other:

- **The switch itself (before anything renders)** — for a client-side navigation in Next.js App Router, this should normally be near-instant, since it's just fetching the target page's JS bundle and mounting an (initially empty) component. If this phase alone is taking 5-10 seconds, the most likely explanations are (a) the target page's JS bundle is very large and slow to parse/execute — directly connects to the god-component files (some 1,700-2,300+ lines) still being split per item 20 — or (b) **you're testing against the Next.js dev server, not a production build** — see item 46 below, this is a very common false alarm.
- **The data appearing after the page has rendered** — this is what items 44 and 45 actually address: the double auth-session round-trip and the sequential (not parallelized) Supabase queries inside the API routes each page calls.

Don't assume both delays share one fix. Confirm which phase is actually slow (does the page shell appear quickly with a blank/skeleton area, and *then* a further wait for data — or is the whole screen frozen/blank for the full 5-10 seconds before anything at all appears) before prioritizing between items 44-46 below.

---

## 44. Fix the double/triple auth-session fetch — addresses the data-loading half of the delay

**Problem**
`middleware.ts` calls `supabase.auth.getSession()` on **every single request** to any route — every page navigation, every API call. Separately, `getSessionBusinessId()` in `lib/supabase/server.ts` (called inside nearly every API route handler) calls `auth.getSession()` **again**, completely independently of what middleware already resolved. Each of these is a real network round-trip to Supabase's auth server, not a local/cached check — typically 200-800ms depending on network conditions. Two of these happening serially before your actual data query even begins adds up to a real, measurable delay on every single page load and every single API call a page makes — and if a page makes multiple API calls (very common, since pages routinely fire 2-7+ fetches per load per earlier findings), this cost is paid multiple times over for one page view.

There is a `businessIdCache = new Map<string, string>()` in `server.ts` intended to help with this, but it's a plain in-memory `Map` inside a serverless/edge function file — depending on your deployment runtime, this may not reliably persist between invocations, giving a false sense of caching without actually preventing the repeated `getSession()` calls.

**Solution**
1. Resolve the session **once**, in `middleware.ts`, and forward the resolved `user_id`/`business_id` downstream via request headers, which any API route can read without hitting Supabase Auth again:
   ```ts
   // middleware.ts
   const { data: { session } } = await supabase.auth.getSession();
   if (session) {
     const requestHeaders = new Headers(request.headers);
     requestHeaders.set("x-user-id", session.user.id);
     requestHeaders.set("x-business-id", await resolveBusinessId(session.user.id)); // resolved once here
     return NextResponse.next({ request: { headers: requestHeaders } });
   }
   ```
2. Update `getSessionBusinessId()` (or replace it) to read `x-business-id` from the incoming request headers instead of calling `auth.getSession()` again:
   ```ts
   // lib/supabase/server.ts
   export function getBusinessIdFromHeaders(request: Request) {
     const businessId = request.headers.get("x-business-id");
     if (!businessId) throw new Error("Missing business context — request did not pass through middleware");
     return businessId;
   }
   ```
3. Remove the in-memory `Map` cache entirely — it's no longer needed once the header-forwarding pattern replaces the repeated lookup, and it was giving a misleading impression of caching that may not have actually been working depending on runtime.
4. Small, isolated change (touches `middleware.ts` and `lib/supabase/server.ts`, plus a one-line swap in every route currently calling `getSessionBusinessId()`) with a large payoff — do this early in P2, ideally before or alongside item 19, since it benefits every single request regardless of whether that page has been migrated to `useERPQuery` yet.

---

## 45. Parallelize sequential API calls — the other half of the data-loading delay, and directly what you asked about ("parallel fetching")

**Problem**
Verified directly in `sales/bills/[id]/route.ts`'s GET handler: `auth.getUser()` → `users.role` lookup → `sale_bills` fetch (+joins) → conditionally `bill_profit` → conditionally `brands` → conditionally `brand_bill_config` — each one `await`-ed one after another, even though several of these queries don't depend on each other's results. Other routes were found doing up to 22 sequential `await supabase` calls in a single request. If each round-trip takes 200-500ms (typical for a Supabase query over the network, more if the missing indexes from P1 item 14 haven't been added yet), **8-22 of them run one after another instead of together** — this alone can easily account for 2-10 seconds on a single page load, and it happens on every visit to any page following this pattern, since (per item 44 above and the lack of caching on non-migrated pages) there's currently nothing preventing it from running fresh every time.

**Solution**
Identify which of the sequential calls in a given route are genuinely independent (don't need each other's results) versus genuinely dependent (need a previous result to know what to fetch next), and run the independent ones together with `Promise.all`:
```ts
// Before — sequential, ~5 round-trips paid one after another
const { data: { user } } = await supabase.auth.getUser();
const { data: userRow } = await supabase.from("users").select("role").eq("id", user.id).single();
const { data: bill } = await supabase.from("sale_bills").select("*, items:sale_bill_items(*)").eq("id", billId).single();
const { data: profit } = await supabase.from("bill_profit").select("*").eq("bill_id", billId).maybeSingle();
const { data: brand } = await supabase.from("brands").select("*").eq("id", bill.brand_id).single();

// After — the two calls that don't depend on each other's results run together
const { data: { user } } = await supabase.auth.getUser();
const [{ data: userRow }, { data: bill }] = await Promise.all([
  supabase.from("users").select("role").eq("id", user.id).single(),
  supabase.from("sale_bills").select("*, items:sale_bill_items(*)").eq("id", billId).single(),
]);
// profit and brand both depend on `bill` existing (need bill.brand_id), but not on each other — parallelize these two too, once `bill` is available
const [{ data: profit }, { data: brand }] = await Promise.all([
  supabase.from("bill_profit").select("*").eq("bill_id", billId).maybeSingle(),
  supabase.from("brands").select("*").eq("id", bill.brand_id).single(),
]);
```
This turns "5 round-trips paid serially" into roughly "2-3 batches of round-trips paid in parallel" — a route with 5 sequential calls at 300ms each (1.5s total) becomes 2 parallel batches at roughly 300-400ms each (under 1s total), and the effect compounds further on the routes with 8-22 sequential calls.

**Do this as part of the same pass as item 13 (Sales Bills repository/service layer)** — the service layer is exactly the right place to own which queries can run in parallel versus which have real dependencies, so this isn't a separate sweep, it's a property of how each service method is written. Apply the same audit-and-parallelize pass to any other route with more than 3-4 sequential `await supabase` calls as you migrate each module in items 19 and 22.

---

## 46. Confirm you're measuring a production build, not the dev server — addresses the page-switch half of the delay

**Problem**
This wasn't checked anywhere in the audit so far, and it's a very common false alarm for exactly this symptom: **Next.js's development server (`next dev`) compiles each route on demand, the first time it's visited in a session** — this is a real, well-known Next.js behavior, not a bug in this codebase specifically. For a large page component (and several here are 1,000-2,300+ lines, per P2 item 20), that on-demand compilation alone can easily take several seconds — and it would look exactly like "clicking a link takes 5-10 seconds," completely independent of anything in items 44-45, because it happens *before* any of your application code (including the slow auth/data-fetching path) even starts running.

**Confirmed: this project deploys to Vercel + Supabase.** Since Vercel builds the app ahead of time in production mode, dev-server on-demand compilation is ruled out for the deployed app — if the delay is being observed on the live Vercel deployment (not `localhost`), this specific cause doesn't apply, and items 44/45 (data-loading speed) are the more likely explanation.

**New, Vercel+Supabase-specific check: region alignment.** If Vercel's function region and Supabase's project region don't match, every database round-trip pays extra cross-region network latency — often 100-300ms+ per call instead of 20-50ms for a same-region call. Since items 44/45 already establish a single page can trigger 2 (auth) + up to 22 (data) round-trips, a region mismatch multiplies against every one of them rather than just adding a flat delay once, and could account for a large share of the 5-10 seconds by itself.

**Solution**
1. If still testing locally, confirm `npm run dev` vs. a production build (`npm run build && npm run start`) before concluding items 44-45 haven't helped.
2. **Check Vercel project settings → Functions region, against Supabase project → Settings → General → Region.** Align both to the same region, ideally close to your actual users (e.g., an India-based user base should have both in an `ap-south-1`-equivalent region, not a US default). This is a configuration change, not a code change — cheap to check and cheap to fix if mismatched.
3. Do both checks before concluding items 44/45 need further work — a region mismatch can make an already-slow sequential-query pattern look far worse than the code alone would explain, and fixing the region without also fixing items 44/45 will still leave real latency from the double-auth-check and unparallelized queries.

---

## 19. Migrate remaining ~60 raw-`useEffect` pages onto `useERPQuery()`

**Problem**
Of 88 dashboard pages, 60 currently use raw `useState` + `useEffect` + `fetch` instead of TanStack Query — re-fetching from scratch on every visit, with no caching, no request cancellation, and inconsistent loading states. `raw-materials/page.tsx` is a fully verified example: 478 lines, zero `useQuery`, exactly 3 direct `fetch()` calls (GET list, POST/PUT save, DELETE), a zod schema embedded directly in the page file instead of a shared location, and hardcoded `CATEGORIES`/`UNITS` arrays. This exact shape — full CRUD implemented inline in the page component — is expected to repeat nearly identically across Parties, Designs, Godowns, Brands, Workers, Banks, GST rates, and Units, since they're all the same kind of master-data CRUD screen.

**Solution**
Migrate module by module rather than page by page, since sibling pages in the same module usually share the same API shape and can be converted together efficiently:
1. Move the module's zod schema into `schemas/<module>.schema.ts` if not already done as part of P0 #4.
2. Replace direct `fetch()` calls with `useERPQuery`/`useERPMutation` from P1 #9.
3. Replace the manual `loading`/`setLoading` state with the hook's built-in pending state, wired to the matching skeleton from P1 #10.
4. Suggested order: Raw Materials → Brands → Parties → Godowns → Workers → Designs → the remaining master-data screens, since these are the most structurally similar to each other and will surface any gaps in the shared pattern early, before you hit more complex modules like Purchases or Production.

---

## 20. Break up the god-components — file-by-file plan

**Problem**
Two overlapping groups of oversized files:
- **12 files flagged as clearly oversized** (800–2,300 lines).
- **Confirmation this isn't limited to the extreme outliers** — `raw-materials/page.tsx` at "only" 478 lines shows the identical pattern (all CRUD concerns in one file), meaning the root cause is systemic to how CRUD pages are built in this codebase, not a handful of unusually large files.
- `Sidebar.tsx` (590 lines) is a related but distinct case — not a CRUD page, but independently accumulated navigation, auth, toast, and cache-invalidation responsibilities (extraction already scoped in P1 #17).

**This item previously only gave a worked example for `Sidebar.tsx`, which is why it got picked up in isolation instead of applied to the other 11 files.** Below is the same level of detail for every one of the 12 files, grounded in the actual internal structure of each (verified directly from the code — section comments, step markers, and tab state already present), so each one can be picked up and executed independently.

---

### 20.1 — `production/lots/new/page.tsx` (2,319 lines) — the largest file in the app
Already structured internally as a 7-step wizard (`currentStep` state, each step explicitly commented `STEP 1` through `STEP 7`). Split along those exact existing boundaries — the easiest split in the whole list, since the seams are already marked in the code:
```
production/lots/new/
  page.tsx                      (orchestrator: currentStep state, step nav, final submit — target ~150-200 lines)
  steps/
    Step1RollAllocation.tsx     (currently ~lines 89-115 logic + ~824-958 JSX)
    Step2BasicDetails.tsx       (~116-137 logic + ~959-1169 JSX)
    Step3LotSpecifications.tsx  (~138-145 logic + ~1170-1319 JSX)
    Step4SizeSetQuantities.tsx  (~146-155 logic + ~1320-1525 JSX)
    Step5AssignStages.tsx       (~156-161 logic + ~1526-1730 JSX)
    Step6DesignSpecSheet.tsx    (~162+ logic + ~1731-1800 JSX)
    Step7ReviewCreate.tsx       (~1801+ JSX, final review/submit screen)
  useLotWizard.ts                (shared state/mutation hook consumed by page.tsx and passed to steps as props)
```
Each step receives its slice of form state and a setter via props from `page.tsx` (or a small context if prop-drilling gets unwieldy) — steps shouldn't independently fetch/manage global lot state.

### 20.2 — `sales/bills/new/page.tsx` (1,879) and `sales/bills/[id]/edit/page.tsx` (1,712)
Already fully scoped in **P1 item #13** — `CustomerSection`, `ItemsTable`, `PaymentSection`, `TotalsPanel`, `TaxCalculator`, `BillValidation`, unified into one `SalesBillEditor` with `mode="create"|"edit"`. Treat P1 #13 as authoritative for these two files — it also covers the backend transaction/calculation-duplication fixes that need to happen alongside the split.

### 20.3 — `components/forms/PurchaseForm.tsx` (1,615 lines)
Verified structure: inline "Material Type" creation modal (~397), inline "Supplier" creation modal (~407), due-date auto-calculation (~589), item-field autofill on material-type change (~609), per-line recalculation (~675-737), grand-total computation (~738) — structurally the same shape as a sales bill (party section + line items + totals) for the purchase side:
```
PurchaseForm/
  PurchaseForm.tsx            (orchestrator, ~150-200 lines)
  SupplierSection.tsx         (supplier selection + inline "create new supplier" modal, ~407+)
  MaterialItemsTable.tsx      (line items, autofill, per-line recalculation, ~609-737)
  InlineMaterialTypeModal.tsx (~397+)
  PaymentTermsSection.tsx     (invoice date, terms, auto-due-date, ~589)
  TotalsPanel.tsx             (~738)
  purchase.calculations.ts     (recalculation functions as pure functions, shared with the future service layer in item #22)
```

### 20.4 — `sales/bills/[id]/page.tsx` (1,105 lines) — bill detail/view
Distinct from create/edit (only 3 `useState`, 2 `fetch` calls per P1 #13's table) — its size is from rendering read-only detail, not complex state. Split by rendered section:
```
sales/bills/[id]/
  page.tsx              (data fetch via useERPQuery + composition, ~150 lines)
  BillHeaderCard.tsx     (bill number, date, status, party info)
  BillItemsView.tsx      (read-only line items table)
  BillTotalsCard.tsx     (tax breakdown, grand total)
  BillPaymentHistory.tsx (linked payments/cheques)
  BillActionsBar.tsx     (edit/print/delete/status-change buttons)
```

### 20.5 — `master-data/designs/page.tsx` (997 lines)
Verified structure: a "sub-colour" modal schema (~24), a Design form schema (~33), an "editor screen toggle" (~104, meaning this page switches between list and inline editor rather than routing), a sub-modal for adding colours (~108), delete modal (~112), and the editor itself explicitly commented as "Full-page form structured as 3 white cards" (~485):
```
designs/
  page.tsx                (list view + toggle to editor, ~200 lines)
  DesignEditor.tsx         (the "3 white cards" editor screen)
  DesignColoursSection.tsx (colour swatches + sub-colour add modal, ~108-296)
  DesignDeleteDialog.tsx   (~112)
  schemas/design.schema.ts (both schemas, ~24-33)
```

### 20.6 — `master-data/brands/page.tsx` (928 lines)
Verified structure: a distinct "Bill Config Form" state block (~76) with its own reset (~195) and fetch (~209) — this page is really two features sharing one file: brand CRUD, and a separate per-brand bill-configuration form.
```
brands/
  page.tsx                    (brand list + CRUD, ~300-400 lines — same treatment as raw-materials, item #19)
  BrandBillConfigDialog.tsx    (the bill-config form, ~76-209+, fully independent component)
```
Fix by recognizing it's two features, not by inventing a complex split — the bill-config form doesn't need to know anything about the brand list beyond which brand it's configuring.

### 20.7 — `settings/communication/page.tsx` (899 lines)
Verified structure: WhatsApp template CRUD (~136), party phone-number editing with validation (~209-219), a "sandbox" test-message generator (~250) that logs to an audit trail and opens a WhatsApp deep link (~295-311), and a message preview modal (~97).
```
communication/
  page.tsx                 (tab/section composition, ~150 lines)
  TemplateManager.tsx       (template CRUD, ~136+)
  PartyPhoneEditor.tsx      (phone validation/editing, ~209-249)
  MessageSandbox.tsx        (test-send generator + audit logging + deep link, ~250-311)
  MessagePreviewModal.tsx   (~97)
```

### 20.8 — `sales/bills/[id]/print/page.tsx` (881 lines)
Print layouts are inherently long, but the earlier audit confirmed the `dangerouslySetInnerHTML` block here is static `@media print` CSS (verified clean) — length is mostly print markup, not logic. Extract by visual section:
```
print/
  page.tsx              (data fetch + assembly, ~150 lines)
  PrintHeader.tsx        (letterhead/logo)
  PrintPartyInfo.tsx     (bill-to/ship-to)
  PrintItemsTable.tsx    (line items formatted for print)
  PrintTotalsFooter.tsx  (tax breakdown, totals, signature area)
  print.styles.ts         (static print CSS, moved out of dangerouslySetInnerHTML into a constant)
```

### 20.9 — `finance/cheques/page.tsx` (854 lines)
Verified structure: explicit tab state (`activeTab === "received"` / `"issued"`, ~378-397) and three separate form-state blocks — "New Cheque" (~65), "Deposit" (~78), "Bounce" (~81) — plus aggregate stats (~117). One list view plus three action forms, all in one file.
```
cheques/
  page.tsx                 (tab switcher: received/issued + list, ~250 lines — pairs with item #19's migration and the P0 #6 atomic-balance fix)
  NewChequeDialog.tsx       (~65+)
  DepositChequeDialog.tsx  (~78+)
  BounceChequeDialog.tsx   (~81+)
  ChequeStatsBar.tsx        (~117)
```

### 20.10 — `production/lots/[id]/page.tsx` (853 lines) — lot detail
Verified structure: costing-input state (~39), "move to stock" modal (~45), a single large combined fetch (lot detail + sizes + stages + stage entries + rolls + specifications + spec sheet, ~52), godowns-list fetch for move-to-stock target (~70), "Complete Lot" mutation (~87), stage-progress mapping for `StageProgressTracker` (~211), cost-calculation logic (~233).
```
lots/[id]/
  page.tsx                   (data fetch + composition, ~200 lines)
  LotStageProgress.tsx        (StageProgressTracker mapping, ~211-225)
  LotCostingPanel.tsx         (costing inputs + calculations, ~39, 80-86, 233+)
  LotRollsSection.tsx         (rolls/specifications display)
  MoveToStockDialog.tsx       (~45, 70-79, 131+ — includes its own godowns fetch and roll-usage sync)
  CompleteLotButton.tsx       (mutation at ~87, wired through useERPMutation once available)
```

### 20.11 — `PartyForm.tsx` (992 lines)
Verified structure: a distinct "Worker fields" block (~46) with its own worker-specific stages list (~89) and worker-only defaults (~128) — this single form handles multiple party types (regular parties vs. workers, likely suppliers/customers) with conditionally-rendered sections — plus godown fetch (~177), production-stages fetch for worker options (~196), billing/shipping address sync (~215), auto-generated party code on type change (~234).
```
PartyForm/
  PartyForm.tsx            (orchestrator: party type selection + shared fields, ~200 lines)
  WorkerFieldsSection.tsx   (~46-128, only rendered when party type is "worker")
  AddressSection.tsx        (billing/shipping + same-as-billing sync, ~215)
  ContactSection.tsx        (phone/whatsapp sync, ~254)
  party.schema.ts            (validation, extracted from inline)
```

### 20.12 — `Sidebar.tsx` (590 lines)
Once P1 #17 extracts the auth/toast/cache concerns, split what remains by structure:
```
Sidebar/
  Sidebar.tsx        (~140 lines, composition only)
  SidebarGroup.tsx   (~80 lines)
  SidebarItem.tsx    (~90 lines)
  SidebarFooter.tsx  (~50 lines)
  SidebarUser.tsx    (~40 lines)
  navigation.config.ts  (nav tree moved out of the component — currently inline via `NavItem`/`NavSubItem`/`NavSubSubItem` interfaces)
```
Moving the nav tree into a config file also makes future role-based filtering (P4 #34) or a command palette (P4 #35) easier to add later, since the structure becomes data rather than JSX.

---

**Suggested order**, since each file is independent and can be worked one at a time: start with **20.1 (production lots wizard)** — its step boundaries are already the clearest, most mechanical split in the list, good for proving the "split along existing seams" approach before tackling files with less obvious structure like 20.6 or 20.7.

---

## 21. Fix `key={index}` in editable line-item tables, add debounce to search inputs

**Problem**
Two related but distinct bugs:
- **24 files use `key={index}`** as the React key for list items — this is a well-known footgun specifically in editable line-item lists (sale bill items, purchase items, production lot rolls/colourways). Symptom: delete row 2 of 5, and row 3's input values can visibly jump into row 2's slot while row 3 appears to vanish — because React matches DOM nodes by array position, not by identity, and reuses the wrong node's internal state.
- **Zero `AbortController` usage anywhere**, combined with **zero debounce across the 34 pages with search inputs**. Every search box fires a fetch on every keystroke; with no request cancellation, a slower response to an earlier keystroke can arrive after a faster response to a later one and silently overwrite the correct, more recent results with stale data.

**Solution**
1. For every editable list, give each row a stable identity: the database `id` for existing rows, or a client-generated `crypto.randomUUID()` for new unsaved rows, assigned once when the row is created — never derived from the row's current position in the array. Use that as the `key` instead of `index`.
2. Add a small `useDebouncedValue` hook (or the `use-debounce` package) wrapping search input state before it's used as a fetch dependency or React Query key — this alone removes most of the keystroke-triggered request volume.
3. For pages already migrated to `useERPQuery()` (item #19), request cancellation on stale responses comes largely for free from TanStack Query's built-in query-key-based deduplication and cancellation — this is one more reason to prioritize that migration, since it fixes this bug as a side effect rather than requiring a separate `AbortController` per page for pages that haven't been migrated yet.

---

## 22. Extend Repository/Service pattern to remaining modules

**Problem**
Once Sales Bills (P1 #13) proves out the repository/service pattern, the same "page talks directly to Supabase/fetch with no service layer" pattern exists across every other module — Parties, Designs, Godowns, Brands, Workers, Banks, GST rates, Units, Purchases, Raw Materials, Production, Finance. There is currently no `services/` or `repositories/` folder anywhere in the codebase.

**Solution**
Roll out `repositories/<module>.repository.ts` + `services/<module>.service.ts` + `use<Module>()` following the exact template established by Sales Bills, module by module, prioritizing whichever modules currently have the largest/most duplicated fetch logic (Purchases and Raw Materials are natural next candidates given their similarity to Sales Bills' shape). Resist inventing new naming or structure per module — the value of doing this module by module is that every module ends up looking the same, which is what makes onboarding a future developer (or agent) faster.

---

## 23. Accessibility pass

**Problem**
517 `<label>` elements exist across the codebase, but only 12 use `htmlFor` to associate with their corresponding input — roughly 98% of labels are visually positioned near a field but not programmatically linked to it. This means screen readers can't announce which label belongs to which input, and clicking label text doesn't focus/toggle the associated field (a basic native HTML behavior lost). Zero literal `aria-*` attributes exist anywhere in the codebase — though this needs a caveat: Radix-based components (`dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `tabs.tsx`, `checkbox.tsx`, `switch.tsx`, `tooltip.tsx`) handle ARIA internally via Radix itself, so this gap is really about the ~500+ plain form fields in `PartyForm`, `PurchaseForm`, `WorkerForm`, and the many inline filter inputs on list pages — not the shadcn UI primitives, which are already fine.

**Solution**
For every plain `<label>`/`<input>` pair outside the Radix-based components, add matching `id`/`htmlFor` attributes:
```tsx
<label htmlFor="party-name">Party Name</label>
<input id="party-name" ... />
```
Since this is mechanical and repetitive, it's a good candidate to fix as part of the component breakup work in item #20 rather than as a separate blanket sweep — when a form is being split into subcomponents anyway, add the `id`/`htmlFor` pairing at the same time.

---

## 24. `next/image` / `next/font` audit

**Problem**
Not yet checked in detail — flagged as an open item rather than a confirmed finding. Next.js provides `next/image` (automatic image optimization, lazy loading, responsive sizing) and `next/font` (self-hosted, layout-shift-free font loading) as standard replacements for plain `<img>` tags and external font `<link>`/`@import` usage.

**Solution**
Audit whether the app is using `next/image` and `next/font` consistently or falling back to plain `<img>` tags and manually-loaded fonts, and migrate any gaps found. Low-risk, standard Next.js hygiene — do this as a quick pass once other higher-priority items are further along.

---

## 25. Write the Experience checklist + a short Engineering Guide

**Problem**
There's a genuine long-term value in documenting UX rules ("every table must have a skeleton, empty state, and pagination"; "every button must have a loading/disabled/success state"; "every dialog must trap focus and support escape") and engineering conventions (folder structure, naming, how services/repositories are organized) so a future developer — or an AI coding agent — can onboard quickly. But writing this *before* the framework exists means documenting an aspiration rather than your actual codebase, and it risks becoming exactly the kind of speculative, ungrounded document flagged and declined earlier in this process.

**Solution**
Write this only once items #9-13 and #20-22 are substantially built — derive the checklist from what `useERPQuery`, the skeleton system, and the Sales Bills reference module actually do, rather than speculating about what they should do. Keep it short: a single-page checklist per UI pattern (tables, buttons, dialogs, forms), not a multi-hundred-page handbook. Pair this with lightweight ADRs (P4 #42) written as each major decision is actually made, not in advance.

---

## 26. Delete dead `isFetchingData` state

**Problem**
`store/index.ts` declares `isFetchingData: boolean` and `setIsFetchingData`, but grepping the entire codebase for consumers of either turns up zero usages outside the store definition itself. It's declared and settable but never read anywhere.

**Solution**
Remove `isFetchingData` and `setIsFetchingData` from the store entirely. This is a trivial, zero-risk cleanup — do it whenever convenient, no need to schedule it specially.

---

## 27. Centralize hardcoded API endpoint strings into constants

**Problem**
API endpoint paths like `"/api/upload/presigned"` are written as raw string literals at their call sites rather than referenced from a shared constant. This is a minor but real source of typo risk and makes future endpoint renames harder to track down reliably (a rename requires a project-wide string search rather than updating one constant).

**Solution**
Create a small `lib/api-routes.ts` (or similar) exporting named constants for each endpoint path, and update call sites to reference them:
```ts
export const API = {
  upload: { presigned: "/api/upload/presigned" },
  sales: { bills: "/api/sales/bills" },
  // ...
} as const;
```
Do this incrementally as you touch each module for other reasons (e.g., during the `useERPQuery` migration in item #19) rather than as a single dedicated sweep.

---

## 43. Build the project "brain" — layered context files + seeded Serena memory

**Problem**
Every agent session currently starts from zero — with no persistent, curated project memory, the agent re-derives "what stack is this, how does data fetching work, where do schemas live, what's already broken vs. already fixed" by reading files broadly, every single session, before it can start even a small task. Serena MCP gives fast structural navigation (symbol lookup, find-references) once the agent knows *what* to look for — but it doesn't solve *what the agent needs to know before starting*, which is a different problem. Without seeded memory, tokens get spent re-discovering the same architecture and the same 42+ already-documented findings (P0-P4) over and over.

**Solution — this item is self-contained and directly executable.** Everything needed to create the files and seed Serena is embedded below — an agent working this item should create the three files at the paths given, and seed the memory entries, without needing to fetch any other document.

A single huge context file is its own token-waste trap (loaded in full regardless of task relevance). The shape is layered on purpose: a short root file loaded every session, per-module files loaded only when that module is touched, and topic-scoped Serena memories retrieved on demand instead of triggering a fresh scan.

---

### 43a. Create `CLAUDE.md` at the repo root

```markdown
# TAS ERP — Project Brain (Root)
This file is read automatically at the start of every agent session. Keep it short — its job is to orient and redirect, not to contain everything. Deeper, module-specific detail lives in per-module `CLAUDE.md` files and in Serena's seeded memory.

## Before doing anything else
1. **Do not explore the codebase broadly before starting a task.** Check this file, the relevant module's `CLAUDE.md` (if one exists in the folder you're working in), and Serena's seeded memory first. Use Serena for *targeted* symbol/reference lookup once you know what you need — not for open-ended discovery.
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
Every business-scoped table has a `business_id` column. Every API route must scope reads/writes by the caller's `business_id`, resolved via `getSessionBusinessId()` in `lib/supabase/server.ts`. Never trust a `business_id` passed in a request body — always resolve it server-side from the session. When accepting any other foreign-key id from a request body (e.g. `party_id`), verify it belongs to the same `business_id` before using it.

## Folder map
\`\`\`
src/app/(auth)/            public routes: login, register
src/app/(dashboard)/        authenticated pages, one folder per module
src/app/api/                API routes, mirrors the frontend module structure
src/components/ui/          shadcn/Radix primitives — don't modify casually
src/components/shared/       ConfirmDialog, EmptyState, StatusBadge, WizardHeader, etc.
src/components/tables/       DataTable.tsx, TableSkeleton.tsx
src/components/forms/        large domain forms — see per-module CLAUDE.md for refactor status
src/components/layout/       Sidebar.tsx, Header.tsx — see P1 #17, P2 #20.12
src/hooks/                  useBusinessId.ts, useRole.ts (clean), useFileUpload.ts (see P1 #17-18)
src/lib/supabase/           client.ts (browser), server.ts (server + session resolution)
src/lib/schemas/             shared zod schemas (frontend + backend)
src/store/index.ts           single small Zustand store
src/repositories/            one file per domain, only layer touching Supabase directly
src/services/                 business logic + validation, between repositories and hooks/routes
supabase/migrations/          managed via Supabase CLI (`supabase db push`) — never write ad hoc migration scripts
\`\`\`

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

## Where to look for more detail
- Full findings + solutions, organized by priority: `TAS-ERP-P0-Security-DataIntegrity.md` through `TAS-ERP-P4-Future-ProductIdeas.md`
- Sales Bills is the reference implementation for the repository/service/hook pattern — see `app/(dashboard)/sales/bills/CLAUDE.md` before replicating the pattern elsewhere
- Product ideas intentionally *not* being worked on right now, and why: `TAS-ERP-P4-Future-ProductIdeas.md`
```

---

### 43b. Create `app/(dashboard)/sales/bills/CLAUDE.md` (first per-module brain — template for the rest)

```markdown
# Sales Bills — Module Brain
Loaded automatically whenever the agent works inside this folder.

## Status
This is the **reference module** for the repository/service/hook pattern (P1 #13). Once complete, its shape is the template for every other module (P2 #22) — don't diverge without a good reason; if you do, update this file to explain why.

## Known baseline (verified pre-refactor — do not re-audit these as new)
| File | Lines | State vars | Fetch calls | useQuery |
|---|---|---|---|---|
| `bills/page.tsx` | 594 | 11 | 2 | 0 |
| `bills/new/page.tsx` | 1,879 | 38 | 7 | 0 |
| `bills/[id]/edit/page.tsx` | 1,712 | 39 | 6 | 0 |
| `bills/[id]/page.tsx` | 1,105 | 3 | 2 | 0 |
| `bills/[id]/print/page.tsx` | 881 | 1 | 1 | 0 |

Two backend issues motivated the refactor, fixed as part of it — if these patterns reappear, they're regressions:
- GST/total calculation was duplicated between create and edit routes — should live only in `services/sales-bill.service.ts`.
- Bill-update route did update → delete items → insert items as three independent, non-transactional calls — should be wrapped in one Postgres function via `.rpc()`.

## Target structure
\`\`\`
sales/bills/
  page.tsx                (list — useERPQuery, not raw fetch)
  new/page.tsx              → SalesBillEditor mode="create"
  [id]/edit/page.tsx        → SalesBillEditor mode="edit"
  [id]/page.tsx              (BillHeaderCard, BillItemsView, BillTotalsCard, BillPaymentHistory, BillActionsBar)
  [id]/print/page.tsx        (PrintHeader, PrintPartyInfo, PrintItemsTable, PrintTotalsFooter)
  components/
    SalesBillEditor.tsx, CustomerSection.tsx, ItemsTable.tsx, PaymentSection.tsx, TotalsPanel.tsx, TaxCalculator.tsx, BillValidation.tsx

repositories/sales-bill.repository.ts   (only file calling Supabase for this domain)
services/sales-bill.service.ts           (GST/total calculation — single source — business validation)
hooks/useSalesBill.ts                     (returns { bill, customer, items, totals, actions, validation, loading })
schemas/sale-bill.schema.ts               (shared between form and API route)
\`\`\`

## Conventions specific to this module
- Never bypass `SalesBillService` for total/GST calculation anywhere else in the app — import it, don't reimplement it.
- `mode="create"` and `mode="edit"` stay one `SalesBillEditor` — never fork into two files again.
- Line items use `crypto.randomUUID()` as key for unsaved rows, DB `id` once saved — never array index.

## Don't re-flag as new findings
Oversized page components, zero React Query usage, duplicated fetch calls, duplicated GST calculation, non-transactional bill-update writes — all already identified, check P1 #13's current status before re-reporting.
```

---

### 43c. Seed Serena memory with the following entries

Write each of these as a separate, named memory (via Serena's memory-write tool, or as individual files if Serena reads memory from disk, commonly `.serena/memories/<name>.md`):

**`architecture-overview`**
```
TAS ERP is a multi-tenant garment manufacturing ERP. Next.js 14 App Router frontend, Next.js API routes backend, Supabase (PostgreSQL + RLS). Every business-scoped table has a business_id column; every API route resolves it server-side via getSessionBusinessId() — never trust a business_id from the request body. Multi-step writes go through Postgres functions via .rpc(), not sequences of independent Supabase calls (history of partial-write bugs, see P0 items 3, 6, 7). Data fetching standard is useERPQuery()/useERPMutation(); legacy raw fetch()+useState pages are a known, tracked migration-in-progress (P2 item 19), not a new finding.
```

**`folder-map`**
```
src/app/(auth)/ public routes. src/app/(dashboard)/ authenticated pages, one folder per module. src/app/api/ mirrors frontend module structure. src/components/ui/ shadcn/Radix primitives, ARIA handled internally. src/components/shared/ ConfirmDialog, EmptyState, StatusBadge, WizardHeader. src/components/tables/ DataTable.tsx, TableSkeleton.tsx. src/components/forms/ large domain forms, mid-refactor. src/components/layout/ Sidebar.tsx, Header.tsx, mid-refactor. src/hooks/ useBusinessId.ts, useRole.ts (clean), useFileUpload.ts (mid-refactor). src/lib/supabase/ client.ts, server.ts. src/lib/schemas/ shared zod schemas. src/store/index.ts single small Zustand store. src/repositories/ one file per domain. src/services/ business logic between repositories and hooks/routes. supabase/migrations/ managed via Supabase CLI only.
```

**`api-conventions`**
```
Success response: { data: T, meta?: {...} }. Error response: { error: string, details?: unknown }. Older routes with a resource-named top-level key are a known migration-in-progress (P1 item 8), not a new bug. Every route validates request.json() through a shared zod schema from lib/schemas/ before use, 400 with parsed.error.flatten() on failure. Never trust client-computed financial totals/GST without re-validating bounds server-side. Any foreign-key id from a request body must be checked against the caller's own business_id before use.
```

**`component-conventions`**
```
Target ~250-350 lines per component/page. If growing past that, split by logical section — P2 item 20 has a worked, file-specific split plan for every currently-oversized component, don't invent a new pattern per file. Never key={index} on editable/reorderable lists — use a stable id (DB id, or crypto.randomUUID() for unsaved new rows). Debounce search inputs before using as a query dependency. Don't construct a Supabase client or call .auth.* directly inside UI components — use the shared AuthProvider/useLogout().
```

**`known-issues-index`**
```
Full findings and solutions live in five files, organized by priority — check these before writing a new audit of something already covered: TAS-ERP-P0-Security-DataIntegrity.md (status: done), TAS-ERP-P1-Architecture.md (status: verify current state in file), TAS-ERP-P2-Rollout.md (status: in progress, current focus), TAS-ERP-P3-Polish.md (status: not started, no urgency), TAS-ERP-P4-Future-ProductIdeas.md (status: intentionally parked, includes explicit reasons why — check before proposing a "new" feature idea that may already be recorded here).
```

**`reference-module-sales-bills`**
```
Sales Bills (app/(dashboard)/sales/bills/) is the reference implementation for the repository/service/hook pattern. See its own module-level brain file (app/(dashboard)/sales/bills/CLAUDE.md) for full detail before replicating this pattern in another module. Do not duplicate GST/total calculation logic outside services/sales-bill.service.ts — that duplication was a confirmed, fixed bug.
```

**`agent-working-instructions`**
```
Do not explore the codebase broadly before starting a task. Check the root CLAUDE.md, the relevant module's CLAUDE.md (if present), and this seeded memory first. Use Serena's symbol/reference lookup for targeted queries once the specific thing needed is known — not for open-ended discovery. Before flagging anything as a new problem, check known-issues-index — if already documented, work the existing item or explain specifically why it's new, rather than re-deriving it from scratch.
```

---

### 43d. Ongoing maintenance
Whenever a P0-P4 doc's status changes (e.g., P2 moves from "in progress" to "done"), update: the status line in root `CLAUDE.md`, the relevant per-module `CLAUDE.md`'s "Status" section, and the `known-issues-index` Serena memory. Stale status in any of these is worse than no status — it actively misleads the agent into skipping work that's still needed, or re-doing work that's already done.

---



## 28. Resolve `: any` usage

**Problem**
532 occurrences of `: any` across the codebase undermine TypeScript's type-checking exactly where it matters most — API response boundaries, error handling (`catch (err: any)` is extremely common), and data passed between layers. A concrete confirmed example: `useFileUpload.ts`'s `catch (err: any)` block, which should be `catch (err: unknown)` with proper narrowing.

**Solution**
Don't attempt to fix all 532 in one pass — that's a large, low-value-per-hour undertaking if done as a dedicated sweep. Instead, fix `any` usage as a standing rule whenever you're already editing a file for another reason (this pairs naturally with the Boy Scout Rule adopted for this whole project: leave every file a little better than you found it). Prioritize `catch (err: any)` blocks first, since `catch (err: unknown)` with `if (err instanceof Error)` narrowing is a mechanical, low-risk fix with a real payoff (proper error messages instead of assuming a shape that might not be there), and API response types second, since that's where an incorrect assumed shape is most likely to cause a real bug.
