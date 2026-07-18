# TAS ERP — Phase 7 Implementation Plan (Looping Methodology)
**Payments & Finance | Weeks 14–16 | Loop-Driven Execution**

> ⚠️ AGENT INSTRUCTION: Same protocol as Phase 6 — each loop is build → self-verify → report → gate before the next loop starts. Reference screens were provided as design direction, not pixel law — deviate where a pattern from an earlier phase fits better, but stay within the established design system (colors, spacing, badge styles).

---

## Table of Contents
1. [Loop Execution Protocol (recap)](#1-loop-execution-protocol-recap)
2. [Phase 7 Design Decisions](#2-phase-7-design-decisions)
3. [Design System Additions](#3-design-system-additions)
4. [Database Schema](#4-database-schema)
5. [LOOP 0 — Foundation](#loop-0--foundation)
6. [LOOP 1 — Party Ledger (Completed Version)](#loop-1--party-ledger-completed-version)
7. [LOOP 2 — Receive Payment](#loop-2--receive-payment)
8. [LOOP 3 — Make Payment](#loop-3--make-payment)
9. [LOOP 4 — Advance Payments](#loop-4--advance-payments)
10. [LOOP 5 — Direct Payment Linking](#loop-5--direct-payment-linking)
11. [LOOP 6 — Write-offs](#loop-6--write-offs)
12. [LOOP 7 — Expenses + Misc Income](#loop-7--expenses--misc-income)
13. [LOOP 8 — Salary + Employee Advances](#loop-8--salary--employee-advances)
14. [LOOP 9 — Balance Sheet](#loop-9--balance-sheet)
15. [LOOP 10 — Profit & Loss Statement](#loop-10--profit--loss-statement)
16. [LOOP 11 — GST Summary](#loop-11--gst-summary)
17. [LOOP 12 — Remaining Reports](#loop-12--remaining-reports-cash-flow-stock-valuation-party-statement-production-sales)
18. [LOOP 13 — Reminders & WhatsApp](#loop-13--reminders--whatsapp)
19. [Final Completion Checklist](#19-final-completion-checklist)

---

## 1. Loop Execution Protocol (recap)

```
STEP 1 — READ SCOPE (this loop only)
STEP 2 — BUILD
STEP 3 — SELF-VERIFY against the loop's checklist
STEP 4 — REPORT "Loop N complete. Checklist: X/Y. Issues: [...]"
STEP 5 — GATE — do not start next loop until current loop is green
```

---

## 2. Phase 7 Design Decisions

### 2.1 Sidebar Section Confirmed
From your reference screens, the sidebar groups everything under **Payments & Finance**:
```
Payments & Finance ▾
  Party Ledger
  Payments ▾
    Receive Payment
    Make Payment
    Advance Payments
    Direct Payment Linking
  Write-offs
  Expenses
  Misc Income
  Salary
  Reports ▾
    Balance Sheet
    Profit & Loss
    GST Summary
    Cash Flow
    Stock Valuation
    Party Statement
  Reminders & WhatsApp
```

### 2.2 Reports Header Pattern (new, consistent across all 6 report screens)
```
Title + Info icon (ⓘ, opens tooltip explaining the report) | Breadcrumb
Header buttons: Export PDF | Export Excel | Print | Filters (primary)
Filter row: Financial Year | From/To Date (or As On Date) | Compare With | Apply | Clear
```
This exact header pattern repeats on every financial report — build it once as `ReportPageHeader` and reuse.

### 2.3 Multi-Bill Payment Allocation Pattern (Receive/Make Payment)
Confirmed from your screens — this is the core UX for both Receive and Make Payment:
```
3-column top section: Party Details | Payment Details | Additional Details
Below: Outstanding Bills table with checkbox + editable "Allocate (₹)" column per row
  Live "Balance After Allocation" column updates per row
  Footer: Total Allocated | Unallocated Amount (must reach ₹0.00 or explicitly left as advance)
Bottom: Payment Summary card mirrors the totals
```

### 2.4 Report "Key Insights" / "Notes" Pattern (new)
Every financial report ends with an auto-generated insights card — bullet list of computed observations (e.g., "Net profit increased by 33.86% compared to same period last year"). This is computed server-side from comparing current vs. prior period data, not hardcoded text.

### 2.5 Reuse vs New Decisions
| Component | Decision |
|---|---|
| Party Ledger | Extend Phase 3's version — add Payment/Advance/Write-off row types, don't rebuild |
| Stat cards | Reuse Phase 1 pattern (icon + value + sub-label) |
| Filter bar | Reuse Phase 3 pattern |
| Donut/Bar charts | Reuse Phase 4/5 Recharts setup |
| AsyncButton | Use for all Save/Record/Process buttons (Phase Experience Framework) |
| PageState | Use for all loading/empty/error states (Phase Experience Framework) |

---

## 3. Design System Additions

```css
/* Ledger entry type badges (extends Phase 3 set) */
--badge-payment-bg: #DCFCE7;     --badge-payment-text: #15803D;
--badge-advance-bg: #DBEAFE;     --badge-advance-text: #1D4ED8;
--badge-writeoff-bg: #F1F5F9;    --badge-writeoff-text: #64748B;

/* Financial report trend indicators */
--trend-up-color: #15803D;
--trend-down-color: #DC2626;
--trend-neutral-color: #64748B;

/* Balance sheet section colors */
--bs-assets-color: #15803D;
--bs-liabilities-color: #DC2626;
--bs-equity-color: #1D4ED8;

/* GST status badges */
--gst-filed-bg: #DCFCE7;    --gst-filed-text: #15803D;
--gst-pending-bg: #FEF3C7;  --gst-pending-text: #D97706;
--gst-upcoming-bg: #F1F5F9; --gst-upcoming-text: #64748B;

/* Key Ratio benchmark indicator */
--ratio-good-bg: #DCFCE7;   --ratio-good-text: #15803D;
--ratio-warn-bg: #FEF3C7;   --ratio-warn-text: #D97706;
--ratio-poor-bg: #FEE2E2;   --ratio-poor-text: #DC2626;

/* Allocation table row states */
--alloc-fulfilled-color: #15803D;  /* balance after allocation = 0 */
--alloc-partial-color: #DC2626;    /* balance remains */
```

**ReportPageHeader component (Section 2.2 pattern) — build once, reuse 6×:**
```tsx
<ReportPageHeader
  title="Balance Sheet"
  infoTooltip="Shows assets, liabilities and equity as on a selected date."
  breadcrumbs={['Reports','Financial Reports','Balance Sheet']}
  filters={<FinancialYearDateFilters ... />}
  onExportPDF={...} onExportExcel={...} onPrint={...}
/>
```

---

## 4. Database Schema

```sql
-- Payments (unified — receive & pay, customer & supplier & worker)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('received','paid')),
  party_id UUID NOT NULL REFERENCES parties(id),
  contact_person TEXT,
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash','bank_transfer','upi','cheque','neft','rtgs')),
  reference_no TEXT,
  cheque_utr_ref_date DATE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  amount NUMERIC(15,2) NOT NULL,
  unallocated_amount NUMERIC(15,2) DEFAULT 0, -- becomes advance if > 0
  is_advance BOOLEAN DEFAULT false,
  remarks TEXT,
  attachments TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('draft','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, payment_number)
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Payment allocations (which bills this payment was applied to)
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('sale_bill','purchase_bill','raw_material_purchase','job_work_entry')),
  bill_id UUID NOT NULL, -- polymorphic reference, resolved by bill_type
  allocated_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON payment_allocations
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Advance payments (tracked separately for advance-specific views)
CREATE TABLE advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  advance_amount NUMERIC(15,2) NOT NULL,
  settled_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON advance_payments
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Direct payment links (sold to A, paid worker directly from that receipt)
CREATE TABLE direct_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_payment_id UUID NOT NULL REFERENCES payments(id), -- the money received
  target_payment_id UUID NOT NULL REFERENCES payments(id), -- the money paid out using it
  linked_amount NUMERIC(15,2) NOT NULL,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE direct_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON direct_payment_links
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Write-offs
CREATE TABLE write_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('sale_bill','purchase_bill','raw_material_purchase')),
  bill_id UUID NOT NULL,
  write_off_type TEXT NOT NULL CHECK (write_off_type IN ('loss','gain','nil')),
  amount NUMERIC(15,2) NOT NULL,
  remarks TEXT NOT NULL,
  written_off_by UUID REFERENCES users(id),
  written_off_at TIMESTAMPTZ DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT
);
ALTER TABLE write_offs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON write_offs
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Expenses (extends Phase 1 expense_types)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expense_number TEXT NOT NULL,
  expense_type_id UUID NOT NULL REFERENCES expense_types(id),
  expense_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  paid_from_account_id UUID REFERENCES bank_accounts(id),
  vendor_name TEXT,
  vendor_invoice_no TEXT,
  notes TEXT,
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, expense_number)
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Misc income
CREATE TABLE misc_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  income_number TEXT NOT NULL,
  income_type TEXT NOT NULL CHECK (income_type IN ('scrap_sale','machinery_rental','commission','other')),
  income_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  received_in_account_id UUID REFERENCES bank_accounts(id),
  party_id UUID REFERENCES parties(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, income_number)
);
ALTER TABLE misc_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON misc_income
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Salary entries
CREATE TABLE salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES workers(id), -- permanent workers from Phase 4
  salary_month INTEGER NOT NULL CHECK (salary_month BETWEEN 1 AND 12),
  salary_year INTEGER NOT NULL,
  gross_salary NUMERIC(12,2) NOT NULL,
  advance_deducted NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  deduction_reason TEXT,
  net_salary NUMERIC(12,2) NOT NULL,
  paid_from_account_id UUID REFERENCES bank_accounts(id),
  payment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processed','paid')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, employee_id, salary_month, salary_year)
);
ALTER TABLE salary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON salary_entries
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Employee advances (separate from job-work worker advances in Phase 4)
CREATE TABLE employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES workers(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  mode TEXT,
  notes TEXT,
  is_settled BOOLEAN DEFAULT false,
  settled_in_salary_id UUID REFERENCES salary_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON employee_advances
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- Reminder rules (extends Phase 2 notification_rules with WhatsApp specifics)
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('bill_share','payment_reminder','overdue_reminder','pdc_reminder')),
  template_text TEXT NOT NULL, -- supports {{variables}}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, template_type)
);
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON whatsapp_templates
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
```

### Required SQL Aggregate Functions (Performance Strategy compliance)
```sql
-- Single-call balance sheet computation (avoids N sequential queries)
CREATE OR REPLACE FUNCTION get_balance_sheet(p_business_id UUID, p_as_on_date DATE)
RETURNS JSON AS $$
-- Aggregates: non-current assets, current assets, equity, non-current liabilities,
-- current liabilities — from finished_stock, raw_material_current_stock, sale_bills,
-- raw_material_purchases, bank_accounts, payments, expenses
-- Returns one JSON object consumed directly by the Balance Sheet page
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Single-call P&L computation
CREATE OR REPLACE FUNCTION get_profit_loss(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
-- Aggregates: sales revenue, other income, raw material consumed, direct wages,
-- overheads, all expense categories — grouped by expense_type
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Single-call GST summary computation
CREATE OR REPLACE FUNCTION get_gst_summary(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
-- Aggregates output tax (sale_bills by gst_percent), input tax (raw_material_purchases
-- by gst_percent), nets credit_notes and debit_notes
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## LOOP 0 — Foundation

**Scope:** DB setup, sidebar restructure, ReportPageHeader component, allocation table component, financial calculation utilities.

### Tasks
1. Run all Section 4 SQL + 3 aggregate functions in Supabase
2. Restructure sidebar: add Payments & Finance section per 2.1
3. Build `ReportPageHeader` component (Section 2.2/3 pattern)
4. Build `BillAllocationTable` component (shared by Receive Payment + Make Payment):
   ```tsx
   <BillAllocationTable
     bills={outstandingBills}
     paymentAmount={enteredAmount}
     onAllocationChange={(allocations) => ...}
   />
   // Renders checkbox + Allocate(₹) input + live Balance After Allocation per row
   // Auto-distributes payment amount across checked bills oldest-first, user can override
   ```
5. Build `FinancialYearDateFilters` component (Financial Year select + From/To or As On Date + Compare With + Apply/Clear)
6. Build `InsightsCard` component (auto-generated bullet observations, Section 2.4)
7. Build `KeyRatioBadge` component (good/warn/poor indicator, Section 3 ratio tokens)

### Verification Checklist
- [ ] All Section 4 tables + 3 aggregate functions created, RLS active
- [ ] Sidebar shows Payments & Finance with all sub-items per 2.1
- [ ] ReportPageHeader renders consistently (test with placeholder report)
- [ ] BillAllocationTable: checking a bill auto-allocates remaining payment amount oldest-first
- [ ] BillAllocationTable: manually editing Allocate(₹) updates Balance After Allocation live
- [ ] Total Allocated + Unallocated Amount always sum to Payment Amount

**🛑 GATE before Loop 1.**

---

## LOOP 1 — Party Ledger (Completed Version)

**Scope:** Extend Phase 3's `/parties/[id]/ledger` to include Payment, Advance, and Write-off row types.

### Spec
```
Same page from Phase 3 — ADD:
  Ledger Type filter dropdown gains: Payment | Advance | Write-off (alongside existing Purchase/Return)
  New row type badges:
    Payment:    bg-[#DCFCE7] text-[#15803D]
    Advance:    bg-[#DBEAFE] text-[#1D4ED8]
    Write-off:  bg-[#F1F5F9] text-[#64748B]
  New "Linked Bills" expandable column — click row to see which bills a payment was allocated across
  Summary header KPIs gain: "Advance Balance" card if party has unsettled advances
```

### Verification Checklist
- [ ] All 3 new row types render with correct badges in existing ledger table
- [ ] Clicking a Payment row expands to show its bill allocations
- [ ] Advance Balance KPI only shows when party has `advance_payments.remaining_amount > 0`
- [ ] Write-off rows show correct sign (reduces receivable without cash movement)
- [ ] Existing Phase 3 functionality (Purchase/Return rows) unaffected

**🛑 GATE before Loop 2.**

---

## LOOP 2 — Receive Payment

**Scope:** `/payments/receive` (per your reference screen)

### Spec
```
Page title: "Receive Payment" | Header: Cancel + Save as Draft + Save & Record(primary, AsyncButton)

3-column top (grid-cols-3):
  Party Details: Customer*(select) | Contact Person | Phone | Balance(₹, Dr/Cr colored)
  Payment Details: Payment Date* | Payment No.(auto) | Payment Mode*(select) | Reference No.
                   | Bank Account*(hidden if Cash) | Amount Received(₹)*
  Additional Details: Cheque/UTR/Ref Date | Remarks | Attachments(upload)

"Allocate to Outstanding Bills" section:
  Search by Invoice No. + "Show Fully Paid Bills" checkbox
  Uses BillAllocationTable component from Loop 0
  Columns: ☐ | Invoice No.(link) | Invoice Date | Due Date | Total(₹) | Outstanding(₹) |
    Allocate(₹, editable) | Balance After Allocation(₹, green if 0, red if remaining)
  Footer: Total Allocated | Unallocated Amount(green if 0)

Info banner: "Select one or more invoices and allocate the received amount. The payment will be adjusted against the selected invoices."

Payment Summary card (bottom-right): Amount Received | Total Allocated | Unallocated Amount |
  Payment Mode | Reference No. | Bank Account — mirrors entered data for final review
```

### Save Logic
```ts
// If Unallocated Amount > 0 after save → creates advance_payments record automatically
// User is NOT blocked from saving with unallocated amount — it becomes an advance
async function handleSavePayment() {
  // 1. Insert payments row
  // 2. Insert payment_allocations rows (one per checked bill)
  // 3. Update sale_bills.paid_amount + payment_status for each allocated bill
  // 4. If unallocated_amount > 0: insert advance_payments row
  // 5. Toast + redirect to party ledger or payments list
}
```

### Verification Checklist
- [ ] Selecting Customer auto-fills Contact Person, Phone, Balance
- [ ] Bank Account field hides when Payment Mode = Cash
- [ ] Outstanding Bills table populates from selected customer's unpaid/partial sale_bills
- [ ] "Show Fully Paid Bills" toggles visibility of zero-outstanding bills
- [ ] Allocation auto-distributes oldest-first when amount entered, user can manually override per row
- [ ] Unallocated Amount > 0 doesn't block save — creates advance instead
- [ ] Saving updates all allocated bills' paid_amount and payment_status correctly
- [ ] Payment Summary card mirrors live data accurately

**🛑 GATE before Loop 3.**

---

## LOOP 3 — Make Payment

**Scope:** `/payments/make` — supplier/worker payment, mirror of Loop 2 with direction reversed.

### Spec (condensed — same layout as Receive Payment)
```
Identical structure to Loop 2, but:
  "Party Details" → Supplier/Worker* (select from parties where type includes supplier, or workers)
  Allocates against: raw_material_purchases (Phase 3) + purchase_bills (Phase 6) + stage_entries (Phase 4 job work)
  Allocation table shows a "Type" column distinguishing bill source (Raw Material / Finished Goods / Job Work)
```

### Verification Checklist
- [ ] Party selector includes both parties (suppliers) and workers (job workers)
- [ ] Allocation table correctly pulls outstanding items from 3 different source tables
- [ ] Type column correctly labels each outstanding item's source
- [ ] Saving updates the correct source table (raw_material_purchases / purchase_bills / stage_entries) based on Type
- [ ] Unallocated amount creates outgoing advance correctly

**🛑 GATE before Loop 4.**

---

## LOOP 4 — Advance Payments

**Scope:** `/payments/advances` — tracker for all given/received advances and their settlement.

### Spec
```
Page title: "Advance Payments" | Header: + Record Advance(primary)

Tabs: Given (to suppliers/workers) | Received (from customers)

Stat cards: Total Advances | Settled | Unsettled | This Month

Table: Party | Date | Amount | Settled Amount | Remaining | Status(badge) | Action
  Status: Settled=green | Partially Settled=orange | Unsettled=red

Settle action (⋮ menu → "Settle Advance"):
  Opens modal: shows remaining advance amount, lets user pick which new bill to apply it to
  (reuses BillAllocationTable in single-bill mode, or simple select if only 1 bill)
```

### Verification Checklist
- [ ] Given/Received tabs filter correctly
- [ ] Settle Advance modal correctly reduces advance_payments.remaining_amount
- [ ] Settling fully sets is_settled=true and updates status badge
- [ ] Stat cards compute correctly per tab

**🛑 GATE before Loop 5.**

---

## LOOP 5 — Direct Payment Linking

**Scope:** `/payments/direct-link` — the "sold to A, pay worker directly from that receipt" flow from your original 23-point spec.

### Spec
```
Page title: "Direct Payment Linking"
Two-panel layout:
  LEFT: "Select Source Payment (Money Received)" — searchable list of recent Receive Payments
        with remaining unlinked balance shown per row
  RIGHT: "Select Target Payment (Money to Pay)" — either:
         a) Link to an EXISTING Make Payment, or
         b) Create a NEW Make Payment inline (mini-form: party, amount, mode)

Center: "Link Amount (₹)" input — capped at min(source remaining, target amount)
  Remarks field

"Create Link" button (AsyncButton) — calls direct_payment_links insert
Below: "Existing Links" table showing all direct_payment_links with source/target/amount/date
```

### Verification Checklist
- [ ] Source payment list shows only payments with unlinked remaining balance > 0
- [ ] Link Amount cannot exceed available balance on either side
- [ ] Creating a link correctly records in direct_payment_links
- [ ] Linked amount is reflected as "used" on the source payment (reduces its available-to-link balance)
- [ ] New inline target payment creation works without leaving this page

**🛑 GATE before Loop 6.**

---

## LOOP 6 — Write-offs

**Scope:** `/payments/write-offs` — list + write-off action (callable from any bill detail page)

### Spec
```
Page title: "Write-offs List"
Stat cards: Total Written Off | Loss | Gain | Nil

Table: Bill Type | Bill No.(link) | Party | Amount | Type(badge: Loss=red/Gain=green/Nil=gray) |
  Remarks | Written Off By | Date | Action(Reverse button if not yet reversed)

Write-off action (triggered from Sale Bill / Purchase Bill detail "More Actions" menu):
  Modal: Write-off Type(radio: Loss/Gain/Nil) | Amount(prefilled with outstanding) | Remarks*(required)
  Confirm dialog before executing — "This will mark ₹X as written off. Continue?"

Reverse action: requires Reversal Reason, sets reversed_at/reversed_by, restores bill's outstanding status
```

### Verification Checklist
- [ ] Write-off modal accessible from Sale Bill detail "More Actions"
- [ ] Write-off modal accessible from Purchase Bill / Raw Material Purchase detail
- [ ] Remarks is required — cannot save without it
- [ ] Writing off updates the source bill's payment_status appropriately
- [ ] Reverse restores original outstanding amount and status
- [ ] List page stat cards compute correctly

**🛑 GATE before Loop 7.**

---

## LOOP 7 — Expenses + Misc Income

**Scope:** `/expenses` list+add, `/misc-income` list+add (from your reference screen)

### Spec (condensed — standard list/form pattern, no new component patterns needed)
```
Expenses: stat cards (Total This Month/Pending/Paid) + filter bar + table
  Add Expense: Expense Type*(from Phase 1 expense_types) | Date | Amount | GST% | 
    Paid From Account | Vendor Name | Vendor Invoice No. | Notes | Attachment

Misc Income: same pattern, Income Type select instead of Expense Type
```

### Verification Checklist
- [ ] Expense Type dropdown populated from Phase 1's expense_types table
- [ ] GST% auto-calculates GST Amount
- [ ] Both pages follow identical list/stat-card/filter pattern as established in Phase 3

**🛑 GATE before Loop 8.**

---

## LOOP 8 — Salary + Employee Advances

**Scope:** `/salary` list, `/salary/process` (with advance deduction), `/salary/advances` tracker

### Process Salary Spec (from your reference screen)
```
Page title: "Process Salary"
Top: Month/Year selector | Employee filter (or "Process All")

Per-employee row (or single employee if processing individually):
  Employee info | Gross Salary(auto from workers.default_rate or fixed) |
  Pending Advances(shows list of unsettled employee_advances for this employee, checkboxes to deduct) |
  Advance Deducted(₹, sum of checked advances) | Other Deductions(₹, manual) | Deduction Reason |
  Net Salary(computed: Gross - Advance Deducted - Other Deductions) | Paid From Account | Payment Date

"Process & Pay" button (AsyncButton) — marks salary_entries.status='paid',
  marks linked employee_advances.is_settled=true
```

### Verification Checklist
- [ ] Pending Advances list shows only unsettled employee_advances for selected employee
- [ ] Checking advances to deduct live-updates Net Salary
- [ ] Net Salary never goes negative (validation: deductions capped at gross salary)
- [ ] Processing salary marks linked advances as settled
- [ ] Employee Advance Tracker page lists all advances with settlement status

**🛑 GATE before Loop 9.**

---

## LOOP 9 — Balance Sheet

**Scope:** `/reports/balance-sheet` (from your reference screen — this is the most structurally complex report)

### Spec
```
Uses ReportPageHeader with: Financial Year | As on Date | Compare With | Show Zero Balance toggle

Top: "Total Assets = Total Liabilities + Equity" verification banner (2 cards joined by =)

Two-column main table:
  LEFT "ASSETS": 1. Non-Current Assets (PPE/Intangible/Investments/Long Term Loans) +
                 2. Current Assets (Inventories/Receivables/Cash & Bank/Short Term Loans/Other)
                 Each line: Particulars | Note(#) | Amount(₹) | % of Total
                 Section subtotals bold, TOTAL ASSETS bold+bordered at bottom
  RIGHT "LIABILITIES AND EQUITY": 1. Equity + 2. Non-Current Liabilities + 3. Current Liabilities
                 Same structure, TOTAL LIABILITIES & EQUITY at bottom

Below table: Account Notes (expandable numbered list, links to note details) |
  Key Insights (InsightsCard from Loop 0) | Comparative Summary table (if Compare With selected)

Right sidebar: Balance Sheet Summary (Total Assets/Liabilities/Equity/Working Capital/
  Current Ratio/Debt-Equity Ratio) | Assets Composition donut | Liabilities & Equity Composition donut
```

### Data Source Mapping (for the get_balance_sheet() function)
```
Current Assets:
  Inventories → SUM(finished_stock.total_value) + SUM(raw_material_current_stock.stock_value)
  Trade Receivables → SUM(sale_bills.grand_total - sale_bills.paid_amount) WHERE payment_status != 'paid'
  Cash & Bank → SUM(bank_accounts.opening_balance) + net payment movements

Current Liabilities:
  Trade Payables → SUM(raw_material_purchases.grand_total - paid_amount) + same for purchase_bills
```

### Verification Checklist
- [ ] Total Assets = Total Liabilities + Equity (the accounting identity must always balance)
- [ ] get_balance_sheet() function returns correct aggregates from real transaction data
- [ ] Account Notes expand to show line-item detail
- [ ] Compare With populates Comparative Summary table correctly
- [ ] Both donut charts render with correct percentages
- [ ] Export PDF / Export Excel produce correctly formatted files
- [ ] Show Zero Balance toggle hides/shows ₹0.00 line items

**🛑 GATE before Loop 10.**

---

## LOOP 10 — Profit & Loss Statement

**Scope:** `/reports/profit-loss` (from your reference screen)

### Spec
```
ReportPageHeader: Financial Year | From/To Date | Compare With | Apply/Clear

5 stat cards: Total Revenue | Gross Profit | Operating Profit | Net Profit | Net Profit Margin(%)
  Each shows "Last Year: ₹X" sub-line with trend arrow (↑/↓) colored green/red

Main table — 5 sections (I-V), each with This Period | Last Year | Change(₹) | Change(%) columns:
  I. INCOME (Sales Revenue, Other Income, Total Income)
  II. COST OF GOODS SOLD (Raw Material Consumed, Direct Wages, Manufacturing Overheads, Total COGS)
  Gross Profit (computed, bold) + Gross Profit Margin %
  III. EXPENSES (per expense_type category, Total Expenses)
  IV. PROFIT BEFORE TAX
  Tax Expense
  V. NET PROFIT AFTER TAX (bold, green)

Bottom: Profitability Overview combo chart (bars=Revenue/Net Profit, line=Margin%) |
  Expense Breakdown donut | Key Ratios table (with KeyRatioBadge: Good/Warning/Poor vs industry benchmark) |
  Monthly Trend chart | Income Summary table | Notes (InsightsCard)
```

### Verification Checklist
- [ ] get_profit_loss() correctly aggregates COGS from raw_material_purchases + stage_entries job work amounts
- [ ] Gross Profit = Total Income - Total COGS computed correctly
- [ ] Net Profit = Profit Before Tax - Tax Expense
- [ ] Change(%) calculations correct vs Last Year comparison
- [ ] Key Ratios show correct Good/Warning/Poor badge based on defined benchmark ranges
- [ ] Combo chart (bar+line) renders correctly with Recharts ComposedChart
- [ ] Monthly Trend chart shows correct month-by-month breakdown within the selected period

**🛑 GATE before Loop 11.**

---

## LOOP 11 — GST Summary

**Scope:** `/reports/gst-summary` (from your reference screen)

### Spec
```
ReportPageHeader: Financial Year | Return Period(select: Monthly GSTR-3B/Quarterly/Annual) |
  From/To Date | Business Location | Apply/Clear

5 stat cards: Total Sales(Taxable) | Total Purchases(Taxable) | Output Tax(Collectable) |
  Input Tax(ITC Available) | Net GST Payable

Section 1 "GST Summary Details" table:
  A. OUTPUT TAX (On Sales) — rows per GST rate (0%/5%/12%/18%/28%/CESS), columns:
     IGST(₹) | CGST(₹) | SGST/UTGST(₹) | CESS(₹) | Total(₹)
  B. INPUT TAX (ITC) — same structure for purchases
  C. NET GST PAYABLE (A-B)
  D. ADJUSTMENTS (credit/debit notes netting — shown in brackets if negative)
  E. NET GST PAYABLE (AFTER ADJUSTMENT)

Right sidebar:
  2. GST Liability Summary (Output Tax/Input Tax/Net Payable/Adjustments/Status badge: Payable)
  3. Tax Breakup (Output Tax) donut — IGST/CGST/SGST/CESS percentages
  4. Return Filing Status table: Return Type | Period | Due Date | Status(Filed=green/Pending=orange/Upcoming=gray)

Bottom: 5. Tax Summary by Rate table | 6. Top Customers(Output Tax) | 7. Top Vendors(Input Tax)
Info banner: "All amounts are in INR. This report is based on posting date and applicable GST rates."
"Report generated on: [timestamp]" + refresh icon, bottom-right
```

### Verification Checklist
- [ ] get_gst_summary() correctly nets credit_notes against output tax and debit_notes against input tax (per the Phase 6 GST adjustment requirement)
- [ ] All GST rate rows (0/5/12/18/28 + CESS) compute correctly from sale_bill_items and raw_material_purchase_items
- [ ] Net GST Payable = Output Tax - Input Tax, then adjusted by D
- [ ] Return Filing Status correctly shows GSTR-1/GSTR-3B/GSTR-9 due dates and computed status
- [ ] Top Customers / Top Vendors tables rank correctly by taxable value
- [ ] Tax Breakup donut percentages sum to 100%

**🛑 GATE before Loop 12.**

---

## LOOP 12 — Remaining Reports (Cash Flow, Stock Valuation, Party Statement, Production, Sales)

**Scope:** 5 reports, each reusing the ReportPageHeader + InsightsCard pattern established in Loops 9-11. No new UI patterns — condensed scope per loop efficiency.

### Cash Flow Report
```
3 sections: Operating Activities | Investing Activities | Financing Activities
Net Cash Flow = sum of all three. Same table structure as P&L (This Period/Last Period/Change).
```

### Stock Valuation Report
```
Reuses Phase 5 Stock Detail matrix pattern. Adds: Valuation Method indicator (FIFO/Average/Manual
from business_settings), Total Valuation stat card, by-category breakdown donut.
```

### Party Statement
```
PDF-exportable version of the Party Ledger (Loop 1) — formatted for sharing with the party.
Reuses ledger table structure, adds business letterhead header (same rule as Phase 6 bills:
firm letterhead always, never brand-specific).
```

### Production Reports / Sales Reports
```
Aggregate dashboards reusing Phase 4 (production_lots, stage_entries) and Phase 6 (sale_bills)
data respectively. Stat cards + trend charts + top-N tables, same visual language as P&L bottom section.
```

### Verification Checklist
- [ ] All 5 reports use ReportPageHeader consistently
- [ ] Cash Flow's 3-section math reconciles (Net Cash Flow matches actual bank balance change)
- [ ] Stock Valuation respects the business's configured valuation method
- [ ] Party Statement PDF uses business letterhead, exports correctly
- [ ] Production/Sales reports pull from correct Phase 4/6 source tables

**🛑 GATE before Loop 13.**

---

## LOOP 13 — Reminders & WhatsApp

**Scope:** `/reminders` (extends Phase 2 notification_rules) + `/whatsapp-templates`

### Spec
```
Reminder Rules: extends Phase 2's Notifications settings page — same table pattern,
  now also surfaces Payment Due/Overdue/PDC rules with live counts ("23 bills currently overdue")

WhatsApp Templates: list of 4 template types (bill_share/payment_reminder/overdue_reminder/pdc_reminder)
  Each: editable text area with {{variable}} placeholders (e.g. {{party_name}}, {{amount}}, {{due_date}})
  Live preview pane showing rendered sample message
  "Send Test" button (stub — opens WhatsApp Web share link with rendered text, no API integration)
```

### Verification Checklist
- [ ] Reminder Rules correctly shows live counts pulled from actual overdue/PDC data
- [ ] WhatsApp template variables render correctly in preview pane
- [ ] Send Test opens WhatsApp share link (wa.me) with pre-filled message text
- [ ] Templates save correctly to whatsapp_templates table

**🛑 FINAL GATE — proceed to Phase 7 completion review.**

---

## 19. Final Completion Checklist

- [ ] All payment flows (Receive/Make/Advance/Direct Link) tested end-to-end with real bill data
- [ ] Party Ledger correctly reflects Payment/Advance/Write-off alongside existing Purchase/Return rows
- [ ] Balance Sheet identity holds: Assets = Liabilities + Equity, tested against real seeded data
- [ ] P&L Net Profit reconciles with Balance Sheet's retained earnings movement
- [ ] GST Summary correctly nets credit/debit notes per the Phase 6 requirement
- [ ] All 6 aggregate SQL functions used (not N sequential Supabase queries) — Performance Strategy compliance verified
- [ ] AsyncButton used for every Save/Record/Process action across all loops
- [ ] PageState used for every loading/empty/error surface
- [ ] All new tables have RLS policies active
- [ ] No console errors across all screens
- [ ] Mobile responsive check on Party Ledger, Receive Payment, and Balance Sheet (highest-traffic screens)
- [ ] Deployed to Vercel, smoke-tested in production

---

*TAS ERP Phase 7 Implementation Plan — Looping Methodology | June 2026*
