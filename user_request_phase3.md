<USER_REQUEST>
# TAS ERP — Phase 3 Detailed Implementation Plan
**Raw Materials & Parties | Weeks 5–6 | 10 Working Days**

> ⚠️ AGENT INSTRUCTION: This document contains pixel-level UI specs extracted directly from approved screens. Every color, layout, component, badge, and behavior is prescribed. Do not deviate.

---

## Table of Contents
1. [Phase 3 Goals](#1-phase-3-goals)
2. [Design System Additions](#2-design-system-additions)
3. [Sidebar Structure Changes](#3-sidebar-structure-changes)
4. [Navigation & Route Map](#4-navigation--route-map)
5. [Screen Specifications](#5-screen-specifications)
6. [New Database Tables & SQL](#6-new-database-tables--sql)
7. [API Routes](#7-api-routes)
8. [Day-by-Day Execution Plan](#8-day-by-day-execution-plan)
9. [Phase 3 Completion Checklist](#9-phase-3-completion-checklist)

---

## 1. Phase 3 Goals

By end of Day 10 (Week 6), deployed and working:

- ✅ Sidebar restructured with section labels (PARTIES, RAW MATERIALS, PAYMENTS, REPORTS)
- ✅ Master Data > Parties: Add Party + Edit Party full-page form
- ✅ Parties module: Party List with type tabs + stat cards + filters
- ✅ Party Ledger: chronological transactions with debit/credit/balance columns
- ✅ Purchases: list with 5 stat cards + filters, Add, Edit, View Detail
- ✅ Purchase Returns: list with 4 stat cards, Add Return, View Detail
- ✅ Stock Overview: 5 KPI cards + summary table + 3 bottom charts
- ✅ Add Stock Entry: 5-section form with items table + summary
- ✅ Stock Entry Detail: read-only detail with status timeline + related docs
- ✅ Record Payment: modal with Payment Summary section
- ✅ Supplier Payments: supplier header + payments table + 3 summary cards

---

## 2. Design System Additions

### 2.1 New Color Tokens — add to globals.css

```css
/* Party type badges */
--badge-supplier-bg: #DCFCE7;    --badge-supplier-text: #15803D;
--badge-customer-bg: #DBEAFE;    --badge-customer-text: #1D4ED8;
--badge-worker-bg: #FEF3C7;      --badge-worker-text: #D97706;

/* Payment status badges */
--badge-paid-bg: #DCFCE7;        --badge-paid-text: #15803D;
--badge-partial-bg: #FEF3C7;     --badge-partial-text: #D97706;
--badge-unpaid-bg: #FEE2E2;      --badge-unpaid-text: #DC2626;
--badge-pending-bg: #FEE2E2;     --badge-pending-text: #DC2626;

/* Bill type badges */
--badge-gst-bg: #EEF2FF;         --badge-gst-text: #6366F1;
--badge-local-bg: #F0FDF4;       --badge-local-text: #15803D;

/* Stock status badges */
--badge-instock-bg: #DCFCE7;     --badge-instock-text: #15803D;
--badge-lowstock-bg: #FEF3C7;    --badge-lowstock-text: #D97706;
--badge-outofstock-bg: #FEE2E2;  --badge-outofstock-text: #DC2626;

/* Ledger type badges */
--badge-purchase-bg: #DBEAFE;    --badge-purchase-text: #1D4ED8;
--badge-payment-bg: #DCFCE7;     --badge-payment-text: #15803D;
--badge-return-bg: #FEF3C7;      --badge-return-text: #D97706;
--badge-opening-bg: #F1F5F9;     --badge-opening-text: #64748B;

/* Debit Note status */
--badge-debitnote-bg: #EEF2FF;   --badge-debitnote-text: #6366F1;

/* Section header labels in sidebar */
--sidebar-section-label: rgba(148, 163, 184, 0.5);

/* Debit/Credit column colors in ledger */
--ledger-debit: #374151;
--ledger-credit: #15803D;
--ledger-balance-dr: #DC2626;
--ledger-balance-cr: #15803D;

/* Stock movement colors */
--stock-in-color: #15803D;
--stock-out-color: #DC2626;

/* Step number circle (Add Purchase, Add Return, Add Stock) */
--step-circle-bg: #6366F1;
--step-circle-text: #FFFFFF;
```

### 2.2 Section Header Label (Sidebar)

New non-interactive divider label between nav groups:
```
Layout: px-4 pt-5 pb-1.5
Text: text-[10px] font-semibold uppercase tracking-widest
Color: text-[#94A3B8] opacity-60
Examples: "PARTIES", "RAW MATERIALS", "PAYMENTS", "REPORTS"
Not clickable, no hover state
```

### 2.3 Step Number Circle Pattern

Used in Add Purchase, Add Return, Add Stock Entry — numbered section headers:
```
Circle: w-7 h-7 rounded-full bg-[#6366F1] flex items-center justify-center flex-shrink-0
Number: text-sm font-bold text-white
Section title: text-base font-semibold text-[#0F172A] ml-3
Wrapper: flex items-center gap-0 mb-5
Full row: border-b border-[#E5E7EB] pb-4 mb-6
```

### 2.4 Stat Card Row Pattern (Phase 3 variant)

Used in Parties, Purchases, Purchase Returns, Stock — slightly different from Phase 1 dashboard cards:
```
Container: grid grid-cols-4 (or 5) gap-4 mb-6
Each card: bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-start gap-4

Icon area: w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
Icon: Lucide, size-5 or size-6

Value: text-2xl font-bold text-[#0F172A] leading-tight
Sub-label: text-xs text-[#64748B] mt-1
Optional amount sub-value: text-sm font-semibold text-[#DC2626] or text-[#15803D]
```

### 2.5 Filter Bar Pattern (Phase 3)

Used across all list pages — sits ABOVE the table, BELOW the stat cards:
```
Container: bg-white rounded-xl border border-[#E5E7EB] p-4 mb-4
Layout: flex items-center gap-3 flex-wrap

Search input: flex-1 min-w-[200px] max-w-[320px] — Search icon prefix, h-10
Filter dropdowns: w-[160px] h-10 each
Date range: w-[220px] h-10 — Calendar icon inside
Reset button: h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#374151]
Apply Filters: h-10 px-4 bg-[#6366F1] text-white rounded-lg text-sm font-medium
```

### 2.6 Page Header — Back Button Variant

Used in Purchase Detail, Stock Entry Detail, Purchase Return Detail:
```
Above page title, separate row:
← Back to [Page Name]
  ArrowLeft icon size-4 text-[#6366F1] + text-sm text-[#6366F1] hover:underline cursor-pointer
  mt-0 mb-2
```

### 2.7 Multi-Item Table (editable rows)

Used in Add Purchase, Edit Purchase, Add Purchase Return, Add Stock Entry:
```
Container: bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto

Header row: bg-[#F9FAFB] h-11
  th: text-xs font-medium text-[#64748B] uppercase tracking-wide px-3

Editable data row: bg-white border-b border-[#E5E7EB] h-14
  Inline input cells: h-9 px-2 rounded-lg border border-[#E5E7EB] text-sm w-full
                      focus:ring-2 focus:ring-[#6366F1] focus:border-transparent
  Select cells: same height, same border
  Read-only computed cells: text-sm text-[#374151] font-medium text-right
  Delete action: Trash2 icon, w-8 h-8, text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg

"+ Add Item" button: top-right of section
  border border-[#E5E7EB] bg-white h-9 px-3 rounded-lg text-sm
  Plus icon size-4 text-[#6366F1] + "Add Item" text-[#374151]

Footer row (below last item, above Add Item):
  "Total Items: N" text-sm text-[#64748B] on left
  "Total Returned Quantity: X Units" or similar on right
  Both: text-sm font-medium
```

### 2.8 Summary Panel (right side of Add Purchase, Add Return)

```
Container: bg-white rounded-xl border border-[#E5E7EB] p-5 sticky top-6

Title: text-base font-semibold text-[#0F172A] mb-4

Row pattern: flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0
  Label: text-sm text-[#64748B]
  Value: text-sm font-medium text-[#374151]

Grand Total row: flex items-center justify-between mt-3 pt-3 border-t-2 border-[#E5E7EB]
  Label: text-base font-bold text-[#0F172A]
  Value: text-xl font-bold text-[#6366F1]

Amount in Words: text-xs text-[#64748B] mt-2 italic
```

### 2.9 Status Timeline Component

Used in Stock Entry Detail and Purchase Return Detail:
```
Container: space-y-0

Each step: flex items-start gap-3 relative
  Before last: left border line connecting dots

Dot variants:
  Completed: w-8 h-8 rounded-full bg-[#DCFCE7] border-2 border-[#15803D]
             CheckCircle2 icon size-4 text-[#15803D] centered
  Pending/Last: w-8 h-8 rounded-full bg-[#EEF2FF] border-2 border-[#6366F1]
                Info icon size-4 text-[#6366F1]

Connector line: absolute left-4 top-8 w-0.5 h-8 bg-[#E5E7EB]
  (shown between all steps except last)

Content (right of dot):
  Title: text-sm font-semibold text-[#0F172A]
  DateTime: text-xs text-[#64748B] mt-0.5
  "by [User]": text-xs text-[#94A3B8]
```

### 2.10 Related Documents Panel

Used in Stock Entry Detail, Purchase Return Detail:
```
Container: bg-white rounded-xl border border-[#E5E7EB] p-5 mt-4

Title: text-sm font-semibold text-[#0F172A] mb-3

Each doc row: flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0
  Left: text-sm text-[#64748B] (doc type label)
  Right: flex items-center gap-2
    Doc number: text-sm font-medium text-[#6366F1] hover:underline cursor-pointer
    Eye icon: size-4 text-[#94A3B8]
```

### 2.11 Attachment Dropzone

Used in Add Purchase, Add Stock Entry, Add Purchase Return:
```
Container: border-2 border-dashed border-[#D1D5DB] rounded-xl p-6
           flex flex-col items-center gap-3 cursor-pointer
           hover:border-[#6366F1] hover:bg-[#F8FAFC] transition-colors

CloudUpload icon: size-8 text-[#94A3B8]
Primary text: "Click to upload or drag and drop" text-sm text-[#374151] font-medium
Subtitle: "PDF, JPG, PNG (Max 5MB)" text-xs text-[#94A3B8]
"Browse Files" button: border border-[#E5E7EB] h-9 px-4 rounded-lg text-sm
```

### 2.12 Party Type Badge Colors

```
Supplier: bg-[#DCFCE7] text-[#15803D]
Customer: bg-[#DBEAFE] text-[#1D4ED8]
Worker:   bg-[#FEF3C7] text-[#D97706]
```

### 2.13 Supplier Chip in Purchase Returns Table

Supplier name appears as a colored chip (not plain text):
```
bg-[#F0FDF4] text-[#15803D] text-xs font-medium px-2.5 py-1 rounded-md
```

---

## 3. Sidebar Structure Changes

The sidebar needs to be updated to support **section label dividers**. Update `components/layout/Sidebar.tsx`:

### 3.1 New Full Sidebar Structure

```
[Logo: TAS ERP]

Dashboard                    Home icon

Master Data ▾                Settings2 icon (expandable — same as Phase 1)
  • Brands
  • Godowns
  • Production Stages
  • Size Sets
  • Designs
  • Expense Types
  • GST Rates
  • Banks & UPI
  • Raw Materials
  • Parties             ← NEW in Phase 3

─── PARTIES ───           (section label — NOT clickable)

Parties                      Users icon (top-level item, not nested)

─── RAW MATERIALS ───      (section label)

Purchases                    ShoppingCart icon
Purchase Returns             RotateCcw icon
Stock                        Warehouse icon (or Package icon)

─── PAYMENTS ───           (section label)

Payments                     CreditCard icon

─── REPORTS ───            (section label)

Reports                      BarChart3 icon (expandable or top-level)

Expenses                     Wallet icon
Settings                     Settings icon
```

### 3.2 Section Label Component

```tsx
// components/layout/SidebarSectionLabel.tsx
// Props: label: string
// Renders: px-4 pt-5 pb-1.5
//          text-[10px] font-semibold uppercase tracking-widest
//          text-[#94A3B8]/60
// NOT wrapped in a link, NOT hoverable
```

### 3.3 Top-Level Nav Item (non-expandable)

```
Same style as active/inactive sub-items from Phase 1 but at root level:
  flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-sm font-medium
  Inactive: text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white
  Active:   bg-[#312E81] text-white
  Icon: size-[18px]
  Label: text-sm font-medium
```

---

## 4. Navigation & Route Map

### 4.1 Complete Route Structure

```
Master Data (existing, extended):
  /master-data/parties              → Parties list page (within Master Data sub-menu)
  /master-data/parties/new          → Add Party full-page form
  /master-data/parties/[id]/edit    → Edit Party full-page form

Parties (new top-level sidebar module):
  /parties                          → Party List (All/Customers/Suppliers/Workers tabs)
  /parties/[id]/ledger              → Party Ledger
  /parties/[id]/payments            → Supplier/Customer Payments for that party

Raw Materials (new section):
  /raw-materials/purchases           → Purchases list
  /raw-materials/purchases/new       → Add Purchase
  /raw-materials/purchases/[id]      → Purchase Detail
  /raw-materials/purchases/[id]/edit → Edit Purchase
  /raw-materials/purchase-returns    → Purchase Returns list
  /raw-materials/purchase-returns/new → Add Purchase Return
  /raw-materials/purchase-returns/[id] → Purchase Return Detail
  /raw-materials/stock               → Stock Overview
  /raw-materials/stock/new           → Add Stock Entry
  /raw-materials/stock/[id]          → Stock Entry Detail

Payments (new section):
  /payments                          → All payments (Phase 7 full build)
  /payments/supplier                 → Supplier Payments (Phase 3 builds this)
```

### 4.2 Breadcrumb Map Per Screen

```
Parties list (Master Data context):
  Master Data > Parties

Add Party:
  Master Data > Parties > Add Party

Edit Party:
  Master Data > Parties > [Party Name] > Edit

Party List (sidebar module):
  Parties

Party Ledger:
  Master Data > Parties > [Party Name (Code)]

Purchases list:
  Raw Materials > Purchases

Add Purchase:
  Raw Materials > Purchases > Add Purchase

Purchase Detail:
  Raw Materials > Purchases > Purchase Detail

Edit Purchase:
  Raw Materials > Purchases > Edit Purchase (Invoice No.)

Purchase Returns list:
  Raw Materials > Purchase Returns

Add Purchase Return:
  Raw Materials > Purchase Returns > Add Purchase Return

Purchase Return Detail:
  Raw Materials > Purchase Returns > Purchase Return Detail (Return No.)

Stock Overview:
  Raw Materials > Stock Overview

Add Stock Entry:
  Raw Materials > Stock > Add Stock Entry

Stock Entry Detail:
  Raw Materials > Stock > Stock Entry Detail (STK No.)

Supplier Payments:
  Parties > Suppliers > Supplier Payments
```

---

## 5. Screen Specifications

---

### 5.1 Add / Edit Party — Master Data

**Route:** `/master-data/parties/new` | `/master-data/parties/[id]/edit`
**Breadcrumb:** Master Data > Parties > Add Party
**Page title:** "Add Party" / "Edit Party"

**Header buttons (top-right, flex gap-3):**
```
Cancel:       X icon + "Cancel" — border border-[#E5E7EB] h-10 px-4 rounded-lg text-sm
Save as Draft: FloppyDisk icon + "Save as Draft" — same outline style
Save Party:   Save icon + "Save Party" — primary bg-[#6366F1] h-10 px-4 rounded-lg
```

**Layout:** Single full-width scrollable page — no right sidebar

---

#### SECTION 1 — Basic Information

```
Section title: "Basic Information"
  text-base font-semibold text-[#6366F1] mb-4
  (sections use colored title, NOT the Step Number Circle pattern)

Grid: grid grid-cols-4 gap-4

Row 1:
  Party Type *   [select: Supplier / Customer / Worker / Both]  col-span-1
  Party Name *   [text input]                                    col-span-1
  Code *         [text — auto-generated, editable: SUP-0001]    col-span-1
  GSTIN          [text, 15 chars]                               col-span-1

Row 2:
  Phone *        [text: +91 prefix]          col-span-1
  Email          [email]                     col-span-1
  Website        [text]                      col-span-1
  Status *       [select: Active/Inactive]   col-span-1

Row 3:
  Pan Number     [text: 10 chars]   col-span-1
  Aadhar Number  [text: 12 chars]   col-span-1
  MSME Number    [text]             col-span-1
  TAN Number     [text]             col-span-1
```

---

#### SECTION 2 — Address Details

```
Section title: "Address Details"
  text-base font-semibold text-[#6366F1] mb-4

Top-right: "Same as Billing Address" checkbox
  Checkbox: shadcn Checkbox + label text-sm text-[#374151]
  When checked: Shipping Address fields auto-fill from Billing Address

Two-column split: grid grid-cols-2 gap-6

LEFT — Billing Address:
  Sub-label: "Billing Address" text-sm font-semibold text-[#374151] mb-3
  Grid grid-cols-2 gap-3:
    Address Line 1 * [text] col-span-2
    Address Line 2   [text] col-span-2
    City *           [text] col-span-1
    State *          [select: all Indian states] col-span-1
    PIN Code *       [text: 6 digits] col-span-1

RIGHT — Shipping Address:
  Sub-label: "Shipping Address" text-sm font-semibold text-[#374151] mb-3
  Same fields as Billing Address
  When "Same as Billing" checked: fields show same values, disabled/grayed
```

---

#### SECTION 3 — Additional Information + Bank Details (side by side)

```
Grid: grid grid-cols-2 gap-6

LEFT — Additional Information:
  Section title: "Additional Information" text-base font-semibold text-[#6366F1] mb-4

  Grid grid-cols-3 gap-4:
    Payment Terms         [select: Immediate/15 Days/30 Days/45 Days/60 Days]
    Credit Limit (₹)      [number: 5,00,000.00]
    Opening Balance (₹)   [number: 0.00]

  Grid grid-cols-3 gap-4 mt-3:
    Currency              [select: INR - Indian Rupee]
    Default Purchase Account [select: Raw Material Purchase / etc.]
    Default Godown        [select from godowns table]

  Remarks (full width, mt-3):
    Label: "Remarks"
    Textarea: h-24 px-3 py-2.5 rounded-lg border border-[#D1D5DB] text-sm resize-none
    Placeholder: "Enter remarks (optional)"

RIGHT — Bank Details:
  Section title: "Bank Details" text-base font-semibold text-[#6366F1] mb-4
  Top-right: "+ Add Bank" button
    border border-[#E5E7EB] h-9 px-3 rounded-lg text-sm Plus icon + text

  Bank table:
    Columns: # | Bank Name | Account Number | IFSC Code | Branch | Action
    Each row: existing bank entry
    Action: Pencil edit icon + Trash2 delete icon

    On "+ Add Bank" → inline form row appears at bottom:
      Bank Name input + Account Number + IFSC Code + Branch + Save (checkmark) + Cancel (x)
```

---

#### BOTTOM — Info Banner

```
Blue info banner (full width, at bottom of form):
  Info icon + "Fields marked with * are mandatory."
```

---

### 5.2 Parties List — `/parties`

**Page title:** "Parties"
**Breadcrumb:** Master Data > Parties
**Subtitle:** none
**Header buttons:** "Import Party" (outline, Upload icon) + "+ Add Party" (primary, Plus icon)

---

#### TABS

```
Tab bar: flex border-b border-[#E5E7EB] mb-4 (below page header, above filter bar)
Tabs: All | Customers | Suppliers | Workers
Active tab: text-[#6366F1] border-b-2 border-[#6366F1] font-semibold
Inactive: text-[#64748B] hover:text-[#374151]
Tab padding: px-4 py-3 text-sm font-medium
```

---

#### FILTER BAR

```
Layout: flex items-center gap-3 mb-4

Search input (flex-1):
  Placeholder: "Search party by name, code, phone, email..."
  Search icon prefix

3 dropdowns:
  Party Type: "All Types" / Supplier / Customer / Worker    w-[150px]
  Status:     "All Statuses" / Active / Inactive            w-[150px]
  City:       "All Cities" (populated from parties data)    w-[150px]

Reset + Apply Filters buttons
```

---

#### 4 STAT CARDS (grid grid-cols-4 gap-4 mb-4)

```
Card 1 — Total Parties
  Icon: Users2, bg-[#EEF2FF], color #6366F1
  Value: "156" text-2xl font-bold
  Sub: "All party records" text-xs text-[#64748B]

Card 2 — Customers
  Icon: UserCheck, bg-[#F0FDF4], color #16A34A
  Value: "62" text-2xl font-bold
  Sub: "Active customers" text-xs text-[#64748B]

Card 3 — Suppliers
  Icon: Truck, bg-[#FFF7ED], color #EA580C
  Value: "78" text-2xl font-bold
  Sub: "Active suppliers" text-xs text-[#64748B]

Card 4 — Workers
  Icon: HardHat, bg-[#FEF9C3], color #D97706
  Value: "16" text-2xl font-bold
  Sub: "Active workers" text-xs text-[#64748B]
```

---

#### PARTIES TABLE

```
Title: "Parties List" text-sm font-semibold text-[#374151] mb-3

Columns: # | Code | Party Name | Type | Phone | Email | City | Status | Action

# column: text-sm text-[#64748B] w-12
Code column: text-sm font-mono text-[#374151] — "SUP-0001"
Party Name: text-sm font-medium text-[#0F172A]
Type badge:
  Supplier: bg-[#DCFCE7] text-[#15803D]
  Customer: bg-[#DBEAFE] text-[#1D4ED8]
  Worker:   bg-[#FEF3C7] text-[#D97706]
  (text-xs font-medium px-2.5 py-1 rounded-md)
Phone: text-sm text-[#374151]
Email: text-sm text-[#64748B]
City: text-sm text-[#374151]
Status: StatusBadge (Active green / Inactive red)

Action column: ⋮ MoreVertical icon button (w-8 h-8 border rounded-lg)
  Dropdown: View Ledger | Edit (→ /master-data/parties/[id]/edit) | Deactivate

Row click → navigates to /parties/[id]/ledger

FOOTER:
  "Showing 1 to 10 of 156 entries"
  Pagination: < 1 2 3 ... 16 > | "10 / page" dropdown (right side)
```

---

### 5.3 Party Ledger — `/parties/[id]/ledger`

**Page title:** "Party Ledger"
**Breadcrumb:** Master Data > Parties > [Party Name (Code)]
**Header buttons:** "Statement (PDF)" (outline, Upload icon) + "Export Excel" (outline, Download icon)

---

#### PARTY HEADER CARD

```
Full-width card: bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4

Layout: flex items-start gap-6

LEFT — Party Info (flex-shrink-0):
  Building2 icon in w-14 h-14 rounded-xl bg-[#EEF2FF] color #6366F1
  Party Name: text-xl font-bold text-[#0F172A]
  Type badge: Supplier/Customer/Worker badge (from 2.12)
  Code: text-sm text-[#64748B] mt-1
  Phone: flex items-center gap-1.5 text-sm text-[#374151] mt-1 (Phone icon size-4)
  Email: flex items-center gap-1.5 text-sm text-[#374151] mt-0.5 (Mail icon)
  GSTIN: text-sm text-[#64748B] mt-0.5
  Address: text-sm text-[#64748B] mt-0.5

RIGHT — 4 KPI Cards (grid grid-cols-4 gap-4 flex-1):

  Card 1: Opening Balance (₹)
    Value: text-2xl font-bold text-[#374151]
    e.g. "75,000.00"

  Card 2: Total Purchases (₹)
    Value: text-2xl font-bold text-[#374151]
    e.g. "12,85,450.00"

  Card 3: Total Payments (₹)
    Value: text-2xl font-bold text-[#15803D] (green)
    e.g. "7,60,000.00"

  Card 4: Current Balance (₹)
    Value: text-2xl font-bold text-[#DC2626] (red for Payable)
    e.g. "5,25,450.00"
    Sub-badge below value:
      "Payable" → bg-[#FEE2E2] text-[#DC2626] text-xs px-2 py-0.5 rounded
      "Receivable" → bg-[#DCFCE7] text-[#15803D] text-xs px-2 py-0.5 rounded

BOTTOM ROW of header card (border-t border-[#F3F4F6] mt-4 pt-4):
  "As on Date" label + date picker input (w-[180px])
  "View" label + select dropdown: "All Transactions" / Purchases / Payments / Returns (w-[200px])
  These two are flex items-end gap-6
```

---

#### TABS

```
"Ledger Transactions" | "Summary"
Same tab style as Parties list
Active: "Ledger Transactions" (default)
```

---

#### LEDGER TRANSACTIONS TAB

**Filter row (below tabs):**
```
flex items-end gap-4 mb-4

Date Range: date range picker w-[220px]
Transaction Type: select "All Types" / Purchase / Payment / Return  w-[160px]
Reference Type: select "All" / GST Purchase / Local Purchase / Payment  w-[160px]
Reset + Apply Filters buttons (right-aligned, ml-auto)
```

**Ledger Table:**
```
Columns: Date ↓ | Ref. No. | Type | Reference | Description | Debit (₹) | Credit (₹) | Balance (₹)

Date: text-sm text-[#374151] — "01 Jan 2024", sortable (arrow shown in header)
Ref. No.: text-sm font-mono text-[#374151] — "OP-0001", "PUR-24-01-0001"
Type badge (EXACT colors from approved screen):
  Opening Balance: bg-[#F1F5F9] text-[#64748B]
  Purchase:        bg-[#DBEAFE] text-[#1D4ED8]
  Payment:         bg-[#DCFCE7] text-[#15803D]
  Purchase Return: bg-[#FEF3C7] text-[#D97706]
Reference: text-sm text-[#6366F1] — clickable link if applicable, else "-"
  "GST Purchase", "Local Purchase", "Payment" — text-sm text-[#64748B]
Description: text-sm text-[#374151]
  e.g. "Purchase of Raw Materials (18 Items)", "Payment against PUR-24-01-0001"

Debit (₹): text-sm font-medium text-[#374151]
  Shows amount for Purchase / Opening Balance
  "-" for Payment rows
  "-15,000.00" in text-[#DC2626] for Purchase Return (negative)

Credit (₹): text-sm font-medium text-[#15803D]
  Shows amount for Payment
  "-" for other rows

Balance (₹): text-sm font-bold — right-aligned
  Always shown with "Dr" or "Cr" suffix
  text-[#DC2626] for Dr (Payable to supplier)
  text-[#15803D] for Cr (Receivable from customer)
  e.g. "75,000.00 Dr", "2,00,000.00 Dr"

Row hover: bg-[#F8FAFC]

FOOTER: "Showing 1 to 12 of 12 entries" + pagination | "20 / page" dropdown

INFO BANNER (blue, below table):
  "Dr (Debit) balance means amount is payable to the party.
   Cr (Credit) balance means amount is receivable from the party."
```

---

### 5.4 Purchases List — `/raw-materials/purchases`

**Page title:** "Purchases"
**Breadcrumb:** Raw Materials > Purchases
**Header buttons:** "Import Purchase" (outline, Upload icon) + "+ Add Purchase" (primary) + ⋮ more options

---

#### FILTER BAR (above stat cards)

```
5 filters in one row: flex items-center gap-3

Date Range picker: w-[220px]
Supplier dropdown: "All Suppliers"  w-[160px]
Bill Type: "All Bill Types" / GST Purchase / Local Purchase  w-[150px]
Status: "All Statuses" / Paid / Partial / Unpaid / Cancelled  w-[150px]
Godown: "All Godowns"  w-[150px]
Reset + Apply Filters
```

---

#### 5 STAT CARDS (grid grid-cols-5 gap-4 mb-4)

```
Card 1: Total Purchases
  Icon: ShoppingBag, bg-[#EEF2FF], color #6366F1
  Value: "₹12,85,450.00" text-xl font-bold
  Sub: "(14 Bills)" text-xs text-[#64748B]

Card 2: Total Items
  Icon: Package, bg-[#F0FDF4], color #16A34A
  Value: "258" text-2xl font-bold
  Sub: "Across all bills" text-xs text-[#64748B]

Card 3: Total Quantity
  Icon: BarChart2, bg-[#FFF7ED], color #EA580C
  Value: "4,856.00" text-2xl font-bold
  Sub: "Across all bills" text-xs text-[#64748B]

Card 4: Total Paid
  Icon: CheckCircle, bg-[#F0FDF4], color #16A34A
  Value: "₹7,60,000.00" text-xl font-bold
  Sub: "(59.15%)" text-xs text-[#64748B]

Card 5: Total Pending
  Icon: Clock, bg-[#FEF2F2], color #DC2626
  Value: "₹5,25,450.00" text-xl font-bold text-[#DC2626]
  Sub: "(40.85%)" text-xs text-[#64748B]
```

---

#### PURCHASES TABLE

```
Header row (flex items-center justify-between mb-3):
  "Purchases List" text-sm font-semibold text-[#374151]
  "Export Excel" outline button (Download icon)

Table has CHECKBOXES — leftmost column:
  Checkbox: w-5 h-5 rounded border-[#D1D5DB] (shadcn Checkbox)
  Header checkbox: select-all behavior

Columns: ☐ | Bill No. | Bill Date ↓ | Supplier | Bill Type | Items | Total Amount (₹) | Paid (₹) | Balance (₹) | Status | Action

Bill No.: text-sm font-mono text-[#374151] — "PUR-24-05-0014"
Bill Date: text-sm text-[#374151] — "31 May 2024", sortable
Supplier: text-sm font-medium text-[#374151]
Bill Type badge:
  GST Purchase:   bg-[#EEF2FF] text-[#6366F1]
  Local Purchase: bg-[#F0FDF4] text-[#15803D]
Items: text-sm text-center text-[#374151]
Total Amount: text-sm font-medium text-[#374151] text-right
Paid: text-sm text-[#374151] text-right
Balance: text-sm font-medium text-right
  0.00 → text-[#374151]
  >0 → text-[#DC2626] (red — outstanding)
Status badge:
  Paid:    bg-[#DCFCE7] text-[#15803D]
  Partial: bg-[#FEF3C7] text-[#D97706]
  Unpaid:  bg-[#FEE2E2] text-[#DC2626]

Action column: flex items-center gap-2
  Eye icon button: w-8 h-8 border border-[#E5E7EB] rounded-lg (view detail)
  ⋮ MoreVertical: w-8 h-8 border rounded-lg
    Dropdown: Edit | Record Payment | Print | Cancel

FOOTER: "Showing 1 to 10 of 14 entries" + pagination + "10 / page" dropdown
```

---

### 5.5 Add Purchase — `/raw-materials/purchases/new`

**Page title:** "Add Purchase"
**Breadcrumb:** Raw Materials > Purchases > Add Purchase
**Header buttons:** "Cancel" (X icon, outline) + "Save as Draft" (FloppyDisk, outline) + "Save Purchase" (primary)

**Layout:** Full-width single column — 4 numbered sections + right Summary panel

---

#### SECTION 1 — Purchase Details (numbered circle: "1")

```
Grid grid-cols-4 gap-4:
  Supplier *        [searchable select — shows party name + code]   col-span-1
  Invoice No. *     [text — auto-generated but editable]            col-span-1
  Invoice Date *    [date picker]                                    col-span-1
  Delivery Date     [date picker, optional]                         col-span-1

Grid grid-cols-4 gap-4 mt-4:
  Payment Terms     [select: 30 Days etc.]   col-span-1
  Due Date          [date picker — auto from Payment Terms + Invoice Date]  col-span-1
  Reference (Optional) [text]               col-span-1
  Transporter (Optional) [text]             col-span-1

Grid grid-cols-3 gap-4 mt-4:
  Place of Supply   [select: Gujarat (24) etc.]   col-span-1
  GST Type          [select: With GST / Without GST / Reverse Charge]  col-span-1
  Notes (Optional)  [textarea, h-20]              col-span-1

When Supplier selected:
  Phone number shows below supplier field: text-sm text-[#64748B] flex items-center gap-1
  (Phone icon size-3) "+91 98765 43210"
```

---

#### SECTION 2 — Items (numbered circle: "2")

```
"+ Add Item" button: top-right of section header

Multi-Item Table:
Columns: # | Material * | HSN/SAC | Unit * | Quantity * | Rate (₹) * | Discount (%) | Taxable Value (₹) | GST % | GST Amount (₹) | Amount (₹) | Action

# column: row number, text-sm text-[#64748B], w-10
Material: searchable select (from raw_material_types), w-[180px] min
HSN/SAC: text input, w-[80px], auto-fills from material
Unit: select (Kgs/Meters/Pieces etc.), w-[90px], auto-fills from material
Quantity: number input, w-[80px]
Rate (₹): number input, w-[80px]
Discount (%): number input, w-[70px], default 0.00
Taxable Value: computed read-only = (Qty × Rate) - Discount, text-right
GST %: select (0%/5%/12%/18%/28%), w-[80px], auto-fills from material HSN
GST Amount: computed read-only, text-right
Amount (₹): computed read-only = Taxable + GST Amount, font-medium text-right
Action: Trash2 icon, text-[#EF4444]

Computed formula:
  Taxable Value = Quantity × Rate × (1 - Discount/100)
  GST Amount = Taxable Value × GST%/100
  Amount = Taxable Value + GST Amount

Auto-computation: fires on blur of any input field

Footer row below items (flex justify-between px-3 py-2 bg-[#F9FAFB]):
  "Total Items: 5" text-sm text-[#64748B]
  (no total qty shown here — in Summary panel)
```

---

#### SECTION 3 — Other Charges (numbered circle: "3")

```
Grid grid-cols-4 gap-4:
  Freight             [number input, default 0.00]
  Loading / Unloading [number input, default 0.00]
  Other Charges       [number input, default 0.00]
  Total Other Charges [read-only: sum of above, bg-[#F9FAFB]]

Note: Total Other Charges input: disabled, bg-[#F9FAFB] border border-[#E5E7EB]
      auto-computes from the three fields above
```

---

#### SECTION 4 — Attachments (numbered circle: "4")

```
Attachment Dropzone (from Section 2.11)
Below dropzone: uploaded files list (if any)
  Each file: flex items-center gap-2 py-2 border-b
    File icon + filename + filesize + × remove button
```

---

#### SUMMARY PANEL (right side, sticky)

```
Position: when screen is wide enough, floats to the right as a sticky card
On narrower screens: appears below section 4

Title: "Summary" text-base font-semibold text-[#0F172A] mb-4 (no icon)

Rows:
  Total Taxable Value   | [computed]
  Total GST Amount      | [computed]
  Total Other Charges   | [computed]
  ──────────────────────────────────
  Grand Total (₹)       | [computed] text-[#6366F1] text-xl font-bold

Amount in Words:
  text-xs text-[#64748B] italic mt-2
  e.g. "One Lakh Eighty Thousand Four Hundred Seventy Seven Rupees and Fifty Paise Only"
```

---

### 5.6 Purchase Detail — `/raw-materials/purchases/[id]`

**Page title:** "Purchase Detail"
**Back link:** ← Back to Purchases (above breadcrumb)
**Breadcrumb:** Raw Materials > Purchases > Purchase Detail
**Header buttons:** "Edit" (Pencil outline) + "Print" (Printer outline) + "Record Payment" (primary, split button with ▼) + ⋮

---

#### TOP INFO CARD

```
Full-width card: bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4

Layout: grid grid-cols-5 gap-6

Col 1-2 — Supplier info:
  "Supplier" label: text-xs text-[#64748B] uppercase tracking-wide
  Party Name: text-lg font-bold text-[#0F172A]
  State code below: text-sm text-[#64748B] "Gujarat (24)"
  Phone: flex items-center gap-1.5 text-sm text-[#64748B] mt-1

Col 3 — Invoice details:
  "Invoice No." label + value: text-base font-semibold text-[#374151]
  "Invoice Date" label + value with Calendar icon
  "Payment Terms" label + value: text-base font-semibold

Col 4 — Dates and supply:
  "Due Date" label + value with Calendar icon
  "Place of Supply" label + value
  "GST Type" label + value: text-base font-semibold

Col 5 — Status summary (right side card):
  Small card within the main card: bg-[#F8FAFC] rounded-lg p-4
  "Status" label + Status badge (Paid/Partial/Unpaid)
  Divider
  "Total Amount": text-base font-semibold text-[#374151]
  "Paid Amount": text-base font-semibold text-[#15803D]
  "Due Amount": text-base font-semibold (text-[#DC2626] if >0, else text-[#374151])
```

---

#### ITEMS TABLE (read-only)

```
Same columns as Add Purchase but all read-only:
# | Material | HSN/SAC | Unit | Quantity | Rate (₹) | Discount (%) | Taxable Value (₹) | GST % | GST Amount (₹) | Amount (₹)

No edit inputs — all plain text values
No Action column
No checkboxes
Header bg-[#F9FAFB], rows hover:bg-[#F8FAFC]
```

---

#### BOTTOM SECTION (two columns)

```
Grid grid-cols-2 gap-6

LEFT col:
  "Other Charges" sub-section:
    4-col grid: Freight | Loading/Unloading | Other Charges | Total Other Charges
    All read-only, values shown with ₹ prefix

  "Notes" sub-section (below Other Charges):
    Label: "Notes" text-sm font-semibold text-[#374151]
    Content: text-sm text-[#64748B] (or "-" if empty)

RIGHT col:
  "Summary" sub-section:
    Total Taxable Value, Total GST Amount, Total Other Charges rows
    Grand Total: text-xl font-bold text-[#0F172A]
    "Grand Total" label: text-base font-bold
    Amount in Words: text-xs text-[#64748B] italic
```

---

#### PAYMENT INFORMATION SECTION (below main content)

```
Title: "Payment Information" text-base font-semibold text-[#0F172A] mb-4

Payment history table:
Columns: Paid Amount | Payment Date | Payment Mode | Reference No. | Remarks

Paid Amount: text-sm font-semibold text-[#15803D]
Payment Date: text-sm text-[#374151] with Calendar icon
Payment Mode: text-sm text-[#374151]
Reference No.: text-sm font-mono text-[#374151]
Remarks: text-sm text-[#64748B]
```

---

### 5.7 Edit Purchase — `/raw-materials/purchases/[id]/edit`

**Page title:** "Edit Purchase"
**Breadcrumb:** Raw Materials > Purchases > Edit Purchase (Invoice No.)
**Header buttons:** "Cancel" + "Print" (outline) + "Update Purchase" (primary)

**Layout:** Same as Add Purchase BUT:
- No numbered section circles — sections use plain text headers in `text-base font-semibold text-[#6366F1]`
- Supplier field shows phone number inline below it once loaded
- All fields pre-filled from existing purchase data
- Summary panel on right side (same as Add Purchase)
- No "Save as Draft" button — only Cancel + Print + Update Purchase
- "Purchase Details" section title (not "Add Purchase")
- Items section title: "Items" (not numbered)
- "Other Charges" section title unchanged

---

### 5.8 Purchase Returns List — `/raw-materials/purchase-returns`

**Page title:** "Purchase Returns"
**Breadcrumb:** Raw Materials > Purchase Returns
**Header buttons:** "Export" (outline) + "+ Add Purchase Return" (primary)

---

#### 4 STAT CARDS (grid grid-cols-4 gap-4 mb-4)

```
Card 1: Total Returns
  Icon: RotateCcw, bg-[#EEF2FF], color #6366F1
  Value: "22" text-2xl font-bold
  Sub: "This Month" text-xs text-[#64748B]

Card 2: Total Return Amount
  Icon: IndianRupee, bg-[#F0FDF4], color #16A34A
  Value: "₹2,85,750.00" text-xl font-bold
  Sub: "This Month"

Card 3: Total Debit Notes
  Icon: FileText, bg-[#FFF7ED], color #EA580C
  Value: "18" text-2xl font-bold
  Sub: "This Month"

Card 4: Pending Returns
  Icon: Clock, bg-[#FEF9C3], color #D97706
  Value: "4" text-2xl font-bold text-[#D97706]
  Sub: "This Month"
```

---

#### FILTER BAR

```
Search | Supplier dropdown | Date Range | Status dropdown | Reset + Apply
```

---

#### PURCHASE RETURNS TABLE

```
Title: "Purchase Returns List" text-sm font-semibold

Columns: # | Return No. | Supplier | Original Invoice | Return Date | Return Amount (₹) | Debit Note No. | Debit Note Date | Status | Action

# column: text-sm text-[#64748B]
Return No.: text-sm font-mono text-[#374151]
Supplier: colored chip badge (Section 2.13 style) — bg-[#F0FDF4] text-[#15803D] rounded-md px-2.5 py-1 text-xs
Original Invoice: text-sm font-mono text-[#374151]
Return Date: text-sm text-[#374151]
Return Amount: text-sm font-medium text-[#374151]
Debit Note No.: text-sm font-mono text-[#6366F1] hover:underline (clickable), or "-" if none
Debit Note Date: text-sm text-[#374151], or "-"
Status badge:
  Debit Note Created: bg-[#DCFCE7] text-[#15803D]
  Pending:            bg-[#FEF3C7] text-[#D97706]

Action: ⋮ MoreVertical menu → View | Edit | Create Debit Note | Cancel

FOOTER: standard pagination + 10/page dropdown
```

---

### 5.9 Add Purchase Return — `/raw-materials/purchase-returns/new`

**Page title:** "Add Purchase Return"
**Breadcrumb:** Raw Materials > Purchase Returns > Add Purchase Return
**Header buttons:** "Cancel" (X outline) + "Save Return" (primary)

**Layout:** Two-column: LEFT=main form (wider), RIGHT=summary panel + auto debit note + attachments

---

#### LEFT — SECTION 1: Return Details (numbered circle "1")

```
Grid grid-cols-4 gap-4:
  Supplier *            [searchable select]
  Original Invoice *    [searchable select — filters by selected supplier]
                        Has × clear button inside the select
  Invoice Date          [read-only, auto-fills when invoice selected, with Calendar icon]
  Return Date *         [date picker]

Grid grid-cols-4 gap-4 mt-4:
  Return Type *         [select: Material Return / Quality Issue / Excess Material / Other]
  Reason for Return *   [select: Quality Issue / Damaged / Wrong Item / Excess / Other]
  Godown *              [select from godowns]
  Challan No. (Optional) [text input]

Remarks (Optional) — full width:
  Textarea h-24 px-3 py-2.5 resize-none
  Placeholder: "Enter remarks..."
```

---

#### LEFT — SECTION 2: Items to Return (numbered circle "2")

```
"+ Add Item" button: top-right

Multi-Item Table:
Columns: # | Material * | HSN/SAC | Unit | Invoice Qty | Returned Qty * | Rate (₹) | Discount (%) | Taxable Value (₹) | Action

Material: select (pre-populated from selected invoice items)
HSN/SAC: read-only, auto-fills
Unit: read-only, auto-fills
Invoice Qty: read-only, auto-fills from original invoice
Returned Qty: number input (≤ Invoice Qty validation)
Rate (₹): auto-fills from invoice, editable
Discount (%): auto-fills from invoice, editable
Taxable Value: computed read-only = Returned Qty × Rate × (1 - Discount/100)
Action: Trash2 red icon

Footer row (below items):
  "Total Returned Quantity: 130.00 Kgs" text-sm font-semibold text-[#6366F1] (left)
  "Total Items: 5" text-sm text-[#64748B] (right)

Bottom row (below table):
  Reset button: border outline, RotateCcw icon + "Reset" text
  Save Return: primary button (duplicate of header — sticky at page bottom)
```

---

#### RIGHT — SUMMARY PANEL

```
(Same Return Summary pattern as Section 2.8, but with more rows)
Title: "Return Summary" with FileText icon text-[#6366F1]

Rows:
  Total Taxable Value           | ₹19,765.00
  Total Discount                | ₹275.00
  Taxable Value After Discount  | ₹19,490.00
  CGST (9%)                     | ₹1,754.10
  SGST (9%)                     | ₹1,754.10
  IGST (18%)                    | ₹0.00
  Round Off                     | ₹0.80
  ────────────────────────────────────────────
  Grand Total                   | ₹23,000.00 (text-[#6366F1] text-xl font-bold)

Amount in Words:
  text-xs text-[#64748B] italic
```

---

#### RIGHT — AUTO DEBIT NOTE

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-4 mt-4

Header: FileText icon text-[#6366F1] + "Auto Debit Note" text-sm font-semibold

Checkbox row: shadcn Checkbox (checked by default) + label
  Label: "Generate Debit Note" text-sm font-medium text-[#374151]
  Helper: "Debit Note will be created automatically on save."
          text-xs text-[#64748B] mt-1
```

---

#### RIGHT — NOTES & ATTACHMENTS

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-4 mt-4

Title: PenLine icon text-[#6366F1] + "Notes & Attachments" text-sm font-semibold

"Attach Documents" label text-xs text-[#94A3B8] mt-3 mb-2

Attachment Dropzone (from Section 2.11)
```

---

### 5.10 Purchase Return Detail — `/raw-materials/purchase-returns/[id]`

**Page title:** "Purchase Return Detail"
**Status badge next to title:** "Completed" badge — bg-[#DCFCE7] text-[#15803D] text-xs font-medium px-3 py-1 rounded-full
**Back link:** ← Back to Purchase Returns
**Breadcrumb:** Raw Materials > Purchase Returns > Purchase Return Detail (Return No.)
**Header buttons:** "Edit" (Pencil) + "Print" (Printer) + "Create Debit Note" (outline) + ⋮

---

#### TOP INFO CARD (grid grid-cols-4 gap-4)

```
Col 1:
  "Return No." label + value: text-xl font-bold text-[#0F172A]
  "Supplier" label + value: text-base font-semibold text-[#374151]
  Phone: text-sm text-[#64748B] with Phone icon

Col 2:
  "Original Invoice" label + value: text-base font-semibold text-[#6366F1] (link)
  "Invoice Date" label + value with Calendar icon

Col 3:
  "Return Type" label + "Material Return" value: text-base font-semibold
  "Reason" label + "Quality Issue" value: text-base font-semibold
  "Godown" label + value
  "Challan No." label + value: font-mono

Col 4 — Financial Summary:
  "Total Amount" row
  "Discount" row
  "Taxable Value" row
  "CGST (9%)" row
  "SGST (9%)" row
  "IGST (18%)" row (shown as ₹0.00 when not applicable)
  "Round Off" row
  Divider
  "Grand Total" label + value: text-xl font-bold text-[#0F172A]
```

---

#### ITEMS RETURNED TABLE (read-only)

```
Columns: # | Material | HSN/SAC | Unit | Invoice Qty | Returned Qty | Rate (₹) | Discount (%) | Taxable Value (₹) | Action

All read-only (no inputs)
Action column header: hidden (or empty)
Action cells: empty — no actions on read-only rows

Footer (below table):
  "Total Returned Quantity: 130.00 Kgs" text-sm font-semibold text-[#6366F1]
  "Total Items: 5" text-sm text-[#64748B]
```

---

#### BOTTOM SECTION (grid grid-cols-2 gap-6)

```
LEFT col:
  "Notes" label + notes text

  "Attachments (N)" label with Paperclip icon
    Each attachment: flex items-center gap-3 py-2.5 border-b border-[#F3F4F6]
      PDF icon (red square) + filename + filesize
      Download icon button (right)

RIGHT col:
  STATUS TIMELINE (from Section 2.9):
    Return Created → Items Verified → Approved → Debit Note Created

  RELATED DOCUMENTS (from Section 2.10):
    Original Invoice | [PUR no.] → eye icon
    Debit Note       | [DN no.]  → eye icon
    Delivery Challan | [CH no.]  → eye icon

BOTTOM INFO ROW (below both cols):
  flex justify-between text-xs text-[#94A3B8] mt-6 pt-4 border-t border-[#F3F4F6]
  "Created By: Super Admin | 31 May 2024, 10:15 AM" (left)
  "Last Updated By: Super Admin | 01 Jun 2024, 11:05 AM" (right)
```

---

#### DEBIT NOTE INFORMATION + PAYMENT INFORMATION (below items section)

```
Grid grid-cols-2 gap-6

LEFT — Debit Note Information:
  grid grid-cols-3:
    Debit Note No.: text-sm font-mono text-[#6366F1] (link)
    Debit Note Date: text-sm text-[#374151] with Calendar icon
    Debit Note Amount: text-sm font-semibold text-[#374151]

RIGHT — Payment Information:
  grid grid-cols-5:
    Payment Status: status badge
    Paid Amount: text-sm font-semibold text-[#15803D]
    Payment Date: text-sm with Calendar icon
    Payment Mode: text-sm
    Reference No.: text-sm font-mono
  "Payment Received" note: text-xs text-[#64748B] mt-2
```

---

### 5.11 Stock Overview — `/raw-materials/stock`

**Page title:** "Stock Overview"
**Breadcrumb:** Raw Materials > Stock Overview
**Header buttons:** "Export" (outline) + "Stock Adjustments" (outline, Settings2 icon) + "+ Add Stock Entry" (primary)

---

#### 5 STAT CARDS (grid grid-cols-5 gap-4 mb-4)

```
Card 1: Total Items
  Icon: Boxes, bg-[#EEF2FF], color #6366F1
  Value: "156" text-2xl font-bold
  Sub: "All Warehouses"

Card 2: Total Stock Value
  Icon: Layers, bg-[#F0FDF4], color #16A34A
  Value: "₹48,75,620.00" text-xl font-bold
  Sub: "At Cost"

Card 3: Low Stock Items
  Icon: TrendingDown, bg-[#FEF9C3], color #D97706
  Value: "12" text-2xl font-bold text-[#D97706]
  Sub: "Reorder Required"

Card 4: Out of Stock Items
  Icon: AlertTriangle, bg-[#FEF2F2], color #DC2626
  Value: "3" text-2xl font-bold text-[#DC2626]
  Sub: "Action Required"

Card 5: Stock Movements
  Icon: ArrowLeftRight, bg-[#F5F3FF], color #7C3AED
  Value: "245" text-2xl font-bold
  Sub: "This Month"
```

---

#### FILTER BAR (below stat cards)

```
flex items-center gap-3 flex-wrap

Search input: "Search by material name, code..." flex-1
Warehouse dropdown: "All Warehouses" w-[160px]
Category dropdown: "All Categories" w-[160px]
Stock Status: "All" / In Stock / Low Stock / Out of Stock  w-[160px]

Show Items With: (two checkboxes side by side)
  ☐ Low Stock   ☐ Out of Stock
  Each: shadcn Checkbox + label text-sm text-[#374151] flex items-center gap-2

Apply Filters button (primary, right-aligned)
```

---

#### STOCK SUMMARY TABLE

```
Header row (flex items-center justify-between mb-3):
  "Stock Summary" text-sm font-semibold text-[#374151]
  "View Stock Ledger" button: border outline, BookOpen icon

Columns:
  # | Material | HSN/SAC | Category | Unit | Opening Stock | Inward Qty | Outward Qty | Current Stock | Unit Cost (₹) | Stock Value (₹) | Status | Action

# : text-sm text-[#64748B] w-10
Material: text-sm font-medium text-[#0F172A]
HSN/SAC: text-sm font-mono text-[#374151]
Category: text-sm text-[#374151]
Unit: text-sm text-[#374151]
Opening Stock: text-sm text-right text-[#374151]
Inward Qty: text-sm text-right text-[#15803D] font-medium
Outward Qty: text-sm text-right text-[#DC2626] font-medium
Current Stock: text-sm text-right font-semibold text-[#0F172A]
Unit Cost: text-sm text-right text-[#374151]
Stock Value: text-sm text-right font-medium text-[#374151]

Status badge:
  In Stock:     bg-[#DCFCE7] text-[#15803D]
  Low Stock:    bg-[#FEF3C7] text-[#D97706]
  Out of Stock: bg-[#FEE2E2] text-[#DC2626]

Action: ⋮ menu → View History | Add Stock | Adjust Stock | Set Reorder Level

FOOTER: "Showing 1 to 6 of 156 entries" + pagination | "6 / page" dropdown (right)
```

---

#### BOTTOM SECTION (grid grid-cols-3 gap-6 mt-6)

```
LEFT — Stock Value by Category:
  Title: "Stock Value by Category" text-sm font-semibold
  Donut chart (Recharts PieChart with innerRadius)
  Legend below chart: each category with color dot + name + value + percentage
    Yarn:     ₹22,45,000 (46.0%)
    Chemical: ₹15,20,800 (31.2%)
    Dyes:     ₹6,85,500 (14.0%)
    Others:   ₹4,24,320 (8.8%)
  Total row: "Total" label + "₹48,75,620.00" value, bold

CENTER — Stock Movement (This Month):
  Title: "Stock Movement (This Month)" text-sm font-semibold
  Legend: Inward Qty (teal) | Outward Qty (blue)
  Grouped bar chart (Recharts BarChart):
    X-axis: dates (01 May, 06 May, 11 May, 16 May, 21 May, 26 May, 31 May)
    Two bars per date: Inward (bg-[#14B8A6]) and Outward (bg-[#6366F1])
    Y-axis: 0, 200, 400, 600, 800, 1000

RIGHT — Recent Stock Entries:
  Title: "Recent Stock Entries" text-sm font-semibold
  Top-right: "View All" text button text-[#6366F1] hover:underline

  Each entry (flex items-start gap-3 py-3 border-b border-[#F3F4F6] last:border-0):
    Left icon: w-8 h-8 rounded-full flex items-center justify-center
      Stock Inward:  bg-[#DCFCE7] Arr
<truncated 36393 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.