# TAS ERP — Pre-Phase 7 Master Implementation Plan

This is a single document with two parts:

- **Part 1 — Loop-Engineering Execution Layer.** The fixed agent prompt (`LOOP.md`), the running progress/decision log (`STATE.md`), and the atomic task queue (`TASKS.md`). This is what actually gets fed to a coding agent, one task per loop iteration. Read this part first — it's the part you act on.
- **Part 2 — Full Specification.** The complete module-by-module reference: exact data model changes, UI changes, and acceptance criteria, including everything confirmed through screenshots and discussion. Part 1's tasks reference this part for full context where a condensed task description isn't enough on its own.

If Part 1 and Part 2 ever appear to disagree on a detail, Part 2 (the full spec) wins on substance, but Part 1 is what actually gets executed — if you spot a mismatch, fix Part 1 to match Part 2, not the other way around.

**Non-negotiable cross-cutting rule, per the user's explicit instruction:** every new or redefined screen must be **wired up to the modules it depends on**, not built as an isolated UI shell. Concretely: if Roll Allocation deducts stock, that deduction must actually be visible on the real Purchase Stock screen, not just recorded in a table nobody reads. If Assign Stages assigns a worker to a stage, that assignment must actually pre-fill in Stage Entries, not just sit unused in a table. If a Design is selected in the lot wizard, its category/size-set must actually populate downstream fields. Every task below has a "Wiring check" line in its Verify section for exactly this reason — a task is not DONE if it works in isolation but doesn't actually connect to the screen/module it's supposed to feed.

---

# PART 1 — LOOP-ENGINEERING EXECUTION LAYER

## 1.1 `LOOP.md` — the fixed prompt (feed this every iteration, unmodified)

```
You are working on TAS ERP, a multi-tenant garment manufacturing ERP
(Next.js 14, Supabase/Postgres with RLS, Cloudflare R2, TanStack Query).

Before doing anything:
1. Read STATE.md in full. It tells you what is already done, what is
   in progress, what decisions have already been made (including UI
   conventions confirmed from real screenshots), and what open
   questions exist. Treat it as ground truth — do not re-litigate
   decisions already recorded there.
2. Read TASKS.md. Find the FIRST task whose status is "TODO" and whose
   listed dependencies are all "DONE" in STATE.md. That is your task.
   If no such task exists, stop and write "NO ELIGIBLE TASK" to
   STATE.md under a new "## Blocked" section, explaining why, and end
   your turn. Do not pick a task out of order and do not pick more
   than one task.
3. Read the "Acceptance Criteria" / "Verify" and "Explicit Non-Goals"
   for that task in TASKS.md, and read the referenced section of Part
   2 (Full Specification) if the task points to one. Do ONLY what is
   listed. If something is ambiguous or missing information you need,
   do not guess — write the question under "## Open Questions" in
   STATE.md, mark the task "BLOCKED-NEEDS-INPUT" instead of "DONE",
   and stop. Do not invent scope beyond what is written.
4. For ANY new or redefined screen, match the existing UI conventions
   recorded in STATE.md under "## UI Conventions (confirmed from
   screenshots)" — same stepper pattern, same card pattern, same
   detail-page layout, same list/table pattern. Do not invent a
   different visual pattern. If a screen you're building has no clear
   precedent in those conventions, note the gap in STATE.md rather
   than guessing a new pattern silently.

While implementing:
5. Make the smallest change that satisfies the task's acceptance
   criteria. Do not refactor unrelated code. Do not start a second
   task even if you finish early and see an obvious next step —
   record the observation in STATE.md instead and stop.
6. If this task depends on a DB schema change, write the migration as
   its own file, run it, and confirm it applied before touching UI
   code for the same task.
7. If this task's Verify section includes a "Wiring check," you must
   confirm the connection to the downstream/upstream module actually
   works end-to-end — not just that this screen's own state updates.
   A feature that only updates its own local state without actually
   reflecting in the real dependent screen is NOT done.

Before finishing:
8. Run every item in the "Verify" section for this task exactly as
   written, including any Wiring check. If verification fails, keep
   working on THIS task — do not mark it done and do not move to the
   next task.
9. Once verification passes: commit with message
   "[TASK-<id>] <task title>", update TASKS.md to mark this task
   "DONE", and append a short entry to STATE.md under
   "## Completed Log" (task id, what changed, any deviation from the
   original task description and why, any new fact future tasks
   should know).
10. Stop. Do not start the next task in this same run.
```

---

## 1.2 `STATE.md` — initial version

```markdown
# STATE

## Project facts established before this loop started
- Stack: Next.js 14 App Router, Supabase/Postgres, RLS on every table
  via business_id, soft delete via deleted_at, optimistic locking via
  updated_at.
- Design system locked: sidebar #0F1629, primary #6366F1, font Hanken
  Grotesk.
- This is a TESTING-PHASE system. Existing in-progress Production Lots
  may be lost/migrated destructively if needed.

## UI Conventions (confirmed from real screenshots — match these exactly)
- **Wizard / multi-step creation screens**: numbered circle stepper
  across the top (filled indigo circle = current step, gray = pending
  step, connected by a horizontal line), step name in small caps
  below each circle. Page header above the stepper: breadcrumb (small
  gray caps, e.g. "PRODUCTION > PRODUCTION LOTS > CREATE LOT"), then a
  row with a back-arrow button + bold title + gray subtitle on the
  left, and a primary action button (indigo, rounded, icon + label,
  e.g. "Create Lot") on the top right.
- **Two-column layout during creation flows**: main form fields in a
  wider left column, a persistent narrower right sidebar containing a
  "Live Summary" card (label/value rows updating live as the user
  fills the form) and, where relevant, an "Estimated Timeline" card
  below it.
- **Card sections** (used throughout, both in wizards and detail
  pages): white rounded card, header row = small tinted-circle icon +
  bold small-caps section title (e.g. "📋 BASIC INFORMATION"),
  separated from the body by a thin divider line.
- **Detail page pattern**: top header card containing — ID + status
  badge, a row of key facts (e.g. brand/design/colour/quantity), and
  a placeholder thumbnail image on the right. Below that, if the
  entity has a workflow/progress, a horizontal stepper with checkmark
  circles per completed stage (green filled circle + check icon +
  stage name + status badge + date + qty). Below that, a logs/history
  table (e.g. "Stage Entries Logs" with columns #, Stage, Entry Date,
  Qty In, Qty Out, Wastage, Rate, Worker, Status, Actions). A right
  sidebar summary card mirrors totals from the table (e.g. "Lot
  Summary": Total Quantity, Completed Quantity, In Progress Quantity,
  Pending Quantity, Total Stages).
- **List/index page pattern**: bold title + gray subtitle, a primary
  "+ Add X" button top right, a row of colored stat cards (icon +
  label + count) underneath, then filter tabs (e.g. "All / Suppliers
  / Customers / Workers") + a search bar on the same row, then a table
  with a Status badge column and an Actions column (view/edit/delete
  icons).
- **CONFIRMED BUG — row click target (site-wide)**: on list/table
  screens, only the entity's name text is currently clickable to open
  its detail page; the rest of the row (other cells, empty space) is
  not clickable, forcing users to click precisely on the name. Fix
  site-wide: make the entire row clickable to open the detail page,
  and add stopPropagation() to the Edit/Delete action icons so they
  don't also trigger row navigation. See TASK-0.5.
- **CONFIRMED BUG — numeric input default zero (site-wide)**: numeric
  fields (seen concretely on the Design form's "Target Sale Price"
  field, but pattern likely exists elsewhere — cost fields, rate
  fields, quantity fields, etc.) show a literal "0" as the field's
  actual value rather than an empty field with a placeholder. When the
  user starts typing, the "0" doesn't clear/get overridden — it
  behaves like string concatenation (typing "1" produces "01" instead
  of replacing "0"), forcing the user to manually delete the leading
  zero every time. Root cause is almost certainly the input being
  bound to a numeric state initialized to 0 and rendered directly as
  the input value (so the DOM shows "0") instead of being initialized
  to an empty string/null with a placeholder of "0", and/or the
  onChange handler doing string concatenation instead of parsing and
  replacing. Fix site-wide, not per-field. See TASK-0.4.

## Confirmed decisions (from discussion, not to be re-asked)
- PAN default when blank: "N/A" (GST default when blank: "URP").
- Costing model (TASK-3.8): Option B — itemized, exact per-roll
  fabric cost breakdown at the lot level (e.g. "Roll A: 300m x Rs100 =
  Rs30,000 / Roll B: 150m x Rs120 = Rs18,000 / Total: Rs48,000 ->
  Rs171.43/piece"), NOT a blended weighted-average rate, and NOT
  true per-piece/FIFO roll traceability (that would require tracking
  which specific pieces were cut from which roll at the cutting
  stage, which is out of scope).
- Design Spec Sheet (Lot Step 6, formerly called "3.4"/"Step 4"):
  lives ONLY in the Lot wizard, filled fresh per lot (NOT stored on
  the Design master record). Field list varies per Garment Type (new
  Master Data entity — see TASK-1.6/1.7). Fields are a flat,
  ungrouped list for now (not grouped by garment component).
- Multi-colourway support: CONFIRMED. One Production Lot can include
  multiple colours. Each colour gets its own Size Set & Quantity grid.
  "Use same for all colours" checkbox (seen in the real UI) must be
  functionally wired: when checked, one grid's quantities apply to
  all colours; when unchecked, each colour has an independent grid.
  Total Quantity for the lot = sum across all colour grids. This
  ripples into Roll Allocation (enough fabric for all colourways
  combined), Design Spec Sheet (may be shared across colours or
  per-colour — default to shared/applies-to-all unless a field is
  explicitly marked per-colour), and Costing (total pieces = sum
  across colour grids).
- Production Lot final step order (see Part 2, Phase 3, for full
  detail on each step): 1) Roll Allocation (new) -> 2) Basic Details
  (existing screen, extended) -> 3) Lot Specifications (existing
  screen, currently EMPTY, built fresh) -> 4) Size Set & Quantity
  (existing screen, extended for multi-colour) -> 5) Assign Stages
  (existing screen, extended with per-stage worker assignment) -> 6)
  Design Spec Sheet (new) -> 7) Review & Create (existing screen,
  every summary block must be clickable to jump back to that exact
  step for editing).
- Costing is NOT a wizard step. It is a live-updating tab on the Lot
  DETAIL page (alongside Production Stages Progress and Stage Entries
  Logs), because fabric cost is known at creation but labor cost
  accrues progressively as Stage Entries get logged.
- Stage Entries worker field: defaults to whoever was assigned in Lot
  Step 5 (Assign Stages), but remains user-editable/changeable at the
  point of logging a stage entry (not locked read-only).
- Bank Account / UPI detail pages need a prerequisite check: confirm
  whether payments are currently tagged to a specific
  bank-account/UPI-ID anywhere in the system. If not, this must be
  added (payment_method field/table with account linkage) BEFORE the
  detail page's transaction log can show real data. Payment method
  must support: Bank Transfer, UPI, Cash, Cheque — Cash and Cheque
  payments will naturally have no bank/UPI-account log entry, which
  is expected, not a bug.
- Party detail page: ONE shared header (name, code, contact numbers,
  GST/PAN, comments — identical regardless of type), but the body
  section below it is conditional on party_type:
  - Supplier -> "Purchase History" (raw material purchases from this
    party, total purchased, outstanding payments)
  - Customer -> "Sales History" (invoices billed, amounts, payment
    status)
  - Worker -> "Stage Assignments" (lots/stages worked, rate)
- Same conditional-section pattern applies to ALL detail pages, not
  just Parties, each with entity-appropriate content:
  - Brand -> linked Production Lots (list, status, quantity) + rollup
    (e.g. total pieces produced under this brand)
  - Godown -> current stock summary + recent stock movements
  - GST Rate -> which raw materials/items currently use this rate
  - Bank Account -> payments/transactions ledger routed through this
    account (subject to the payment-method prerequisite above)
  - UPI -> same as Bank Account, scoped to that UPI ID
  - Raw Material -> stock on hand (qty+value) + purchase history
- Designs master data confirmed field list (from real screenshot):
  Design/Style Name, Associated Brand, Design Number (auto-generated),
  Sizing Scale (Size Set), Category, Sub-Category, Collection/Season,
  HSN Code, Style Notes & Description, "Active Catalog Item" toggle,
  Design Image Gallery (image upload, max 5MB), Colour Swatches &
  Thumbnails (repeatable "+ Add Colour"). REMOVE: Target Demographics,
  Target Sale Price (per item v) — do not drop the underlying DB
  columns, just remove from the form.
- Purchase bills MAY mix accessory and fabric line items on one bill.
- Stage Entries reorganization (old item xxxvii) is explicitly
  SKIPPED for this round.

## Open Questions (loop must not guess on these — surface, don't solve)
(none currently blocking — all previously open items have been
resolved above)

## In Progress
(none yet)

## Completed Log
(none yet — newest entries go at the top once tasks complete)

## Blocked
(none yet)
```

---

## 1.3 `TASKS.md` — the atomic task queue

Legend: status ∈ {TODO, IN_PROGRESS, BLOCKED-NEEDS-INPUT, DONE}

```markdown
# TASKS

---
## PHASE 0 — Shared Infrastructure & Global Bug Fixes
(Do these first. Everything else depends on the stock ledger existing
and correctly working, and the two global UI bugs being fixed before
they get copy-pasted into new screens.)

### TASK-0.1a — Create stock_ledger table + trigger
status: TODO
depends_on: []
Scope: Create `stock_ledger` table (business_id, item_type, item_id,
godown_id, transaction_type, quantity_delta, value_delta,
reference_table, reference_id, created_at, created_by). If a
denormalized "current stock" column is kept anywhere, add a DB
trigger deriving it from stock_ledger on insert — app code must never
write to it directly.
Verify: Table + trigger exist in a migration; inserting a test row
updates any denormalized column via the trigger, not app code.

### TASK-0.1b — Refactor Purchase save to write stock_ledger
status: TODO
depends_on: [TASK-0.1a]
Verify: Create a test purchase of 500m; Purchase Stock screen shows
500m, sourced from a SUM query against stock_ledger.
Wiring check: confirm the number shown on the actual Purchase Stock
screen updates, not just a value in a debug/test query.

### TASK-0.1c — Refactor Purchase Return save to write stock_ledger
status: TODO
depends_on: [TASK-0.1b]
Verify: Return 1 roll from the test purchase in 0.1b; stock decreases
by that roll's meters immediately on the real Purchase Stock screen.

### TASK-0.1d — Refactor Production Lot roll allocation to write stock_ledger
status: TODO
depends_on: [TASK-0.1b]
Note: can be stubbed as a callable function ahead of the full Lot
Step 1 UI (TASK-3.1) — mark DONE once the function exists and is
unit-tested against a mock allocation, then TASK-3.1 wires it to the
real UI.
Verify: Calling the function with (roll_id, meters) writes a correct
negative delta.

### TASK-0.1e — Refactor Production Lot finished-stock push to write stock_ledger
status: TODO
depends_on: [TASK-0.1b]
Note: same stub-ahead-of-UI approach as 0.1d; TASK-3.9 wires it up.

### TASK-0.2 — Units of Measure master data screen
status: TODO
depends_on: []
Scope: units table + CRUD screen (name, abbreviation, base_unit_id,
conversion_factor). Nav entry under Master Data. Follow the standard
list-page + detail-page UI conventions from STATE.md.
Verify: Create, edit, soft-delete a unit; deleted_at set correctly.

### TASK-0.3a — Add party_type='worker' + worker fields, migrate workers table
status: TODO
depends_on: []
Scope: Extend parties (or side table) with stage_specialty[],
wage_type, wage_rate. Migrate all rows from workers table into
parties with party_type='worker'. Rename old table to
workers_deprecated (do not drop).
Verify: Row count matches; spot-check 3 migrated records;
workers_deprecated untouched.

### TASK-0.3b — Remove Workers + Parties from Master Data nav
status: TODO
depends_on: [TASK-0.3a]
Verify: Master Data nav no longer lists Workers or Parties; the real
Parties module shows migrated workers when filtered by type=worker.

### TASK-0.4 — GLOBAL FIX: numeric input default-zero bug
status: TODO
depends_on: []
Scope: Audit EVERY numeric/currency input across the entire
application (not just the ones mentioned elsewhere in this plan —
search the whole codebase for numeric input components). Confirmed
example: Design form's Target Sale Price field showing literal "0"
that doesn't clear on typing (that specific field is being removed
per TASK-1.4, but the underlying bug pattern must be fixed everywhere
it appears — cost fields, rate fields, quantity fields, roll meters,
etc.). Fix root cause: numeric fields should initialize to an empty
value (not the literal number 0) with "0" shown only as a gray
placeholder, and typing should replace/parse the value normally
rather than string-concatenating onto an existing "0". Fix this as a
shared/reusable input component if one doesn't already exist, so
future numeric fields inherit the fix automatically rather than
repeating the bug.
Verify: Test at least 5 different numeric fields across at least 3
different modules (e.g. a cost field, a quantity field, a rate
field); confirm each is empty by default (placeholder "0" is fine,
literal value "0" is not) and typing "5" produces "5", not "05" or
"50".
Wiring check: confirm the shared component (if created) is actually
the one used by existing screens after the fix, not a new component
sitting unused alongside the old buggy one.

### TASK-0.5 — GLOBAL FIX: row click target on list/table screens
status: TODO
depends_on: []
Scope: Audit every list/table screen in the app (Parties, Brands,
Godowns, Raw Materials, GST Rates, Bank Accounts, UPI, Purchases,
Purchase Returns, Production Lots, Stage Entries, Designs, Units, and
any others). Currently only the entity's name/display text is
clickable to open its detail page. Fix: make the entire table row
clickable (navigates to the detail page on click anywhere in the
row), and add stopPropagation() (or equivalent) to the Edit/Delete
action icons in the Actions column so clicking them does not also
trigger row navigation.
Verify: On at least 3 different list screens, click on a non-name
cell (e.g. the phone number or status badge) and confirm it opens the
detail page; click Edit/Delete icons and confirm they do NOT also
navigate to the detail page.

### TASK-0.6 — Payment method + account tagging (prerequisite for Bank/UPI detail pages)
status: TODO
depends_on: []
Scope: Check whether payments recorded anywhere in the system
(against sales invoices, purchase bills, etc.) are currently tagged
to a specific payment method and, where applicable, a specific bank
account or UPI ID. If this link does not exist, add it: a
payment_method field/enum with values Bank Transfer, UPI, Cash,
Cheque, and a nullable reference to the specific bank_account_id or
upi_id when the method is Bank Transfer or UPI (null for Cash/Cheque
— that is expected, not a bug). Apply this wherever payments are
currently recorded in the app (sales, purchases, purchase returns'
credit notes).
Verify: Record a payment via Bank Transfer against a specific
account, one via UPI against a specific UPI ID, one via Cash, and one
via Cheque; confirm all four save correctly and the Bank Transfer/UPI
ones carry the correct account reference.
Wiring check: this task exists specifically so TASK-1.1d and
TASK-1.1e (Bank/UPI detail pages) can show real transaction data —
confirm those tasks can actually query against this new field/table
once built.

---
## PHASE 1 — Master Data Fixes

### TASK-1.1a — Brand detail page
status: TODO
depends_on: []
Scope: Follow the confirmed detail-page UI convention. Body section:
linked Production Lots (list, status, quantity) + a rollup (e.g.
total pieces produced under this brand).
Verify: Clicking a brand row (anywhere in the row, per TASK-0.5)
opens the detail page showing linked lots.

### TASK-1.1b — Godown detail page
status: TODO
depends_on: [TASK-0.1a]
Verify: Shows live stock summary + recent movements via stock_ledger.

### TASK-1.1c — GST Rate detail page
status: TODO
depends_on: []
Verify: Shows which raw materials/items reference this rate.

### TASK-1.1d — Bank Account detail page
status: TODO
depends_on: [TASK-0.6]
Verify: Shows a transactions/payments log filtered to this account.

### TASK-1.1e — UPI detail page
status: TODO
depends_on: [TASK-0.6]
Verify: Same as 1.1d, scoped to this UPI ID.

### TASK-1.1f — Raw Material detail page
status: TODO
depends_on: [TASK-0.1a]
Verify: Shows current stock (qty+value) + purchase history from
stock_ledger/purchases.

### TASK-1.2a — production_templates table + migrate existing stages into default template
status: TODO
depends_on: []
Verify: All existing production_stages rows have a valid template_id
under a "Standard" default template; an existing lot still renders
its stages correctly.

### TASK-1.2b — Production Template list + detail page (reorderable stage list)
status: TODO
depends_on: [TASK-1.2a]
Verify: Create a template, add/reorder/edit stages, changes persist.

### TASK-1.3 — Move raw_material_type off Master Data into inline dropdown
status: TODO
depends_on: []
Verify: Master Data has no Raw Material Type screen; Raw Material
form's type dropdown has a working inline "+ add new type" option.

### TASK-1.4 — Design form: remove 2 fields, confirm full field set
status: TODO
depends_on: []
Scope: Confirmed field set for the Design form (Master Data ->
Designs), per real screenshot: Design/Style Name, Associated Brand,
Design Number (auto-generated, read-only), Sizing Scale (Size Set),
Category, Sub-Category, Collection/Season, HSN Code, Style Notes &
Description, Active Catalog Item toggle, Design Image Gallery
(upload, max 5MB), Colour Swatches & Thumbnails (repeatable). REMOVE:
Target Demographics, Target Sale Price — remove from form and
validation only, do not drop DB columns.
Verify: Fields absent from create/edit forms; DB columns still exist;
remaining fields all save/load correctly; TASK-0.4's numeric-field fix
is reflected here too if any numeric field remains on this form.

### TASK-1.5 — Master Data nav cleanup (Parties/Workers removal)
status: TODO
depends_on: [TASK-0.3b]
Verify: covered by TASK-0.3b's own verify; this is a nav-only
confirmation pass.

### TASK-1.6 — Garment Types master data (new)
status: TODO
depends_on: []
Scope: Simple CRUD list (name only, e.g. Jeans, Jacket, Shirt),
standard list/detail UI conventions. This drives which Design Spec
Template applies in Lot Step 6.
Verify: Create/edit/soft-delete a Garment Type.

### TASK-1.7 — Design Spec Templates master data (new)
status: TODO
depends_on: [TASK-1.6]
Scope: One template per Garment Type. Admin defines an ordered, flat
list of fields for that garment type (e.g. Jeans template: style
name, wash type, back pocket design, wrangler design description, fly
type, waistband style). Each field has: field_name, field_type
(text | textarea | dropdown | photo), and for dropdown fields, an
options list. No component-grouping (flat list only, per confirmed
decision).
Verify: Create a template for "Jeans" with at least 4 fields of mixed
types; create a different template for "Jacket" with a different
field list; confirm they're independently editable.

---
## PHASE 2 — Parties Module + Raw Material Purchase/Return

### TASK-2.1a — Party edit enabled + comments field
status: TODO
depends_on: []

### TASK-2.1b — Multiple contact numbers on Party
status: TODO
depends_on: []
Verify: Add 2+ numbers, mark one primary, they persist.

### TASK-2.1c — GST/PAN auto-default to URP/N-A on blank
status: TODO
depends_on: []
Verify: Save a party with both blank; GST shows "URP", PAN shows "N/A".

### TASK-2.1d — Search party by city/state
status: TODO
depends_on: []

### TASK-2.1e — Party detail page with type-conditional body section
status: TODO
depends_on: [TASK-0.3a]
Scope: Shared header (name, code, contact numbers, GST/PAN, comments)
identical for all party types. Conditional body section by
party_type: Supplier -> Purchase History (purchases from this party,
total purchased, outstanding payments); Customer -> Sales History
(invoices billed, amounts, payment status); Worker -> Stage
Assignments (lots/stages worked, rate).
Verify: Open a Supplier's detail page and confirm Purchase History
shows; open a Customer's and confirm Sales History shows instead in
the same position; open a migrated Worker's and confirm Stage
Assignments shows.
Wiring check: Purchase History must pull from real purchase records
for that supplier_id, not placeholder data; same for Sales History
and Stage Assignments.

### TASK-2.2a — Supplier inline-create from Purchase form
status: TODO
depends_on: []

### TASK-2.2b — Supplier search-as-you-type combobox
status: TODO
depends_on: []
Verify: Typing "bil" surfaces "Billy Butcher" among results.

### TASK-2.2c — Custom bill number field, searchable
status: TODO
depends_on: []

### TASK-2.2d — Roll-wise purchase line items with auto-summed meters
status: TODO
depends_on: [TASK-0.1a]
Scope: purchase_rolls table (purchase_item_id, roll_number, meters,
comment, width, shade, weight_unit, weight_value, remaining_meters).
Field rules: roll_number required, meters required, shade required,
comment optional, width optional, weight_unit ('oz'|'gsm') +
weight_value optional as a pair (both blank or both filled). UI: add
multiple rolls per line item, running total meters auto-computed live.
Verify: Add 3 rolls of 100/150/200m; total shows 450m automatically.
Save with shade filled, width/weight blank — succeeds. Save missing
shade — blocked. TASK-0.4's numeric-field fix applies to the meters/
width/weight inputs here.

### TASK-2.2e — Move Remarks below purchase items table
status: TODO
depends_on: []

### TASK-2.2f — Per-line-item type toggle (accessory/fabric), mixed bill support
status: TODO
depends_on: [TASK-2.2d]
Verify: One bill saved with one accessory line and one fabric line
(with rolls) in the same submission.

### TASK-2.3a — Purchase Return: select bill -> select specific roll(s)
status: TODO
depends_on: [TASK-2.2d]

### TASK-2.3b — Purchase Return: reason field + required bill link
status: TODO
depends_on: [TASK-2.3a]

### TASK-2.3c — Purchase Return: reflect on bill detail + Party Ledger credit
status: TODO
depends_on: [TASK-2.3b, TASK-0.1c]
Verify: Return a roll from a paid bill; bill detail shows "Returned" +
adjusted value; Party Ledger shows a credit_note entry with correct
amount.

### TASK-2.4 — Rename Stock module to Purchase Stock (nav, route, redirect)
status: TODO
depends_on: []
Verify: Old route redirects; no broken links elsewhere (grep check).

---
## PHASE 3 — Production Lot Rebuild (7 real steps + Costing tab)

Real existing step names, per actual screenshots, extended as below.
Multi-colourway support applies throughout (see STATE.md). All steps
must follow the confirmed stepper + card + live-summary-sidebar UI
convention.

### TASK-3.1 — Step 1: Roll Allocation (new step, added before Basic Details)
status: TODO
depends_on: [TASK-2.2d, TASK-0.1d]
Scope: Search purchase rolls by supplier roll number or name; results
show in-stock status, remaining meters, and shade (shade matters as
much as roll number for fabric matching); multi-add rolls (like sale
line items); each allocation shows its value (meters x rate); any
allocation reflects live in Purchase Stock immediately upon confirming
this step (commit the stock_ledger write on "Next," not on each
individual roll add, to avoid orphaned entries from add-then-remove
within the same step).
Verify: Search by roll number and by supplier name both work and show
shade; add 2 rolls, click Next, confirm Purchase Stock reflects the
deduction immediately.
Wiring check: navigate to the actual Purchase Stock screen after
completing this step and confirm the numbers really changed there.

### TASK-3.2 — Step 2: Basic Details (existing screen, extended)
status: TODO
depends_on: [TASK-3.1]
Scope: Keep existing fields (Brand, Design, Lot No., Lot Date, Season/
Collection, Buyer/Order optional, Target Dispatch Date). Add: Garment
Type (new dropdown, drives Step 6), Design Type/fit-style (slim-fit,
baggy, straight-fit, surgery, etc. — small lookup table, user-
manageable), Lot Name (separate from system Lot No., used for
search), and change Colour from a single dropdown to a multi-select/
repeatable "+ Add colour" field. Target Dispatch Date auto-defaults
from Lot Date + the Master Data target-days setting (add
default_production_target_days setting if absent, default 90),
remains editable.
Verify: Selecting a Design pulls through its Category/Size Set from
the Designs catalog (TASK-1.4) to help populate downstream fields;
multiple colours can be added; Garment Type selection is required.
Wiring check: confirm selecting a Design here actually reads from the
real Designs table, not a separate hardcoded list.

### TASK-3.3 — Step 3: Lot Specifications (existing screen, currently empty — build fresh)
status: TODO
depends_on: [TASK-3.2]
Scope: This step currently has no fields. Build: Additional Details
(optional free text), Design Reference (text + photo upload, multiple
photos allowed, Cloudflare R2), Custom Q&A (repeatable
question/answer pairs, stored as jsonb).
Verify: Enter a design reference photo + text, add 2 custom Q&A pairs,
confirm they persist through to Step 7's review.

### TASK-3.4 — Step 4: Size Set & Quantity (existing screen, extended for multi-colour)
status: TODO
depends_on: [TASK-3.3]
Scope: Keep existing per-size grid pattern (Size as column header,
Qty(Pcs) input row, auto-summed Total, "Load Size Template" dropdown,
"+Add Custom Size"). Add: one grid per colour selected in Step 2 (not
just one flat grid); wire up the "Use same for all colours" checkbox
so that when checked, one grid's quantities apply to every colour,
and when unchecked, each colour has its own independent grid. Add:
Average Meter Calculation — manual input (e.g. 1.6) + a read-only
suggested average (computed from historical lots of the same design
type/size template if available, else null); pieces-per-size
auto-calculated from allocated meters / avg meter, distributed by the
size template's default ratio, remaining manually editable after.
Total Quantity for the lot = sum across all colour grids.
Verify: With 2 colours and "Use same for all colours" unchecked, each
colour's grid is independently editable and the lot Total Quantity
sums both; with it checked, editing one grid updates the effective
quantity for all colours; entering avg meter 1.6 with 300m allocated
produces the correct auto-calculated piece counts. TASK-0.4's
numeric-field fix applies to every Qty(Pcs) input here (confirmed
example of the bug was on this exact screen).

### TASK-3.5 — Step 5: Assign Stages (existing screen, extended)
status: TODO
depends_on: [TASK-3.4, TASK-1.2b, TASK-0.3a]
Scope: Keep existing Production Template selection. Add: per-stage
worker assignment — for each stage in the selected template, show a
worker dropdown filtered to parties where party_type='worker' AND
stage_specialty includes this stage.
Verify: Selecting a template with a "Cutting" stage shows only
workers tagged for Cutting in that stage's dropdown.
Wiring check: this assignment must actually be readable later by
TASK-4.1 (Stage Entries worker pre-fill) — confirm the data model
supports that lookup.

### TASK-3.6 — Step 6: Design Spec Sheet (new step)
status: TODO
depends_on: [TASK-3.5, TASK-1.7]
Scope: Look up the Design Spec Template matching the Garment Type
selected in Step 2 (TASK-3.2); render that template's field list as a
blank form; user fills in fresh values for this specific lot (not
stored on the Design master record). Editable after initial entry and
printable (print-view or PDF export).
Verify: A Jeans-type lot renders the Jeans template's fields; a
Jacket-type lot (if Garment Type = Jacket) renders a different field
set; filled values are editable and can be printed/exported.

### TASK-3.7 — Step 7: Review & Create (existing screen, extended)
status: TODO
depends_on: [TASK-3.6]
Scope: Summary block for each of Steps 1-6. Each block must be
clickable and jump back to that exact step for editing (not just a
read-only summary), per explicit user request for easier correction
before final submission.
Verify: Click the Basic Details summary block from Step 7 and confirm
it navigates back to Step 2 with existing data intact; same for every
other step's block.

### TASK-3.8 — Costing tab on Lot Detail page (NOT a wizard step)
status: TODO
depends_on: [TASK-3.7, TASK-4.1]
Scope: Live-updating tab on the Lot Detail page (alongside Production
Stages Progress and Stage Entries Logs). Fabric cost: itemized,
per-roll breakdown (Option B) — e.g. "Roll A: 300m x Rs100 = Rs30,000
/ Roll B: 150m x Rs120 = Rs18,000 / Total fabric cost: Rs48,000."
Labor cost: sums the RATE column from actual logged Stage Entries as
they come in (accrues progressively, not all known at lot creation).
Accessory costs and other misc expenses also itemized. Per-piece cost
= total lot cost / total pieces (summed across colourways). Total lot
cost displayed alongside per-piece cost.
Verify: Create a test lot with 2 allocated rolls at different rates;
confirm the fabric cost breakdown shows both rolls separately with
correct math, not a blended average; log a stage entry with a rate
and confirm labor cost on this tab updates without needing a page
reload beyond a natural refresh.
Wiring check: confirm this tab pulls real data from stock_ledger
(fabric) and stage_entries (labor), not hardcoded/mock figures.

### TASK-3.9 — "Move to Stock" action + finished_goods_stock + stock_ledger write
status: TODO
depends_on: [TASK-3.8, TASK-0.1e]
Verify: Complete all stages on a test lot, click Move to Stock, enter
a design number, confirm finished stock screen shows the new entry
with correct quantity across all colourways.
Wiring check: confirm the finished stock screen (a real, separate
screen) actually shows this new entry, not just an internal flag on
the lot record.

---
## PHASE 4 — Stage Entries

### TASK-4.1 — Worker default-but-editable pre-fill from Step 5 assignment
status: TODO
depends_on: [TASK-3.5]
Scope: Stage entry form pre-fills the worker field from whichever
worker(s) were assigned to that lot+stage in Step 5, but the field
stays fully editable — the user can swap to a different worker at the
point of logging the entry (e.g. the assigned worker didn't show up).
This is NOT read-only.
Verify: Open a stage entry for a lot with an assigned worker; confirm
the worker field is pre-filled but changeable; change it and confirm
it saves the override without affecting the original Step 5
assignment record.

### TASK-4.2 — Stage Entries: search by lot number/name
status: TODO
depends_on: []

### TASK-4.3 — Stage Entries: optional finished-goods photo upload
status: TODO
depends_on: []

### TASK-4.4 — Stage Entries: Move-to-Stock button (links to TASK-3.9 action)
status: TODO
depends_on: [TASK-3.9]

---
## PHASE 5 — Sales & Billing Bug Fix

### TASK-5.1 — Fix Sales Bill Save & Next blocked after Step 3
status: TODO
depends_on: []
Scope: Reproduce first (do not guess-patch). Check: validation gate on
Step 3->4 transition, missing state/props into Step 4, broken
conditional render.
Verify: Full sales bill creation completes through all steps in one
test run.
```

---

## 1.4 How to run this

1. Save `LOOP.md`, `STATE.md`, `TASKS.md` at the repo root (or wherever your agent harness reads from), plus this whole document as the Part 2 reference the agent can open when a task points to it.
2. Each loop iteration: fresh agent session -> feed it `LOOP.md` verbatim -> it reads `STATE.md` + `TASKS.md` -> does one task -> commits -> updates both files -> stops.
3. Re-invoke the loop repeatedly until every task is `DONE` or correctly `BLOCKED-NEEDS-INPUT`.
4. Periodically check `STATE.md`'s "Open Questions" and "Blocked" sections for anything that needs your decision. Answer, then add the decision under "Confirmed decisions" so future iterations pick it up automatically.
5. Every task's `Verify` (including any `Wiring check`) is a hard gate — a task can't be marked `DONE` on a hallucinated success.

---

# PART 2 — FULL SPECIFICATION

**Stack reminder:** Next.js 14 (App Router), Supabase/PostgreSQL with RLS, `business_id` on every table, soft delete via `deleted_at`, optimistic locking via `updated_at`, Cloudflare R2 for file storage, TanStack Query for data fetching, design system locked (sidebar `#0F1629`, primary `#6366F1`, Hanken Grotesk), UI conventions per real screenshots as described in STATE.md above (stepper, cards, detail-page layout, list-page layout).

**Ground rule for existing in-progress Production Lots:** they will be migrated to the new 7-step structure. This is a testing-phase system — if migration breaks a test lot, it is acceptable to delete and recreate it.

## Phase 0 — Shared Infrastructure & Global Bug Fixes

- **Central Stock Ledger**: single append-only `stock_ledger` table as the sole source of truth for all stock quantity/value, replacing any ad hoc per-screen stock mutation. Every write path (purchase, return, production allocation, production output) inserts a ledger row instead of updating a number directly.
- **Units of Measure**: simple CRUD (name, abbreviation, base unit, conversion factor).
- **Workers -> Parties merge**: workers become `party_type='worker'` with `stage_specialty[]`, `wage_type`, `wage_rate`. Old `workers` table renamed, not dropped, until confirmed correct.
- **Numeric input default-zero bug (global)**: confirmed via the real Design form screenshot ("TARGET SALE PRICE" showing a literal "0" that doesn't clear on typing) and the Size Set & Quantity screenshot (every Qty(Pcs) box shows "0" the same way). This must be fixed as a shared/reusable numeric input component, applied everywhere numeric fields appear, not patched field-by-field.
- **Row-click-to-open-detail bug (global)**: confirmed via the Parties screenshot — only the display name text (e.g. "akshat") is clickable; the rest of the row does nothing. Fix: whole row clickable, action icons use stopPropagation.
- **Payment method + account tagging**: prerequisite for Bank/UPI detail pages showing real transaction logs. Must support Bank Transfer, UPI, Cash, and Cheque as payment methods, with account/UPI-ID linkage only where applicable (null for Cash/Cheque, which is correct, not missing data).

## Phase 1 — Master Data Fixes

- **Detail pages** for Brands, Godowns, GST Rates, Bank Accounts, UPI, Raw Materials — shared header + entity-specific body section (see the full list under STATE.md's "Same conditional-section pattern applies to ALL detail pages").
- **Production Stage Templates restructure**: `production_templates` table, `production_stages` gets `template_id` + `order_index`. Template detail page shows its ordered, reorderable stage list.
- **Raw Material Type**: removed as its own Master Data screen; becomes an inline "+ add new type" option inside the Raw Material form's dropdown.
- **Design form**: confirmed full field list per the real screenshot — Design/Style Name, Associated Brand, Design Number (auto-gen), Sizing Scale (Size Set), Category, Sub-Category, Collection/Season, HSN Code, Style Notes & Description, Active Catalog Item toggle, Design Image Gallery, Colour Swatches & Thumbnails. Target Demographics and Target Sale Price removed from the form (DB columns kept, deprecated).
- **Parties/Workers cleanup**: removed from Master Data nav entirely (Parties already exists as its own top-level module; Workers merges into it as a filtered party type).
- **Units screen**: implemented (was previously missing entirely).
- **Garment Types (new)**: simple CRUD list (Jeans, Jacket, Shirt, etc.), drives which Design Spec Template applies during Lot creation.
- **Design Spec Templates (new)**: one template per Garment Type; admin defines a flat, ordered list of fields (name, type: text/textarea/dropdown/photo) used to render Lot Step 6.

## Phase 2 — Parties Module + Raw Material Purchase/Return

- **Party enhancements**: editable post-creation, multiple contact numbers, GST/PAN auto-default (URP/N-A) when blank, search by city/state, free-text comments.
- **Party detail page**: shared header (name, code, contact numbers, GST/PAN, comments) + a body section conditional on `party_type` — Supplier shows Purchase History, Customer shows Sales History, Worker shows Stage Assignments. This is the same "shared header, conditional body" pattern used across all detail pages in this plan.
- **Purchase form rework**: inline supplier creation, search-as-you-type supplier combobox, custom bill number (searchable), roll-wise line items with auto-summed meters — each roll capturing `roll_number` (required), `meters` (required), `shade` (required), `comment` (optional), `width` (optional), and an optional `weight_unit` ('oz'|'gsm') + `weight_value` pair — Remarks moved below the items table, and per-line-item type toggle (accessory/fabric) so a single bill can mix both.
- **Purchase Return rework**: roll-specific returns (select the source bill, then the specific roll(s) from that bill), optional reason field, required bill linkage, and full visibility on both the bill detail page (adjusted value, "Returned" indicator) and the Party Ledger (credit note if the bill was already paid).
- **Purchase Stock**: renamed from "Stock," reflects every purchase/return/production-allocation transaction live via the central stock ledger.

## Phase 3 — Production Lot Rebuild

Rebuilt as the real 7-step flow (matching your actual screen names), rather than an invented step numbering:

1. **Roll Allocation** (new) — search/select purchase rolls by roll number or supplier name, showing in-stock status, remaining meters, and shade; multi-add like sale line items; live stock deduction; allocated value shown per roll.
2. **Basic Details** (existing, extended) — Brand, Design (pulling Category/Size Set from the Designs catalog), Lot No. (auto-gen + editable), Lot Date, multi-colour selection, Season/Collection, Buyer/Order, Target Dispatch Date (auto-default from Master Data's target-days setting), plus new: Garment Type, Design Type/fit-style, Lot Name.
3. **Lot Specifications** (existing, currently empty, built fresh) — Additional Details, Design Reference (text + photo), Custom Q&A fields.
4. **Size Set & Quantity** (existing, extended) — per-colour size/quantity grids (with a working "Use same for all colours" toggle), Average Meter Calculation (manual + suggested), auto-calculated pieces-per-size (editable).
5. **Assign Stages** (existing, extended) — Production Template selection, per-stage worker assignment filtered to stage-tagged workers.
6. **Design Spec Sheet** (new) — garment-type-driven flexible field list, filled fresh per lot, editable and printable.
7. **Review & Create** (existing, extended) — summary blocks for every prior step, each clickable to jump back and edit before final submission.

**Costing** is a live-updating tab on the Lot Detail page (not a wizard step): itemized, exact per-roll fabric cost breakdown (Option B — e.g. "Roll A: 300m × ₹100 = ₹30,000 / Roll B: 150m × ₹120 = ₹18,000 / Total: ₹48,000"), plus labor cost accruing from real logged Stage Entries, plus accessory/other costs, rolled up to per-piece and total-lot figures.

**Finished stock linkage**: an explicit "Move to Stock" action (not automatic on stage completion) requiring a custom design number, writing to `finished_goods_stock` and the stock ledger.

## Phase 4 — Stage Entries

- Worker field pre-fills from the Assign Stages (Step 5) assignment but remains editable, not locked.
- Search by lot number/name.
- Optional finished-goods photo upload.
- "Move to Stock" button, wired to the Phase 3 action.
- Stage reorganization (old item xxxvii): explicitly skipped this round.

## Phase 5 — Sales & Billing Bug Fix

- Reproduce and fix the "Save & Next" failure blocking progression past Step 3 in sales bill creation.

## Cross-Cutting Wiring Requirement (explicit, per user instruction)

Every module above must be built as a *connected* system, not isolated screens:

- Roll Allocation's stock deduction must show up on the real Purchase Stock screen.
- Assign Stages' worker assignment must actually pre-fill in Stage Entries.
- Basic Details' Design selection must pull real data from the Designs catalog.
- Design Spec Sheet's field list must be driven by the real Garment Type + Design Spec Template records, not hardcoded.
- Costing must pull real numbers from the stock ledger and real logged Stage Entries, not placeholder math.
- Move to Stock must produce a visible entry on the actual finished stock screen.
- Bank/UPI detail pages must query real payment records once the payment-method prerequisite is built.
- Party detail page's conditional sections must query real purchase/sales/assignment records per party, not stub data.

A task is not complete if it "works" in isolation but doesn't actually connect to the downstream or upstream screen/module it's meant to feed — this is called out explicitly as a "Wiring check" in each relevant task in Part 1.
