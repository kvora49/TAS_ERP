do not implement barcode/qr and scan (pwa) for that i will share a detailed plan 

# TAS ERP — Phase 5 Detailed Implementation Plan
**Finished Stock | Weeks 9–10 | 10 Working Days**

> ⚠️ AGENT INSTRUCTION: Every color, layout, component, and behavior is extracted directly from approved screens. Do not substitute or approximate any specification.

---

## Table of Contents
1. [Phase 5 Goals](#1-phase-5-goals)
2. [Design System Additions](#2-design-system-additions)
3. [Sidebar Structure Update](#3-sidebar-structure-update)
4. [Navigation & Route Map](#4-navigation--route-map)
5. [Screen Specifications](#5-screen-specifications)
6. [New Database Tables & SQL](#6-new-database-tables--sql)
7. [API Routes](#7-api-routes)
8. [Day-by-Day Execution Plan](#8-day-by-day-execution-plan)
9. [Phase 5 Completion Checklist](#9-phase-5-completion-checklist)

---

## 1. Phase 5 Goals

By end of Day 10 (Week 10), deployed and working:

- ✅ Finished Stock module in sidebar (expandable: Overview, Design Stock, Adjustments, Transfers, Challans, Barcode/QR)
- ✅ Finished Stock Overview: 6 KPI cards, filter bar, Stock by Design table, right charts panel
- ✅ Stock Detail (per design): design header, colour/size breakdown matrix with godown columns
- ✅ Adjustments List + Add Adjustment with stock check and quantity ± controls
- ✅ Transfers List + Add Transfer with "Check Stock" and Items to Transfer table
- ✅ Challans List + Create Challan + Challan Detail with 4 resolution option buttons
- ✅ Barcode/QR Scanning page with scan area, item details panel, recent scans table
- ✅ Scan (PWA) mobile page with camera feed, quick actions panel, bottom nav

---

## 2. Design System Additions

### 2.1 New Color Tokens — add to globals.css

```css
/* Challan type badges */
--badge-outward-bg: #EEF2FF;      --badge-outward-text: #6366F1;
--badge-inward-bg: #F0FDF4;       --badge-inward-text: #15803D;

/* Challan status badges */
--badge-dispatched-bg: #DCFCE7;   --badge-dispatched-text: #15803D;
--badge-received-bg: #DCFCE7;     --badge-received-text: #15803D;
--badge-intransit-bg: #DBEAFE;    --badge-intransit-text: #1D4ED8;
--badge-pending-bg: #FEF3C7;      --badge-pending-text: #D97706;

/* Transfer status badges */
--badge-completed-bg: #DCFCE7;    --badge-completed-text: #15803D;
--badge-intransit-bg: #DBEAFE;    --badge-intransit-text: #1D4ED8;

/* Adjustment type colors */
--adj-damage-icon: #DC2626;       --adj-damage-bg: #FEE2E2;
--adj-sample-icon: #D97706;       --adj-sample-bg: #FEF3C7;
--adj-scrap-icon: #7C3AED;        --adj-scrap-bg: #EDE9FE;
--adj-correction-icon: #15803D;   --adj-correction-bg: #DCFCE7;

/* Qty change colors in tables */
--qty-decrease: #DC2626;   /* negative adjustments */
--qty-increase: #15803D;   /* positive adjustments */
--value-decrease: #DC2626;
--value-increase: #15803D;

/* Stock status in scanner */
--scan-success-bg: #DCFCE7;      --scan-success-text: #15803D;
--scan-notfound-bg: #FEE2E2;     --scan-notfound-text: #DC2626;

/* Colour dot sizes */
--colour-dot-sm: 12px;   /* in tables */
--colour-dot-md: 16px;   /* in filters/forms */
--colour-dot-lg: 20px;   /* in design headers */

/* PWA bottom nav */
--pwa-nav-bg: #FFFFFF;
--pwa-nav-active: #6366F1;
--pwa-nav-inactive: #94A3B8;
--pwa-scan-btn-bg: #6366F1;
--pwa-scan-btn-size: 56px;

/* Scan frame */
--scan-frame-border: #6366F1;
--scan-overlay-bg: rgba(0,0,0,0.5);
```

### 2.2 Colour Dot Component

Used throughout Phase 5 — coloured circles representing garment colours:
```
Small (in tables): w-3 h-3 rounded-full flex-shrink-0
Medium (in forms/filters): w-4 h-4 rounded-full flex-shrink-0
Large (in headers): w-5 h-5 rounded-full flex-shrink-0

Color: uses design_colours.colour_hex
  Red → bg-[#EF4444]
  Blue → bg-[#3B82F6]
  Green → bg-[#22C55E]
  Yellow → bg-[#EAB308]
  Black → bg-[#0F172A]
  White → bg-white border border-[#E5E7EB]
  Others → bg-[colour_hex]

Multiple colours in a row (Overview table Colours column):
  flex items-center gap-1
  Show up to 4 dots, then "+N" text: text-xs text-[#64748B] font-medium
  e.g. ●●●●+2
```

### 2.3 Resolution Options Row (Challan Detail)

4 action option buttons in a row:
```
Container: bg-white rounded-xl border border-[#E5E7EB] p-4 mb-4

Header: "Resolution Options" text-sm font-semibold text-[#0F172A] mb-1
Sub: "Choose how you want to resolve this challan." text-xs text-[#64748B] mb-4

Buttons row: grid grid-cols-4 gap-3

Each button: flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer
  transition-all hover:shadow-md hover:border-[color]

  1. Return Items:
     border-[#DCFCE7] hover:border-[#15803D] bg-[#F0FDF4]
     CheckCircle2 icon size-6 text-[#15803D]
     "Return Items" text-sm font-semibold text-[#15803D]
     "Return full or partial" text-xs text-[#64748B]

  2. Convert to Bill:
     border-[#DBEAFE] hover:border-[#1D4ED8] bg-[#EFF6FF]
     FileText icon size-6 text-[#1D4ED8]
     "Convert to Bill" text-sm font-semibold text-[#1D4ED8]
     "Create sales invoice" text-xs text-[#64748B]

  3. Mark as Partial:
     border-[#FEF3C7] hover:border-[#D97706] bg-[#FFFBEB]
     Truck icon size-6 text-[#D97706]
     "Mark as Partial" text-sm font-semibold text-[#D97706]
     "Close partially delivered" text-xs text-[#64748B]

  4. Create Transfer:
     border-[#EDE9FE] hover:border-[#7C3AED] bg-[#F5F3FF]
     ArrowLeftRight icon size-6 text-[#7C3AED]
     "Create Transfer" text-sm font-semibold text-[#7C3AED]
     "Move to another godown" text-xs text-[#64748B]
```

### 2.4 Check Stock Button Pattern

Used in Add Adjustment, Add Transfer, Create Challan:
```
Button: border border-[#6366F1] text-[#6366F1] h-10 px-4 rounded-lg text-sm font-medium
        flex items-center gap-2 hover:bg-[#EEF2FF]
        Search icon size-4 + "Check Stock" text

On click: shows stock availability row below the Design/Colour/Size selects
Stock row: bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] px-4 py-3 mt-3
  grid grid-cols-4 (or more) gap-6 text-sm
  Each: label text-xs text-[#64748B] + value text-sm font-semibold text-[#0F172A]
```

### 2.5 Quantity ± Control

Used in Add Adjustment, Add Transfer, Create Challan:
```
Container: flex items-center gap-0

Minus button: w-9 h-10 border border-[#E5E7EB] rounded-l-lg
  bg-white hover:bg-[#F1F5F9] flex items-center justify-center
  Minus icon size-4 text-[#374151]

Number input: w-24 h-10 text-center border-t border-b border-[#E5E7EB]
  text-sm font-medium text-[#0F172A] focus:ring-0 focus:border-[#E5E7EB]

Plus button: w-9 h-10 border border-[#E5E7EB] rounded-r-lg
  bg-white hover:bg-[#F1F5F9] flex items-center justify-center
  Plus icon size-4 text-[#374151]

Constraint label (below): "Max available: 430 Pcs" text-xs text-[#15803D]
  Only shown when max available is known
```

### 2.6 Stock Table Matrix Layout (Stock Detail)

Unique hierarchical table pattern:
```
Table structure: colour groups with size sub-rows

Colour group rows:
  First row of each colour: shows colour name with dot, first size, godown qtys, totals
  Sub-rows: remaining sizes (indented but same column alignment)
  Total row: "Total ([Colour])" bold, sum of all sizes for that colour

Column structure:
  # | Colour | Size | [Godown columns...] | Total Qty (Pcs) | Avg. Cost (₹) | Total Value (₹)

  # : row number, only on first row of colour group, text-sm text-[#64748B]
  Colour: only on first row — flex items-center gap-2, colour dot + name
           subsequent rows: empty
  Size: text-sm text-[#374151]
  Godown cols: text-sm text-right text-[#374151] — quantity per godown
  Total Qty: text-sm text-right font-medium text-[#0F172A]
  Avg. Cost: text-sm text-right text-[#64748B]
  Total Value: text-sm text-right text-[#374151]

Total rows (per colour): bg-[#F9FAFB] font-semibold
  "Total (Red)" etc. spans Colour+Size cols
```

### 2.7 Scan Frame Component (PWA)

```
Container: relative w-full rounded-xl overflow-hidden
  Camera feed: absolute inset-0 bg-black (uses html5-qrcode)
  Dark overlay: absolute inset-0 bg-black/50

Scan frame overlay (center):
  absolute inset-0 flex items-center justify-center
  Frame: w-64 h-64 relative
    Corner brackets (CSS):
      4 corners — 24px × 24px L-shaped lines
      color: #6366F1, stroke: 3px
      Top-left:     border-top border-left
      Top-right:    border-top border-right
      Bottom-left:  border-bottom border-left
      Bottom-right: border-bottom border-right

  Auto Detect badge (top-left of frame):
    absolute top-2 left-2 bg-black/70 rounded-full px-3 py-1
    green dot (w-2 h-2 rounded-full bg-[#22C55E] animate-pulse) + "Auto Detect ON"
    text-xs text-white

  Camera controls (bottom-right of frame):
    Expand icon button — bg-black/50 rounded w-8 h-8

Zoom controls (below camera, flex items-center justify-center gap-2):
  Pills: "0.5x" | "1x" | "2x"
  Active: bg-[#0F172A] text-white
  Inactive: bg-white/20 text-white border border-white/30
  Each: px-3 py-1 rounded-full text-sm font-medium

Capture / gallery button (bottom-right corner, absolute):
  w-9 h-9 rounded-lg bg-black/50 ImageIcon inside
```

### 2.8 PWA Bottom Navigation

Only shown on Scan (PWA) page:
```
Container: fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50
Layout: flex items-center justify-around h-16 px-4

5 items:
  Home:    Home icon + "Home" label
  Scan:    QrCode icon + "Scan" label (ACTIVE — center, larger)
  History: Clock icon + "History" label
  Bill(2): ShoppingCart icon + "Bill (2)" label — shows count badge
  More:    MoreHorizontal icon + "More" label

Active (Scan): text-[#6366F1], icon size-6
Inactive: text-[#94A3B8], icon size-5

Scan button (center): slightly elevated
  The icon is wrapped in: w-14 h-14 rounded-full bg-[#6366F1] flex items-center justify-center
  QrCode icon size-7 text-white
  No text label needed below (it's the main action)
```

### 2.9 Impact Summary Panel (Add Adjustment)

```
Container: bg-white rounded-xl border border-[#E5E7EB] p-5

Title: "Impact Summary" text-sm font-semibold text-[#0F172A] mb-4

Rows (flex justify-between py-2.5 border-b border-[#F3F4F6] last:border-0):
  Quantity Change (Pcs): -25 → text-[#DC2626] font-bold
                          +30 → text-[#15803D] font-bold
  Value Impact (₹):      -4,762.50 → text-[#DC2626] font-bold
                          +5,430.00 → text-[#15803D] font-bold
  New Available Qty:     425 → text-[#0F172A] font-semibold
  New Stock Value (₹):   80,787.50 → text-[#0F172A] font-semibold
```

### 2.10 Transfer Summary Panel

```
Container: bg-white rounded-xl border border-[#E5E7EB] p-5

Title: "Transfer Summary" text-sm font-semibold mb-4

Rows:
  Total Items:        1
  Total Quantity (Pcs): 200
  Total Value (₹):    38,100.00

Info note (below rows):
  bg-[#EFF6FF] rounded-lg p-3 mt-3
  Info icon text-[#6366F1] + text-xs text-[#374151]
  "Stock will be deducted from From Godown and added to To Godown after saving."
```

### 2.11 Quick Stats Sidebar (Finished Stock Overview)

```
Position: bottom-left of sidebar — fixed within sidebar below main nav
bg-white border-t border-[#E5E7EB] p-3

"Quick Stats" text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2

Stat 1: ShoppingBag icon text-[#6366F1] + "56 Total Designs" text-sm text-[#374151]
Stat 2: Package icon text-[#6366F1] + "1,78,450 Total Stock (Pcs)" text-xs text-[#64748B]
```

---

## 3. Sidebar Structure Update

Add Finished Stock section and Scan (PWA) to sidebar:

```
[existing items above...]

Finished Stock ▸             Boxes icon (expandable)
  • Overview                 → /finished-stock
  • Design Stock             → /finished-stock/designs
  • Adjustments              → /finished-stock/adjustments
  • Transfers                → /finished-stock/transfers
  • Challans                 → /finished-stock/challans
  • Barcode / QR             → /finished-stock/barcode-qr

Sales                        Receipt icon (top-level, Coming Soon)
Reports                      BarChart3 icon (top-level, Coming Soon)
Masters                      Settings2 icon (expandable, already exists)
Settings                     Settings icon

Scan (PWA)                   QrCode icon — at very bottom, special item
  Style: text-[#94A3B8] hover:bg-[#1E1B4B]
  Active: bg-[#312E81] text-white
```

**Quick Stats** at the very bottom of sidebar below user card (Section 2.11).

---

## 4. Navigation & Route Map

```
Finished Stock:
  /finished-stock                    → Finished Stock Overview
  /finished-stock/designs            → All designs list (same as Overview but design-focused)
  /finished-stock/designs/[id]       → Stock Detail (per design)
  /finished-stock/adjustments        → Adjustments List
  /finished-stock/adjustments/new    → Add Adjustment
  /finished-stock/adjustments/[id]   → Adjustment Detail (view only)
  /finished-stock/transfers          → Transfers List
  /finished-stock/transfers/new      → Add Transfer
  /finished-stock/transfers/[id]     → Transfer Detail
  /finished-stock/challans           → Challans List
  /finished-stock/challans/new       → Create Challan
  /finished-stock/challans/[id]      → Challan Detail
  /finished-stock/barcode-qr         → Barcode / QR Scanning
  /scan                              → Scan (PWA) — mobile-optimized
```

---

## 5. Screen Specifications

---

### 5.1 Finished Stock Overview — `/finished-stock`

**Page title:** "Finished Stock Overview"
**Breadcrumb:** Finished Stock > Overview
**Header area (top-right, flex items-center gap-3):**
  "Export" (outline, Download icon) + "Filters" (outline, Filter icon) + Refresh icon + Bell (3 badge) + SA avatar

**Date/time display below header buttons:**
  "Today, 26 May 2024 • 10:45 AM" text-xs text-[#94A3B8]

---

#### FILTER BAR (ABOVE stat cards — full width)

```
Layout: flex items-center gap-3 mb-4 flex-wrap

Godown:    "All Godowns"  select w-[160px]
Brand:     "All Brands"   select w-[160px]
Design:    "Select Design" select w-[180px]
Colour:    "All Colours"  select w-[160px]
From Date: date picker w-[140px]
To Date:   date picker w-[140px]
Apply:     primary button h-10 px-4 bg-[#6366F1] Search icon + "Apply"
```

---

#### 6 STAT CARDS (grid grid-cols-6 gap-4 mb-6)

```
Card 1: Total Stock (Pcs)
  Icon: Boxes, bg-[#EEF2FF], color #6366F1
  Value: "1,78,450" text-2xl font-bold
  Sub: "All Godowns"

Card 2: Total Designs
  Icon: Palette, bg-[#F0FDF4], color #16A34A
  Value: "56" text-2xl font-bold
  Sub: "All Brands"

Card 3: Total Colours
  Icon: Droplets, bg-[#FFF7ED], color #EA580C
  Value: "128" text-2xl font-bold
  Sub: "All Designs"

Card 4: Total Sizes
  Icon: Ruler, bg-[#FEF9C3], color #D97706
  Value: "8" text-2xl font-bold
  Sub: "S, M, L, XL, XXL"

Card 5: Total Value
  Icon: IndianRupee, bg-[#F5F3FF], color #7C3AED
  Value: "₹3,42,18,750" text-xl font-bold
  Sub: "At Cost"

Card 6: Active Godowns
  Icon: Building2, bg-[#EEF2FF], color #6366F1
  Value: "4" text-2xl font-bold
  Sub: "All Locations"
```

---

#### MAIN CONTENT AREA (grid grid-cols-3: left=2, right=1)

**LEFT — Stock by Design Table:**
```
Title row: flex items-center justify-between mb-3
  "Stock by Design (Top 10)" text-sm font-semibold
  "View All Designs →" text-sm text-[#6366F1]

Columns: # | Design Code | Design Name | Total Qty (Pcs) | Colours | Sizes | Godown | Value (₹) | Action

# : w-10 text-sm text-[#64748B]
Design Code: text-sm font-mono text-[#374151] — "DES-001"
Design Name: text-sm font-medium text-[#0F172A]
Total Qty: text-sm text-right font-medium text-[#374151]
Colours: flex items-center gap-1
  Up to 4 colour dots + "+N" if more (Section 2.2)
Sizes: text-sm text-[#64748B] — "S, M, L, XL"
Godown: text-sm text-[#374151]
  "All (4)" if in multiple godowns
  "Main Godown" if only one
Value: text-sm text-right text-[#374151]
Action: Eye icon button (→ /finished-stock/designs/[id])

FOOTER: "Showing 1 to 10 of 56 designs" + pagination
```

**RIGHT — 2 Charts (stacked):**

**Stock by Godown (donut chart):**
```
Title: "Stock by Godown" text-sm font-semibold + "View All →" right

Donut chart (Recharts PieChart):
  Center label: "1,78,450\nTotal Pcs" text-sm font-bold

Legend (right of chart, flex flex-col gap-2):
  Each: colored dot + godown name + qty + percentage
    Main Godown: ● 82,450 (46.1%)
    Godown A:    ● 38,600 (21.6%)
    Godown B:    ● 29,300 (16.4%)
    Godown C:    ● 16,100 (9.0%)
    Godown D:    ● 11,950 (6.7%)
  Colors: #6366F1 / #10B981 / #F59E0B / #EF4444 / #8B5CF6
```

**Stock by Size (bar chart):**
```
Title: "Stock by Size (Overall)" text-sm font-semibold mt-4

Recharts BarChart (vertical bars):
  X-axis: size labels (S, M, L, XL, XXL, XXXL)
  Y-axis: qty (0, 20K, 40K, 60K, 80K)
  Bars: bg-[#6366F1], rounded-t-sm
  Value label above each bar: text-xs text-[#374151]
    28,450 / 44,890 / 54,320 / 32,160 / 12,850 / 5,780
```

**Quick Actions (below charts):**
```
Title: "Quick Actions" text-xs font-semibold text-[#94A3B8] uppercase mb-3

4 action buttons (grid grid-cols-2 gap-2):
  Add Adjustment: bg-[#FEF2F2] text-[#DC2626] SlidersHorizontal icon
  Add Transfer:   bg-[#F0FDF4] text-[#16A34A] ArrowLeftRight icon
  Create Challan: bg-[#FFFBEB] text-[#D97706] Truck icon
  Scan QR:        bg-[#EDE9FE] text-[#7C3AED] QrCode icon

Each: flex items-center gap-2 p-3 rounded-lg text-sm font-medium cursor-pointer hover:opacity-80
```

---

### 5.2 Stock Detail (per design) — `/finished-stock/designs/[id]`

**Page title:** "2. Stock Detail (per design)" ← note: numbered title from screen
**Breadcrumb:** Finished Stock > Design Stock > DES-001
**Header button:** "← Back" (outline)

---

#### DESIGN HEADER CARD

```
Full-width card: bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4

Layout: flex items-start gap-6

LEFT — Design thumbnail + info:
  Image: w-20 h-24 rounded-xl object-cover bg-[#F1F5F9] border border-[#E5E7EB]
  Design Code: "DES-001 - Premium Kurti" text-lg font-bold text-[#0F172A]
  Brand: text-sm text-[#64748B]
  Category: text-sm text-[#64748B]
  Unit: text-sm text-[#64748B]
  Base Cost: text-sm text-[#64748B] "190.50"

RIGHT — 4 KPI tiles (flex gap-6):
  Total Qty (Pcs): "28,450" text-2xl font-bold + Boxes icon bg-[#EEF2FF]
  Total Colours:   "6" + Palette icon bg-[#F0FDF4]
  Total Sizes:     "5" + Ruler icon bg-[#FFF7ED]
  Total Value (₹): "54,10,750" + IndianRupee icon bg-[#EEF2FF]

  Each tile: w-32 flex flex-col items-center gap-1 bg-[#F8FAFC] rounded-xl p-3
  Icon: w-8 h-8 rounded-lg flex items-center justify-center (colors above)
  Value: text-xl font-bold text-[#0F172A]
  Label: text-xs text-[#64748B]
```

---

#### FILTER ROW (below header)

```
flex items-center gap-4 mb-4

Godown: "All Godowns" select w-[180px]
Brand:  "All Brands"  select w-[180px]
Filters button: border outline, SlidersHorizontal + "Filters"
Export button (right): outline, Download + "Export"
```

---

#### STOCK BY COLOUR / SIZE TABLE

```
Title: "Stock by Colour / Size" text-sm font-semibold mb-3

Table with merged godown header:
  HEADER ROW 1: # | Colour | Size | [colspan="3"] Godown | Total Qty (Pcs) | Avg. Cost (₹) | Total Value (₹)
  HEADER ROW 2: (empty) | (empty) | (empty) | Main Godown (Pcs) | Godown A (Pcs) | Godown B (Pcs) | (continues)

  Godown sub-headers: text-xs text-[#64748B] text-center bg-[#F9FAFB]

DATA ROWS (Section 2.6 matrix layout):
  Each colour group: multiple size rows + summary row
  
  Colour first row: shows # + colour dot + name + S row data
  S row: 450 | 320 | 230 | 1,000 | 190.50 | 1,90,500
  M row: 600 | 450 | 350 | 1,400 | 190.50 | 2,66,700
  L row: 550 | 420 | 330 | 1,300 | 190.50 | 2,47,650
  XL row: 300 | 250 | 150 | 700 | 190.50 | 1,33,350
  XXL row: 200 | 180 | 120 | 500 | 190.50 | 95,250
  Total (Red) row: bold, bg-[#F9FAFB], spans # + Colour + Size
    → 2,100 | 1,620 | 1,180 | 4,900 | (empty) | 9,33,450

  Row hover: bg-[#F8FAFC]
  Total rows: bg-[#F9FAFB] font-semibold

FOOTER: "Showing 1 to 6 of 6 colours" + pagination (< 1 >) + "Export" outline button (right)
```

---

### 5.3 Adjustments List — `/finished-stock/adjustments`

**Page title:** "3. Adjustments List"
**Breadcrumb:** Finished Stock > Adjustments
**Header button:** "+ Add Adjustment" (primary)

---

#### FILTER BAR

```
flex items-center gap-3

From Date:       date picker w-[150px]
To Date:         date picker w-[150px]
Adjustment Type: "All Types" select w-[160px]
Godown:          "All Godowns" select w-[160px]
Filters:         outline button SlidersHorizontal + "Filters"
```

---

#### 4 STAT CARDS (grid grid-cols-4 gap-4 mb-4)

```
Card 1: Total Adjustments
  Icon: ArrowUpDown, bg-[#EEF2FF], color #6366F1
  Value: "45" text-2xl font-bold
  Sub: "This Period"

Card 2: Total Qty Change (Pcs)
  Icon: Boxes, bg-[#FEE2E2], color #DC2626
  Value: "-1,250" text-2xl font-bold text-[#DC2626]
  Sub: "Net Quantity Change"

Card 3: Total Value Impact (₹)
  Icon: IndianRupee, bg-[#FEE2E2], color #DC2626
  Value: "-2,48,730" text-2xl font-bold text-[#DC2626]
  Sub: "Net Value Impact"

Card 4: Total Types
  Icon: ClipboardList, bg-[#EEF2FF], color #6366F1
  Value: "5" text-2xl font-bold
  Sub: "Adjustment Types"
```

---

#### ADJUSTMENTS TABLE

```
Columns: # | Date ↕ | Adj. No. | Type | Design / Colour | Godown | Qty Change (Pcs) | Value Impact (₹) | Reason | Created By | Action

# : text-sm text-[#64748B]
Date: text-sm text-[#374151] — sortable (↕ icon in header)
Adj. No.: text-sm font-mono text-[#6366F1] hover:underline — "ADJ-00045"
Type: text-sm text-[#374151] (Damage / Sample / Scrap / Correction)
Design/Colour: text-sm text-[#374151] — "DES-001 / Red"
Godown: text-sm text-[#374151]
Qty Change: text-sm font-semibold text-right
  Negative: text-[#DC2626] — "-45"
  Positive: text-[#15803D] — "+30"
Value Impact: text-sm font-semibold text-right
  Negative: text-[#DC2626] — "-8,597.50"
  Positive: text-[#15803D] — "+5,430.00"
Reason: text-sm text-[#64748B]
Created By: text-sm text-[#374151]
Action: Eye icon button only (view detail)

FOOTER: pagination + per-page
```

---

### 5.4 Add Adjustment — `/finished-stock/adjustments/new`

**Page title:** "4. Add Adjustment"
**Breadcrumb:** Finished Stock > Adjustments > Add Adjustment
**Header button:** "← Back to Adjustments" (outline, top-right)

**Layout:** Main form (left-center) + Right panel (Impact Summary + Attachment)

---

#### ADJUSTMENT DETAILS SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Adjustment Details" text-sm font-semibold text-[#0F172A] mb-4

Grid grid-cols-4 gap-4:
  Adjustment Type * [select with colored icon]
    Options with icons:
      🔴 Damage          → icon bg-[#FEE2E2] color #DC2626
      🟡 Sample          → icon bg-[#FEF3C7] color #D97706
      🟣 Scrap           → icon bg-[#EDE9FE] color #7C3AED
      🟢 Correction      → icon bg-[#DCFCE7] color #15803D
      📦 Stock Transfer  → icon bg-[#DBEAFE] color #1D4ED8

  Adjustment Date * [date picker]
  Godown *          [select from godowns]
  Reference No.     [text, auto-generated placeholder: "Auto-generated"]

Reason * (below, half width):
  [select: Fabric Damage / Sample Out / Stitch Defect / Stock Correction / Client Sample / Print Defect / Count Correction / Other]

Description/Remarks (below, half width):
  [textarea h-24 resize-none with char counter: "39 / 250"]
```

---

#### STOCK SELECTION SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Stock Selection" text-sm font-semibold mb-4

Grid grid-cols-4 gap-4 items-end:
  Design *  [searchable select — "DES-001 - Premium Kurti"]
  Colour *  [select with color dot: ● Red]
  Size *    [select: S/M/L/XL/XXL]
  [Check Stock button — Section 2.4]

STOCK AVAILABILITY ROW (shows after Check Stock click):
  bg-[#F9FAFB] rounded-lg p-4 mt-3 grid grid-cols-4 gap-6:
    Godown: "Main Godown"
    Available Qty (Pcs): "450"
    Unit Cost (₹): "190.50"
    Stock Value (₹): "85,725.00"

QUANTITY + VALUE SECTION (below availability):
  Grid grid-cols-3 gap-4 mt-4:
    Quantity Change (Pcs) * [± control from Section 2.5]
    Unit Cost (₹)          [number, auto-fills from stock, editable]
    Total Value Impact (₹) [computed read-only: qty × unit_cost, bg-[#F9FAFB]]

NOTE (below quantity row):
  Blue info banner:
  "Note: Quantity will be reduced from available stock." (for negative adjustments)
  "Note: Quantity will be added to available stock." (for positive/correction)
```

---

#### RIGHT PANEL

**Impact Summary (Section 2.9):**
```
Updates live as user changes Qty and selects Design/Colour/Size.
```

**Attachment (Photo):**
```
Card: bg-white rounded-xl border border-[#E5E7EB] p-5 mt-4

Title: "Attachment (Photo)" text-sm font-semibold
Subtitle: "Upload photo of damaged / sample item (optional)" text-xs text-[#94A3B8] mb-3

Dropzone (compact):
  CloudUpload icon + "Drag and drop image here" + "or"
  "Browse" button
  "JPG, PNG, WEBP (Max. 5MB)"

Uploaded image preview (when file selected):
  w-full h-48 rounded-xl object-cover relative
  × button: absolute top-2 right-2 w-6 h-6 rounded-full bg-[#EF4444] text-white X icon
  Filename below: "damage_red_fabric.jpg (1.2 MB)" text-xs text-[#64748B]
```

**Footer buttons:**
```
flex justify-between border-t border-[#E5E7EB] pt-4 mt-4
  Cancel: outline h-10 px-4
  Save Adjustment: primary h-10 px-4 bg-[#6366F1] Save icon
```

---

### 5.5 Transfers List — `/finished-stock/transfers`

**Page title:** "5. Transfers List"
**Breadcrumb:** Finished Stock > Transfers
**Header button:** "+ Add Transfer" (primary)

---

#### FILTER BAR

```
From Date | To Date | From Godown | To Godown | Status | Filters button
```

---

#### 4 STAT CARDS (grid grid-cols-4 gap-4 mb-4)

```
Card 1: Total Transfers
  Icon: ArrowLeftRight, bg-[#EEF2FF], color #6366F1
  Value: "32" text-2xl font-bold | Sub: "This Period"

Card 2: Total Quantity (Pcs)
  Icon: Boxes, bg-[#F0FDF4], color #16A34A
  Value: "12,450" text-2xl font-bold | Sub: "Transferred"

Card 3: Total Value (₹)
  Icon: IndianRupee, bg-[#FFF7ED], color #EA580C
  Value: "18,76,350" text-2xl font-bold | Sub: "Transferred Value"

Card 4: Completed Transfers
  Icon: CheckCircle2, bg-[#F0FDF4], color #16A34A
  Value: "28" text-2xl font-bold | Sub: "This Period"
```

---

#### TRANSFERS TABLE

```
Columns: # | Transfer No. | Date | From Godown | To Godown | Total Qty (Pcs) | Total Value (₹) | Status | Created By | Action

Transfer No.: text-sm font-mono text-[#6366F1] — "TRF-00032"
Status badges:
  Completed:  bg-[#DCFCE7] text-[#15803D]
  In Transit: bg-[#DBEAFE] text-[#1D4ED8]
  Pending:    bg-[#FEF3C7] text-[#D97706]

Action: Eye icon only
```

---

### 5.6 Add Transfer — `/finished-stock/transfers/new`

**Page title:** "6. Add Transfer"
**Breadcrumb:** Finished Stock > Transfers > Add Transfer
**Header button:** "← Back to Transfers" (outline, top-right)

**Layout:** Main form (left-center) + Right panel (Transfer Summary + info note)

---

#### TRANSFER DETAILS SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Transfer Details" text-sm font-semibold mb-4

Grid grid-cols-4 gap-4:
  Transfer Date *    [date picker]
  From Godown *      [select from godowns — "Main Godown"]
  To Godown *        [select — MUST be different from From Godown, validation]
  Reference No.      [text, "Auto-generated" placeholder]

Grid grid-cols-2 gap-4 mt-4:
  Reason *           [select: Stock Rebalancing / Sales Order / Godown Consolidation / Other]
  Remarks (Optional) [textarea h-20 resize-none char counter "46/250"]
```

---

#### STOCK SELECTION SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Stock Selection" text-sm font-semibold mb-4

Grid grid-cols-4 gap-4 items-end:
  Design *  [searchable select]
  Colour *  [select with dot]
  Size *    [select]
  [Check Stock button]

STOCK AVAILABILITY ROW (after Check Stock):
  bg-[#F9FAFB] p-4 rounded-lg grid grid-cols-4 gap-6:
    From Godown: "Main Godown"
    Available Qty (Pcs): "450"
    Reserved Qty (Pcs): "20"
    Free Qty (Pcs): "430"

QUANTITY + VALUE:
  Grid grid-cols-3 gap-4 mt-4:
    Transfer Quantity (Pcs) * [± control from Section 2.5]
      "Max available: 430 Pcs" text-xs text-[#15803D] below
    Unit Cost (₹)             [read-only, auto-fills: "190.50", bg-[#F9FAFB]]
    Total Value (₹)           [computed: qty × cost, bg-[#F9FAFB]]

"+ Add Another Item" button:
  border border-dashed border-[#6366F1] text-[#6366F1] h-9 px-3 rounded-lg text-sm
  Plus icon + "Add Another Item"
```

---

#### ITEMS TO TRANSFER TABLE

```
Shows all items added so far:
Title: "Items to Transfer (N)" text-sm font-semibold mb-2

Columns: # | Design | Colour | Size | From Godown | To Godown | Qty (Pcs) | Unit Cost (₹) | Total Value (₹) | Action

Colour: colored dot + name
Action: Trash2 icon text-[#EF4444]

FOOTER ROW: flex justify-between px-3 py-2 bg-[#F9FAFB] rounded-b-lg text-sm
  "Total Items: 1" text-[#64748B]
  "Total Quantity: 200 Pcs | Total Value: ₹38,100.00" text-[#374151] font-medium
```

**RIGHT PANEL — Transfer Summary (Section 2.10)**

**Footer buttons:**
```
flex justify-end gap-3 border-t pt-4 mt-4
  Cancel: outline
  Save Transfer: primary bg-[#6366F1] Save icon
```

---

### 5.7 Challans List — `/finished-stock/challans`

**Page title:** "7. Challans List"
**Breadcrumb:** Finished Stock > Challans
**Header button:** "+ Create Challan" (primary)

---

#### FILTER BAR

```
From Date | To Date | Challan Type (All Types/Inward/Outward) | Godown | Status | Filters button
```

---

#### 4 STAT CARDS (grid grid-cols-4 gap-4 mb-4)

```
Card 1: Total Challans
  Icon: ClipboardList, bg-[#EEF2FF], color #6366F1
  Value: "24" | Sub: "This Period"

Card 2: Total Quantity (Pcs)
  Icon: Boxes, bg-[#F0FDF4], color #16A34A
  Value: "9,850" | Sub: "This Period"

Card 3: Total Value (₹)
  Icon: IndianRupee, bg-[#FFF7ED], color #EA580C
  Value: "14,62,300" | Sub: "This Period"

Card 4: Pending Challans
  Icon: Truck, bg-[#FEF9C3], color #D97706
  Value: "3" text-[#D97706] font-bold | Sub: "Awaiting Dispatch"
```

---

#### CHALLANS TABLE

```
Columns: # | Challan No. | Challan Date ↕ | Type | From Godown | To | Total Qty (Pcs) | Total Value (₹) | Status | Created By | Action

Challan No.: text-sm font-mono text-[#6366F1] — "CH-00024"
Type badge:
  Outward: bg-[#EEF2FF] text-[#6366F1]
  Inward:  bg-[#DCFCE7] text-[#15803D]
To column: shows "Client - ABC Textiles" or "Supplier - XYZ Fabrics"
Status badges:
  Dispatched: bg-[#DCFCE7] text-[#15803D]
  Received:   bg-[#DCFCE7] text-[#15803D]
  In Transit: bg-[#DBEAFE] text-[#1D4ED8]
  Pending:    bg-[#FEF3C7] text-[#D97706]

Actions: Eye + ▼ dropdown button (side-by-side)
  ▼ dropdown: Print | Download | Cancel

FOOTER: pagination + per-page
INFO BANNER (blue, below table):
  "Inward: Stock coming in to godown from supplier. | Outward: Stock going out to client or other location."
```

---

### 5.8 Create Challan — `/finished-stock/challans/new`

**Page title:** "8. Create Challan"
**Breadcrumb:** Finished Stock > Challans > Create Challan
**Header button:** "← Back to Challans" (outline, top-right)

**Layout:** Main form (left-center) + Right panel (Challan Summary + Dispatch Info)

---

#### CHALLAN DETAILS SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Challan Details" text-sm font-semibold mb-4

Grid grid-cols-4 gap-4:
  Challan Date *   [date picker]
  Challan Type *   [select: Outward / Inward]
  From Godown *    [select]
  Reference No.    [text, "Auto-generated"]

Grid grid-cols-2 gap-4 mt-4:
  To (Party) *     [searchable select — "Client - ABC Textiles"]
  Remarks (Optional) [textarea h-20 "35/250"]
```

---

#### ADD ITEMS SECTION

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4
Title: "Add Items" text-sm font-semibold mb-4

Grid grid-cols-4 gap-4 items-end:
  Design *   [searchable select]
  Colour *   [select with dot]
  Size *     [select]
  [Check Stock button]

STOCK AVAILABILITY ROW (same as Add Transfer):
  From Godown | Available Qty | Reserved Qty | Free Qty

QUANTITY + VALUE:
  Grid grid-cols-3 gap-4 mt-4:
    Quantity (Pcs) * [± control]
    Unit Cost (₹)    [read-only]
    Total Value (₹)  [computed]

"+ Add Another Item" button (same style as Add Transfer)

ITEMS ADDED TABLE:
Title: "Items Added (N)"
Columns: # | Design | Colour | Size | From Godown | To (Party) | Qty (Pcs) | Unit Cost (₹) | Total Value (₹) | Action

FOOTER ROW: Total Items | Total Quantity | Total Value
```

---

#### RIGHT PANEL

**Challan Summary:**
```
Title: "Challan Summary" text-sm font-semibold + ClipboardList icon

Rows: Total Items | Total Quantity (Pcs) | Total Value (₹)

Info note: bg-[#EFF6FF] rounded-lg p-3 mt-3
  "After saving, the challan will be available for dispatch and will reflect in stock movement."
```

**Dispatch Info (Optional):**
```
Title: "Dispatch Info (Optional)" text-sm font-semibold mt-4

Fields (stacked, gap-3):
  Transporter:  [select — "Shree Transport"]
  LR / AWB No.: [text — "LR123456789"]
  Dispatched By: [select from users — "Ramesh Patel"]
  E-Way Bill No. (Optional): [text — "331234567890"]
```

**Footer:**
```
flex justify-end gap-3 border-t pt-4 mt-4
  Cancel + Save Challan (primary, Save icon)
```

---

### 5.9 Challan Detail — `/finished-stock/challans/[id]`

**Page title:** "9. Challan Detail"
**Breadcrumb:** Finished Stock > Challans > CH-00024
**Status badge (top-right of header area):** "DISPATCHED" text-sm font-semibold text-[#15803D]
**Header buttons:** "← Back to Challans" + "Print" + "Download ▼" + "More ···"

---

#### CHALLAN HEADER CARD

```
Full-width card: bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4

Layout: flex items-start gap-8

LEFT — Core info (grid grid-cols-2 gap-x-8 gap-y-3):
  Challan No. + value (text-2xl font-bold "CH-00024") + Delivery truck icon
  Challan Date | Challan Date value with Calendar icon

CENTER — Type + routing:
  Type badge: "Outward" bg-[#EEF2FF] text-[#6366F1]
  From Godown: "Main Godown"
  To (Party): "Client - ABC Textiles"

RIGHT — Transport details (grid grid-cols-2 gap-3):
  LR / AWB No. | Transporter | Dispatched By | E-Way Bill No. | Remarks
```

---

#### RESOLUTION OPTIONS (Section 2.3)

```
4-button row as specified in Section 2.3:
Return Items | Convert to Bill | Mark as Partial | Create Transfer
```

---

#### ITEMS TABLE

```
Title: "Items" text-sm font-semibold mb-3

Columns: # | Design | Colour | Size | From Godown | To (Party) | Qty (Pcs) | Unit Cost (₹) | Total Value (₹)

Design: "DES-001\nPremium Kurti" (two-line, name below code)
Colour: dot + name
All values: read-only, text-sm

FOOTER: Total Items: 1 | Total Quantity: 200 Pcs | Total Value: ₹38,100.00
```

---

#### ITEM-WISE STOCK SUMMARY (below items table)

```
Title: "Item-wise Stock Summary" text-sm font-semibold mb-3

4 mini stat cards (grid grid-cols-4 gap-4):
  Available Qty (Pcs): "450" + Boxes icon bg-[#EEF2FF]
    Sub: "In Main Godown"
  Reserved Qty (Pcs): "20" + Bookmark icon bg-[#FEF9C3]
    Sub: "Reserved for Orders"
  Free Qty (Pcs): "430" text-[#15803D] font-bold + CheckCircle bg-[#DCFCE7]
    Sub: "Available to Dispatch"
  Dispatched Qty (Pcs): "200" text-[#6366F1] font-bold + Truck bg-[#EEF2FF]
    Sub: "In this Challan"
```

---

#### CHALLAN TIMELINE

```
Title: "Challan Timeline" text-sm font-semibold mb-4

Horizontal timeline (4 steps):
  Created → Dispatched → In Transit → Completed (Pending)

Each step:
  Circle: Completed=green checkmark, Active=purple ring (In Transit), Pending=gray dashed ring
  Label: step name + date/time + "By [User]"

Connector lines: green between done steps, gray-dashed before pending

Note banner (blue, below timeline):
  "This challan has been dispatched from Main Godown to Client - ABC Textiles."
```

---

#### RIGHT PANEL (grid grid-cols-3: main=2, right=1)

**Challan Summary:**
```
Title: "Challan Summary" ClipboardList icon
Rows: Total Items | Total Quantity (Pcs) | Total Value (₹)
```

**Stock Impact:**
```
Title: "Stock Impact" text-sm font-semibold mt-4

Rows (flex justify-between):
  From Godown:    Main Godown
  Stock Deducted: 200 Pcs text-[#DC2626]
  Value Deducted: ₹38,100.00 text-[#DC2626]
```

**Documents:**
```
Title: "Documents" text-sm font-semibold mt-4

Each doc (flex justify-between py-2 border-b):
  Label: "E-Way Bill" text-sm text-[#64748B]
  Value+Download: "331234567890" text-sm text-[#6366F1] + Download icon

  Label: "LR / AWB"
  Value: "LR123456789" text-[#6366F1] + Download icon

  Label: "Challan PDF"
  Value: "CH-00024.pdf" text-[#6366F1] + Download icon
```

**Notes:**
```
Title: "Notes" text-sm font-semibold mt-4
Content: "No additional notes." text-sm text-[#94A3B8] italic
```

---

### 5.10 Barcode / QR Scanning — `/finished-stock/barcode-qr`

**Page title:** "9. Barcode / QR Scanning" ← numbered from screen
**Breadcrumb:** Finished Stock > Barcode / QR
**Header button:** "Scan History" (outline, Clock icon)

**Layout:** Two-column: left=scan area + results, right=item details + actions

---

#### LEFT — SCAN AREA

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-5

Title: "Scan Barcode / QR" text-sm font-semibold mb-4

Scan Zone:
  Container: border-2 border-dashed border-[#6366F1] rounded-xl p-8
             flex flex-col items-center justify-center gap-4 cursor-pointer
             hover:bg-[#F8FAFC]

  Scan frame icon: QrCode or ScanLine icon size-16 text-[#6366F1]
  "Click to start scanning" text-sm font-medium text-[#374151]
  "or type / paste barcode" text-xs text-[#94A3B8]

  Manual input: flex items-center gap-2 mt-4 w-full
    Input: flex-1 h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm
           placeholder="Enter barcode / QR code"
    Keyboard icon button: border border-[#E5E7EB] w-10 h-10 rounded-lg

TIP BANNER (below scan zone):
  bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-3 mt-4
  Info icon text-[#6366F1] + "Tip: You can also use your camera to scan the barcode / QR code."
  text-xs text-[#374151]
```

---

#### SCAN SUCCESS BANNER (shows after successful scan)

```
bg-[#DCFCE7] border border-[#BBFCC7] rounded-xl p-4 mt-4 flex items-center justify-between

Left: flex items-center gap-3
  CheckCircle2 icon size-6 text-[#15803D]
  "Scan Successful!" text-sm font-semibold text-[#15803D]
  "Item found in system." text-xs text-[#374151]

Right: × dismiss button text-[#94A3B8]
```

---

#### TABS + SCAN HISTORY TABLE

```
Tabs: "Recent Scans" | "Scan History"
Active: text-[#6366F1] border-b-2 border-[#6366F1]

Table (Recent Scans):
Columns: # | Barcode / QR Code | Design | Colour | Size | Godown | Scan Time | Status

Barcode: text-sm font-mono text-[#374151] — "BRCDES001REDM001"
Design: text-sm text-[#374151]
Colour: dot + name
Size: text-sm text-[#374151]
Godown: text-sm text-[#374151]
Scan Time: text-sm text-[#64748B]
Status:
  In Stock:  bg-[#DCFCE7] text-[#15803D]
  Not Found: bg-[#FEE2E2] text-[#DC2626]

"Showing 1 to 5 of 25 scans" + "View All History →" link right
```

---

#### RIGHT — ITEM DETAILS (shows after scan)

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-5

Header: flex items-center justify-between
  "Item Details" text-sm font-semibold
  "In Stock" badge green

Design image: w-full h-40 rounded-xl object-cover mb-4 relative
  × remove: absolute top-2 right-2 w-7 h-7 rounded-full bg-[#EF4444] text-white

"DES-001 - Premium Kurti" text-base font-bold text-[#0F172A]

Key-value rows:
  Colour:          ● Red
  Size:            M
  Godown:          Main Godown
  Available Qty (Pcs): 450 text-[#15803D] font-bold
  Reserved Qty (Pcs):  20
  Free Qty (Pcs):      430 text-[#15803D] font-semibold
  Unit Cost (₹):       190.50
  Stock Value (₹):     85,725.00
```

---

#### RIGHT — ACTIONS (below Item Details)

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-5 mt-4

Title: "Actions" text-sm font-semibold mb-3

Each action (flex items-center gap-3 py-3 border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F8FAFC] rounded-lg px-2):
  Icon in colored square + label text-sm font-medium

  View Stock Details: Eye icon bg-[#EEF2FF] text-[#6366F1]
  Create Adjustment:  SlidersHorizontal bg-[#FEF2F2] text-[#DC2626]
  Create Transfer:    ArrowLeftRight bg-[#F0FDF4] text-[#16A34A]
  Create Challan:     Truck bg-[#FEF9C3] text-[#D97706]
  Print Barcode Label: Printer bg-[#EEF2FF] text-[#6366F1]
```

---

#### RIGHT — QUICK SCAN TIPS (below Actions)

```
Card: bg-white rounded-xl border border-[#E5E7EB] p-4 mt-4

Title: "Quick Scan Tips" text-xs font-semibold text-[#94A3B8] uppercase mb-3

Each tip (flex items-center gap-2 py-1.5):
  CheckCircle2 icon size-4 text-[#15803D]
  text-xs text-[#374151]

Tips:
  "Ensure barcode is clean and not damaged."
  "Keep adequate lighting for better scanning."
  "Hold camera steady and scan properly."
  "If not working, try manual entry."

FOOTER BUTTONS (below all right panels):
  flex gap-3
  Clear: outline h-10 px-4 (clears scan result)
  Export Scan History: outline h-10 px-4 Download icon
```

---

### 5.11 Scan (PWA) — `/scan`

**This is a MOBILE-FIRST page.** Desktop shows it in a narrow centered column (~480px max-width).

**Page title:** "11. Scan (PWA)"
**Sub:** "Scan QR / Barcode"
**Header buttons:** "Flash On" (outline, Zap icon) + "Scan History" (outline, Clock icon)

**Layout:** Two-column on tablet+ (camera left, item info right). Single column stacked on mobile.

---

#### BLUE TIP BANNER (top, full width)

```
bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3 mb-4
Info icon text-[#6366F1] +
"Point your camera at the QR / Barcode on the item or package."
text-sm text-[#374151]
```

---

#### CAMERA VIEW

```
Container: relative rounded-xl overflow-hidden w-full aspect-[4/3]
  bg-black

Camera feed: absolute inset-0 (html5-qrcode camera output)
Dark overlay: absolute inset-0 bg-black/50

Scan Frame (Section 2.7 frame with corner brackets):
  64×64 green corner brackets, border-[#6366F1] 3px

Auto Detect badge (absolute top-3 left-3):
  bg-black/70 rounded-full px-3 py-1.5 flex items-center gap-2
  ● animate-pulse w-2 h-2 rounded-full bg-[#22C55E]
  "Auto Detect ON" text-xs text-white

Camera expand (top-right corner, absolute top-3 right-3):
  Expand icon, bg-black/50 rounded w-9 h-9

SCAN SUCCESS OVERLAY (shows 2s after scan then fades):
  absolute bottom-4 left-1/2 -translate-x-1/2
  bg-[#15803D] rounded-full px-4 py-2 flex items-center gap-2
  CheckCircle2 white + "Scan successful! DES-001 scanned" text-sm text-white

Zoom Controls (below camera, flex justify-center gap-2 mt-2):
  "0.5x" | "1x" | "2x" pills (Section 2.7)
  Active (1x): bg-[#0F172A] text-white rounded-full px-3 py-1 text-sm font-medium
  Inactive: bg-[#F1F5F9] text-[#374151] rounded-full px-3 py-1 text-sm

Gallery capture button (absolute bottom-4 right-4):
  bg-black/50 rounded-xl w-10 h-10 Image icon white
```

---

#### RECENT SCANS LIST (below camera)

```
Title row: flex items-center justify-between mb-3
  "Recent Scans" text-sm font-semibold
  "View All" text-sm text-[#6366F1]

Each scan item (flex items-center gap-3 py-3 border-b border-[#F3F4F6] last:border-0):
  QR thumbnail: w-10 h-10 rounded-lg bg-[#F1F5F9] border border-[#E5E7EB] QrCode icon
  Content:
    "DES-001 - Premium Kurti (Red, M)" text-sm font-medium text-[#0F172A]
    "CH-00024-001" text-xs font-mono text-[#64748B]
  Right: "2 sec ago" text-xs text-[#94A3B8] + ChevronRight text-[#94A3B8]
```

---

#### RIGHT COLUMN — ITEM INFORMATION (after scan)

```
Header: "Item Information" text-sm font-semibold + "In Stock" badge green

Design thumbnail + info:
  Image: w-16 h-20 rounded-lg object-cover float-left mr-3
  "DES-001" text-sm font-mono text-[#374151]
  "Premium Kurti" text-base font-bold text-[#0F172A]
  Colour: dot + "Red" text-sm
  Size: "M" text-sm
  UOM: "Pcs" text-sm

Stock details card (below image):
  bg-[#F8FAFC] rounded-xl p-4 mt-3
  Rows (flex justify-between py-2 border-b border-[#F3F4F6] last:border-0):
    Godown: "Main Godown" font-medium
    Available Qty: "450 Pcs" text-[#15803D] font-bold
    Reserved Qty:  "20 Pcs" text-[#D97706]
    Free Qty:      "430 Pcs" text-[#15803D] font-semibold
    Unit Cost (₹): "190.50"
    Stock Value (₹): "85,725.00"
```

---

#### QUICK ACTIONS SECTION

```
Title: "Quick Actions" text-sm font-semibold mb-3

Tab bar (3 tabs): "Add to Bill" | "Add to Transfer" | "View Stock"
Active: text-[#6366F1] border-b-2 border-[#6366F1]

ADD TO BILL TAB CONTENT:
  Select Customer / Party *
    Label + searchable select: "Client - ABC Textiles" w-full h-10

  Grid grid-cols-2 gap-3 mt-3:
    Quantity (Pcs) *: ± control (compact, smaller)
    Rate (₹): number input, auto-fills from design sale_price

  Amount (₹): computed read-only input, full width, bg-[#F9FAFB]

  "Add to Bill" button: FULL WIDTH h-12 bg-[#6366F1] text-white rounded-xl
    ShoppingCart icon + "Add to Bill"

  "Create New Bill" button: FULL WIDTH h-12 border border-[#6366F1] text-[#6366F1] rounded-xl mt-2
    FileText icon + "Create New Bill"
```

---

#### SCAN TIPS (bottom of page)

```
Title: "Scan Tips" text-xs font-semibold text-[#94A3B8] uppercase mb-2

3 tips with CheckCircle2 icons (same as Barcode/QR scanning page)

Illustration (bottom-right):
  Phone with QR code → arrow → QR code graphic
  Decorative, no interactivity
  Colors: light purple/indigo tones
```

---

#### PWA BOTTOM NAVIGATION (Section 2.8)

```
Fixed bottom bar: 5 items with Scan as center elevated circle button
```

---

## 6. New Database Tables & SQL

```sql
-- Finished stock
CREATE TABLE finished_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size_set_id UUID REFERENCES size_sets(id),
  lot_id UUID REFERENCES production_lots(id),
  godown_id UUID NOT NULL REFERENCES godowns(id),
  entry_type TEXT DEFAULT 'production' CHECK (entry_type IN ('production','manual','adjustment','transfer_in')),
  size_quantities JSONB NOT NULL DEFAULT '{}', -- {S:200,M:300,L:300,XL:200,XXL:200}
  total_quantity INTEGER NOT NULL DEFAULT 0,
  cost_per_piece NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE finished_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON finished_stock
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON finished_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stock adjustments
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  adjustment_number TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('damage','sample','scrap','correction','transfer','other')),
  adjustment_date DATE NOT NULL,
  godown_id UUID NOT NULL REFERENCES godowns(id),
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity_change INTEGER NOT NULL, -- negative=reduce, positive=add
  unit_cost NUMERIC(12,2) NOT NULL,
  value_impact NUMERIC(15,2) NOT NULL,
  
<truncated 14787 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.