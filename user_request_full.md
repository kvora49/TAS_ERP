<USER_REQUEST>
# TAS ERP — Phase 2 Detailed Implementation Plan v2.0
**Settings & User Management | Weeks 3–4 | 10 Working Days**

> ⚠️ AGENT INSTRUCTION: This document contains EXACT pixel-level UI specifications extracted from approved screen designs. Every color, layout, component structure, and behavior is prescribed. Do not make assumptions — if something is specified here, implement it exactly as written.

---

## Table of Contents
1. [Phase 2 Goals](#1-phase-2-goals)
2. [Design System Additions for Phase 2](#2-design-system-additions)
3. [Settings Navigation — Sidebar Extension](#3-settings-navigation)
4. [Page Header Pattern for All Settings Pages](#4-settings-page-header-pattern)
5. [Screen Specifications — Screen by Screen](#5-screen-specifications)
6. [New Database Tables & SQL](#6-new-database-tables)
7. [API Routes](#7-api-routes)
8. [Reusable Settings Components](#8-reusable-settings-components)
9. [Day-by-Day Execution Plan](#9-day-by-day-execution-plan)
10. [Phase 2 Completion Checklist](#10-phase-2-completion-checklist)

---

## 1. Phase 2 Goals

By end of Day 10 (Week 4), deployed and working:
- ✅ All 10 Settings sub-pages with exact approved screen layouts
- ✅ General: 3-column card layout with live preview sidebar
- ✅ Company Profile: logo upload + full form + read-only overview panel
- ✅ Users & Roles: user table + role permissions matrix with checkboxes
- ✅ Financial: bill series table + credit days + payment terms + other preferences
- ✅ Inventory: preferences card + stock valuation + live preview card
- ✅ Production: stage flow + advanced settings + live preview card
- ✅ Notifications: 9-column rules table (icon+name / description / days / roles / email toggle / SMS toggle / in-app toggle / status / action)
- ✅ Backup & Restore: 3-column top cards + full-width history table
- ✅ Audit Logs: filter bar card + full-width log table with module/action colored badges

---

## 2. Design System Additions for Phase 2

These are NEW tokens and patterns that appear for the first time in Settings screens. Add to globals.css.

### 2.1 New Color Tokens
```css
/* Settings-specific tokens */
--settings-card-header-icon-bg: #EEF2FF;  /* purple tint bg for section header icons */
--settings-card-header-icon-color: #6366F1;
--settings-preview-label: #64748B;
--settings-preview-value: #374151;
--settings-divider: #F3F4F6;

/* Toggle states (shadcn Switch) */
--toggle-on: #6366F1;
--toggle-off: #D1D5DB;
--toggle-thumb: #FFFFFF;

/* Checkbox (shadcn Checkbox) */
--checkbox-checked-bg: #6366F1;
--checkbox-checked-border: #6366F1;
--checkbox-unchecked-border: #D1D5DB;
--checkbox-check-color: #FFFFFF;

/* Role badge exact colors */
--role-owner-bg: #0F172A;      --role-owner-text: #FFFFFF;
--role-admin-bg: #6366F1;      --role-admin-text: #FFFFFF;
--role-manager-bg: #DCFCE7;    --role-manager-text: #15803D;
--role-accountant-bg: #FEF3C7; --role-accountant-text: #D97706;
--role-staff-bg: #DBEAFE;      --role-staff-text: #1D4ED8;
--role-intern-bg: #F1F5F9;     --role-intern-text: #64748B;

/* Module badge colors (Audit Log) */
--module-users-bg: #EDE9FE;    --module-users-text: #7C3AED;
--module-inventory-bg: #DCFCE7; --module-inventory-text: #15803D;
--module-payments-bg: #FEE2E2; --module-payments-text: #DC2626;
--module-sales-bg: #FEF3C7;    --module-sales-text: #D97706;
--module-master-bg: #DBEAFE;   --module-master-text: #1D4ED8;
--module-settings-bg: #EDE9FE; --module-settings-text: #7C3AED;
--module-production-bg: #DBEAFE; --module-production-text: #1D4ED8;

/* Action badge colors (Audit Log) */
--action-create-bg: #DCFCE7;   --action-create-text: #15803D;
--action-update-bg: #DBEAFE;   --action-update-text: #1D4ED8;
--action-delete-bg: #FEE2E2;   --action-delete-text: #DC2626;
--action-login-bg: #DCFCE7;    --action-login-text: #15803D;
```

### 2.2 Section Header Pattern (inside cards)
Every settings card has a section header at the top. This is a CONSISTENT pattern across all settings pages:

```
Layout: flex items-center gap-3 mb-6 pb-4 border-b border-[#F3F4F6]

Icon container: w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0
Icon: Lucide icon, size-5, color #6366F1

Text block:
  Title: text-base font-semibold text-[#0F172A]
  Subtitle: text-sm text-[#64748B] mt-0.5
```

### 2.3 Info Banner Pattern (appears at bottom of many settings pages)
```
Layout: flex items-center gap-3 p-4 rounded-lg mt-4

Variant 1 — Blue info (most common):
  bg-[#EFF6FF] border border-[#DBEAFE]
  Icon: Info, size-4, color #6366F1
  Text: text-sm text-[#374151]

Variant 2 — Yellow warning:
  bg-[#FEF9C3] border border-[#FDE68A]
  Icon: AlertTriangle, size-4, color #D97706
  Text: text-sm text-[#92400E]

Variant 3 — Red danger:
  bg-[#FEF2F2] border border-[#FECACA]
  Icon: AlertCircle, size-4, color #DC2626
  Text: text-sm text-[#991B1B]

Variant 4 — Purple about (Notifications bottom):
  bg-[#EDE9FE] border border-[#DDD6FE]
  Title: text-sm font-semibold text-[#6D28D9]
  Text: text-sm text-[#5B21B6]
```

### 2.4 Toggle Row Pattern (System Preferences, Inventory, Production)
```
Layout: flex items-center justify-between py-3.5 border-b border-[#F3F4F6] last:border-0

Left side: flex items-center gap-3
  Icon container: w-8 h-8 rounded-md bg-[#F1F5F9] flex items-center justify-center
  Icon: size-4, color #64748B
  Text block:
    Label: text-sm font-medium text-[#374151]
    Subtitle: text-xs text-[#94A3B8] mt-0.5

Right side:
  shadcn Switch component
  data-[state=checked]:bg-[#6366F1]
  data-[state=unchecked]:bg-[#D1D5DB]
```

### 2.5 Settings Card Container
Every settings section is wrapped in this card:
```
bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[var(--shadow-sm)]
```

### 2.6 Preview Card Right-Panel Pattern (General, Inventory, Production)
```
Card: bg-white rounded-xl border border-[#E5E7EB] p-6

Section header (same as 2.2 above)
Icon: Eye, bg-[#EEF2FF], color #6366F1
Title: "Preview"
Subtitle: "Current Settings Summary" / "Current Inventory Settings" / etc.

Content: key-value rows
Each row: flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0
  Left: flex items-center gap-3
    Icon: size-4 color #94A3B8 (relevant icon per field)
    Label: text-sm text-[#64748B]
  Right:
    Value: text-sm font-medium text-[#374151]
    OR for boolean values: badge "Enabled"=green / "Disabled"=red

"Enabled" badge: bg-[#DCFCE7] text-[#15803D] text-xs font-medium px-2 py-0.5 rounded
"Disabled" badge: bg-[#FEE2E2] text-[#DC2626] text-xs font-medium px-2 py-0.5 rounded
```

---

## 3. Settings Navigation — Sidebar Extension

**CRITICAL:** Settings navigation lives INSIDE the existing main left sidebar. There is NO separate categories panel in the content area. The main sidebar's Settings item expands to show all sub-items as an indented sub-menu.

### 3.1 How Settings Sub-items Appear in Sidebar

```
Settings item (parent):
  flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2
  bg-[#312E81] text-white (when any settings page is active)
  Gear icon size-[18px] + "Settings" text + ChevronUp (when expanded)

Sub-items (when Settings is expanded):
  Each: flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-lg mx-2 text-sm font-medium
  
  Inactive sub-item:
    text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white
    Has a small dot bullet: w-1.5 h-1.5 rounded-full bg-[#94A3B8]

  Active sub-item:
    bg-[#312E81] text-white
    Dot becomes: w-1.5 h-1.5 rounded-full bg-white
```

**Sub-items list (in order, matching approved screens):**
```
• General
• Company Profile
• Users & Roles
• Financial
• Inventory
• Production
• Notifications
• Backup & Restore
• Audit Logs
• Integrations
```

---

## 4. Settings Page Header Pattern

All settings pages share the SAME header structure. No search bar. No separate categories panel.

```
Header zone (mb-6):
  Row 1 — Breadcrumb:
    "Settings > [Current Section]"
    "Settings": text-sm text-[#6366F1] cursor-pointer hover:underline
    ">": text-sm text-[#94A3B8] mx-1.5
    "[Section]": text-sm text-[#64748B]

  Row 2 — Title row: flex items-center justify-between
    Left: page title text-[28px] font-bold text-[#0F172A]
    Right: "Save Changes" primary button
           Icon: Save (FloppyDisk) or Cloud icon, size-4
           bg-[#6366F1] hover:bg-[#4F46E5] text-white h-10 px-4 rounded-lg

  Row 3 — Subtitle (optional):
    text-sm text-[#64748B] mt-1

EXCEPTION — Backup & Restore page:
  Right button is "Create Backup Now" with CloudUpload icon

EXCEPTION — Audit Logs page:
  Right button is "Export Logs" with Download icon, uses outline style:
  border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F8FAFC] h-10 px-4 rounded-lg

EXCEPTION — Users & Roles page:
  Right button is "+ Add User" with UserPlus icon
```

---

## 5. Screen Specifications — Screen by Screen

---

### 5.1 General — `/settings/general`

**Page title:** "Settings" | **Breadcrumb:** Settings > General | **Button:** "Save Changes" (Save icon)

**Content layout: `grid grid-cols-3 gap-6`**

---

#### LEFT CARD — "General Settings"

```
Section header: Settings2 icon + "General Settings" + "Manage general system configuration"

Form fields (stacked, gap-5):

Field 1 — Business Name
  Label: "Business Name" text-sm font-medium text-[#374151] mb-1.5
  Input: full-width h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm
  Helper text below: "Your business name as it appears in documents"
                     text-xs text-[#94A3B8] mt-1.5

Field 2 — Currency
  Label: "Currency"
  Select dropdown: w-full h-10 rounded-lg border border-[#D1D5DB]
  Default: "INR (₹) - Indian Rupee"
  Helper: "Default currency for transactions"

Field 3 — Date Format
  Label: "Date Format"
  Select: options include "DD MMM YYYY (31 May 2024)" (default)
  Helper: "Choose the default date format"

Field 4 — Time Zone
  Label: "Time Zone"
  Select: default "(GMT+05:30) Asia/Kolkata"
  Helper: "System time zone"

Field 5 — Language
  Label: "Language"
  Select: default "English"
  Helper: "Choose the default language"

Field 6 — Items Per Page
  Label: "Items Per Page"
  Select: "10 items" (default), options 10/25/50/100
  Helper: "Number of items to show in tables"
```

---

#### CENTER CARD — "System Preferences"

```
Section header: SlidersHorizontal icon + "System Preferences" + "Set system-wide preferences"

Toggle rows (NO borders between them, just vertical stacking with py-3.5 each):
Each row structure (from Section 2.4):

Row 1 — Enable GST
  Icon: Receipt, bg-[#F1F5F9]
  Label: "Enable GST"
  Subtitle: "Enable GST features and calculations"
  Default: ON

Row 2 — Enable Batch Tracking
  Icon: Boxes, bg-[#F1F5F9]
  Label: "Enable Batch Tracking"
  Subtitle: "Track inventory by batches"
  Default: ON

Row 3 — Enable Serial Numbers
  Icon: Hash, bg-[#F1F5F9]
  Label: "Enable Serial Numbers"
  Subtitle: "Track items by serial numbers"
  Default: OFF

Row 4 — Low Stock Alerts
  Icon: BellRing, bg-[#F1F5F9]
  Label: "Low Stock Alerts"
  Subtitle: "Show alerts for low stock items"
  Default: ON

Row 5 — Allow Negative Stock
  Icon: TrendingDown, bg-[#F1F5F9]
  Label: "Allow Negative Stock"
  Subtitle: "Allow issuing stock even if insufficient"
  Default: OFF
```

---

#### RIGHT CARD — "Preview"

```
Section header: Eye icon + "Preview" + "Current Settings Summary"

Key-value rows (from Section 2.6):
  Business Name  |  [value from form]
  Currency       |  [value]
  Date Format    |  [value — show short form: "DD MMM YYYY"]
  Time Zone      |  [value]
  Language       |  [value]
  Items Per Page |  [value]

"Active Preferences (N)" section (N = count of ON toggles):
  Title: text-sm font-semibold text-[#15803D] mb-3
  List: each active preference as a row:
    flex items-center gap-2 py-1.5
    CheckCircle2 icon: size-4 text-[#15803D]
    Text: text-sm text-[#374151]

This section LIVE UPDATES as user toggles switches on the center card.
```

---

#### BOTTOM — Full-width info banner
```
Info banner (Variant 1 — blue) spanning all 3 columns:
"These settings will be applied across the entire system."
```

---

### 5.2 Company Profile — `/settings/company-profile`

**Page title:** "Settings - Company Profile" | **Breadcrumb:** Settings > Company Profile | **Button:** "Save Changes"

**Content layout: `grid grid-cols-3 gap-6`**
- Left+Center (spans 2 cols): Company Information form card
- Right (spans 1 col): Company Overview read-only card

---

#### MAIN CARD (spans col 1+2) — "Company Information"

```
Section header: Building2 icon + "Company Information"

LOGO UPLOAD ROW (flex items-start gap-6 mb-6):
  Left — Current logo preview:
    w-32 h-32 rounded-xl border-2 border-[#E5E7EB] overflow-hidden
    bg-[#F8FAFC] flex items-center justify-center
    Shows logo image if exists, else building icon placeholder
    Recommended size note: text-xs text-[#94A3B8] mt-2 "Recommended size: 300x300px"

  Right — Upload zone:
    w-40 h-32 border-2 border-dashed border-[#D1D5DB] rounded-xl
    flex flex-col items-center justify-center gap-2 cursor-pointer
    hover:border-[#6366F1] hover:bg-[#F8FAFC] transition-colors
    
    CloudUpload icon: size-8 text-[#94A3B8]
    "Upload Logo" text-sm font-medium text-[#374151] mt-1
    "PNG, JPG or SVG" text-xs text-[#94A3B8]
    "Max size 2MB" text-xs text-[#94A3B8]
    "Choose File" outline button: border border-[#E5E7EB] text-sm px-3 py-1.5 rounded-lg mt-2

FORM FIELDS (grid grid-cols-2 gap-4):
  Company Name *   | GSTIN *
  Full Address *   | PAN *
  (textarea, spans 1 col, h-28)
  Phone *          | Email *
  Website          | Default Currency *
  Fiscal Year *    | (empty)

Field label style: text-sm font-medium text-[#374151] mb-1.5
Required marker (*): text-[#DC2626]
Input style: w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm
             focus:ring-2 focus:ring-[#6366F1] focus:border-transparent
Textarea style: same border but h-28 resize-none py-2.5

Fiscal Year: select dropdown with options:
  "1 April – 31 March" (default Indian FY)
  "1 January – 31 December"
  "1 July – 30 June"
```

---

#### RIGHT CARD — "Company Overview"

```
Section header: ClipboardList icon + "Company Overview"

Key-value list (same pattern as Preview card in General):
  Company Name    | [value]
  GSTIN           | [value]
  PAN             | [value]
  Phone           | [value]
  Email           | [value] — renders as link: text-[#6366F1]
  Website         | [value] — renders as link: text-[#6366F1]
  Address         | [value — multiline]
  Fiscal Year     | [value]
  Default Currency| [value]

"Note" section at bottom of card:
  bg-[#EFF6FF] rounded-lg p-3 mt-4
  flex items-start gap-2
  Info icon size-4 text-[#6366F1] mt-0.5
  "Note" text-xs font-semibold text-[#1D4ED8] mb-1
  "Company profile details will be used in invoices, reports and other documents."
  text-xs text-[#64748B]

This card LIVE UPDATES as user types in the form on the left.
```

---

### 5.3 Users & Roles — `/settings/users-roles`

**Page title:** "Settings > Users & Roles" | **Breadcrumb:** Settings > Users & Roles | **Button:** "+ Add User" (UserPlus icon)
**Subtitle:** "Manage users, roles and permissions"

**Content layout: stacked full-width cards (NO grid — all full width)**

---

#### CARD 1 — Users Table

```
Section header: UserCircle icon + "Users" + "View and manage system users"

SEARCH + FILTER ROW (below header, mb-4):
  Left: Search input (full width, flex-1)
    Placeholder: "Search by name, email or role..."
    Search icon prefix inside input (same pattern as Phase 1)
  Right: "All Roles" dropdown (w-[180px])
    Options: All Roles / Owner / Admin / Manager / Accountant / Staff / Intern
  Gap between: gap-3

TABLE:
Columns: Name | Email | Role | Status | Last Login | Action

Name column:
  flex items-center gap-3
  Avatar circle: w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white
  Avatar BG colors (based on name initials — rotate through):
    SA → bg-[#6366F1]  (Super Admin in screen)
    AS → bg-[#0EA5E9]
    SS → bg-[#10B981]
    RK → bg-[#F59E0B]
    NH → bg-[#EF4444]
    AD → bg-[#8B5CF6]
    (use a hash of the name to pick consistently)
  Name: text-sm font-medium text-[#0F172A]

Email column: text-sm text-[#64748B]

Role column (use RoleBadge component):
  Exact badge classes per role:
  Super Admin:     bg-[#EDE9FE] text-[#6D28D9]   (purple)
  Admin:           bg-[#EDE9FE] text-[#6D28D9]   (purple lighter — same as admin)
  Manager:         bg-[#DBEAFE] text-[#1D4ED8]   (blue)
  Accountant:      bg-[#FEF3C7] text-[#D97706]   (yellow)
  Store Incharge:  bg-[#D1FAE5] text-[#065F46]   (green dark)
  Production User: bg-[#E0F2FE] text-[#0369A1]   (light blue)
  Inactive:        bg-[#F1F5F9] text-[#64748B]   (gray)
  Badge style: text-xs font-medium px-2.5 py-1 rounded-md

Status column: StatusBadge — Active=green / Inactive=red

Last Login column: text-sm text-[#64748B]
  Format: "23 May 2024, 10:30 AM"
  If null: "Never" text-[#94A3B8]

Action column: ⋮ three-dot menu button
  w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center
  MoreVertical icon size-4 text-[#64748B]
  Opens dropdown: Edit | Change Role | Deactivate (red) / Activate (green)

FOOTER: "Showing 1 to 6 of 12 entries" + pagination (1 / 2 / >)
```

---

#### CARD 2 — Role Permissions Matrix

```
Section header: Settings2 icon + "Role Permissions Matrix" + "Define permissions for the selected role"

TOP-RIGHT of card (not in section header, float right):
  flex items-center gap-3
  "Select Role" text-sm text-[#64748B]
  Role dropdown (w-[180px]): shows all roles, default "Manager"
  
  When role changes → table checkboxes update to show that role's permissions

PERMISSIONS TABLE:
  Columns: Module | View | Add | Edit | Delete | Approve | Export

  Module column: text-sm font-medium text-[#374151], width ~200px
  Permission columns: each centered, width ~100px

  Column headers: text-xs font-medium text-[#64748B] uppercase tracking-wide
  Header row: bg-[#F9FAFB] h-11

  Module rows:
    Dashboard
    Master Data
    Raw Materials
    Production
    Sales & Billing
    Reports
    Expenses

  Each cell: flex items-center justify-center
  shadcn Checkbox component:
    Checked: bg-[#6366F1] border-[#6366F1] check mark white
    Unchecked: bg-white border-[#D1D5DB]
    Size: w-5 h-5 rounded

  Row hover: hover:bg-[#F8FAFC]

INFO BANNER (blue, inside card at bottom):
  "Permissions define what actions a role can perform across modules.
   Changes will apply to all users under this role."
```

---

#### ADD USER MODAL

```
Trigger: "+ Add User" button in page header

Modal: max-w-lg w-full bg-white rounded-2xl shadow-xl p-6

Header:
  UserPlus icon in w-12 h-12 rounded-full bg-[#EEF2FF] color #6366F1
  "Add New User" text-xl font-bold text-[#0F172A] mt-4
  "Invite a team member to join TAS ERP" text-sm text-[#64748B]

Form fields (gap-4):
  Full Name *        [text]
  Email Address *    [email]
  Phone Number       [text, optional]
  Role *             [select — shows role badge preview next to dropdown]
  Temporary Password [password with Eye toggle]
  Send Welcome Email [toggle switch — sends invite email]

Footer (border-t pt-4 flex justify-end gap-3):
  Cancel: outline button
  Add User: primary button
```

---

### 5.4 Financial — `/settings/financial`

**Page title:** "Settings > Financial" | **Breadcrumb:** Settings > Financial | **Button:** "Save Changes"
**Subtitle:** "Configure financial preferences and defaults"

**Content layout: stacked cards**

---

#### CARD 1 — Bill Series Configuration (full width)

```
Section header: FileText icon + "Bill Series Configuration"
                + "Configure bill numbering series for each brand"

TOP-RIGHT of card: "+ Add Series" button
  outline style: border border-[#E5E7EB] bg-white h-9 px-3 rounded-lg text-sm
  Plus icon size-4 + "Add Series" text

TABLE (standard table, no DataTable pagination needed — all rows visible):
Columns: Brand | Series Type | Prefix (Pakka) | Prefix (Kacha) | Separator | Digits | Reset Frequency | Next Number | Action

Column header: text-xs font-medium text-[#64748B] uppercase bg-[#F9FAFB] h-10 px-4
Body row: h-14 px-4 border-b border-[#E5E7EB] hover:bg-[#F8FAFC]

Brand column: text-sm font-medium text-[#374151]
Series Type column: text-sm text-[#374151] (Invoice / Challan / Debit Note)
Prefix (Pakka): text-sm font-mono text-[#374151] (e.g. "PK")
Prefix (Kacha): text-sm font-mono text-[#374151] (e.g. "KC")
Separator: text-sm text-[#374151] (e.g. "/")
Digits: text-sm text-center text-[#374151] (e.g. "5")
Reset Frequency: text-sm text-[#374151] ("Every Financial Year")
Next Number: text-sm font-mono text-[#374151] ("PK/24-25/00056")

Action column: flex items-center gap-2
  Edit: Pencil icon button (w-8 h-8 border border-[#E5E7EB] rounded-lg)
  Delete: Trash2 icon button (w-8 h-8 border border-[#FEE2E2] rounded-lg text-[#EF4444])

INFO NOTE below table (not a banner, just text):
  flex items-center gap-2 px-4 py-3
  Info icon size-4 text-[#94A3B8]
  "Next number indicates the next document number that will be generated."
  text-xs text-[#64748B]
```

---

#### ROW 2 — Two side-by-side cards (`grid grid-cols-2 gap-6`)

**LEFT — Default Credit Days:**
```
Section header: Calendar icon + "Default Credit Days"
                + "Set default credit period for customers"

Field: "Default Credit Days *"
  Number input with suffix: flex
  Input: flex-1 h-10 px-3 rounded-l-lg border border-r-0 border-[#D1D5DB] text-sm
  Suffix badge: h-10 px-4 bg-[#F9FAFB] border border-[#D1D5DB] rounded-r-lg
               text-sm text-[#64748B] flex items-center "days"

Info banner (Variant 1 — blue, inside card):
  "This credit period will be used in sales invoices if customer specific credit days is not set."
```

**RIGHT — Default Payment Terms:**
```
Section header: Receipt icon + "Default Payment Terms"
                + "Set default payment terms for purchases"

Field: "Default Payment Terms *"
  Select: "30 Days" (dropdown)
  Options: Immediate / 15 Days / 30 Days / 45 Days / 60 Days / 90 Days

Info banner (blue, inside card):
  "This payment term will be used in purchase invoices if vendor specific terms is not set."
```

---

#### CARD 3 — Other Financial Preferences (full width)

```
Section header: Settings2 icon + "Other Financial Preferences"
                + "Configure additional financial preferences"

Grid 3-column layout (grid grid-cols-3 gap-6):

Col 1: Default TDS Type
  Label: "Default TDS Type"
  Select: "194C - Contractor" (default)
  Options: 194C Contractor / 194H Commission / 194I Rent / 194J Professional / None

Col 2: Round Off Option
  Label: "Round Off Option"
  Select: "Round to 2 Decimal Places"
  Options: Round to 2 Decimal Places / Round to Nearest Rupee / No Round Off

Col 3: Enable Cash Rounding
  Label: "Enable Cash Rounding" text-sm font-medium text-[#374151]
  Subtitle: "Round off cash transactions to nearest rupee" text-xs text-[#94A3B8]
  Toggle switch (right-aligned): ON by default
  Layout: flex items-center justify-between (label+subtitle on left, toggle on right)
```

---

### 5.5 Inventory — `/settings/inventory`

**Page title:** "Settings > Inventory" | **Breadcrumb:** Settings > Inventory | **Button:** "Save Changes"
**Subtitle:** "Manage inventory related preferences"

**Content layout: `grid grid-cols-3 gap-6`**
- Left+Center (cols 1+2): Two stacked cards
- Right (col 3): Preview card

---

#### LEFT+CENTER AREA (col-span-2):

**CARD 1 — Inventory Preferences:**
```
Section header: Package icon + "Inventory Preferences"
                + "Configure inventory behavior and defaults"

Fields (stacked, gap-5):

Default Godown *
  Label + Select dropdown populated from godowns table
  Helper: "Select the default godown for all inventory transactions"

Low Stock Alert Threshold *
  Label + input with suffix "items":
  [number input flex-1] [items suffix badge]
  Helper: "Minimum quantity to trigger low stock alert"

Toggle rows (gap-0, border-b between):
  Allow Negative Stock    | "Allow issuing stock even if insufficient"  | OFF
  Enable Batch Tracking   | "Track inventory by batches"                | ON
  Enable Serial Numbers   | "Track items by serial numbers"             | OFF
```

**CARD 2 — Stock Valuation Method (below Card 1):**
```
Section header: Bell icon + "Stock Valuation Method"
                + "Select the method for valuing stock"

Valuation Method:
  Label: "Valuation Method"
  Select: "FIFO (First In First Out)" (default)
  Options: FIFO (First In First Out) / LIFO (Last In First Out) / Average Cost / Manual

Helper: "This method will be used for stock valuation and cost calculation"

Info banner (blue, full width):
  "Inventory settings will be applied across the entire system."
```

---

#### RIGHT CARD — Preview

```
Section header: Eye icon + "Preview" + "Current Inventory Settings"

Key-value rows with special value rendering:
  Default Godown            | [godown name]
  Low Stock Alert Threshold | [number] items
  Allow Negative Stock      | "Disabled" badge (red) / "Enabled" badge (green)
  Enable Batch Tracking     | "Enabled" badge (green) / "Disabled" badge (red)
  Enable Serial Numbers     | "Disabled" badge (red) / "Enabled" badge (green)

"About Inventory Settings" section at bottom:
  bg-[#EFF6FF] rounded-lg p-3 mt-4
  Info icon + "About Inventory Settings" text-xs font-semibold text-[#1D4ED8]
  "These preferences control how inventory is managed in the system. Changes will affect new transactions going forward."
  text-xs text-[#64748B]
```

---

### 5.6 Production — `/settings/production`

**Page title:** "Settings > Production" | **Breadcrumb:** Settings > Production | **Button:** "Save Changes"
**Subtitle:** "Manage production related preferences"

**Content layout: `grid grid-cols-3 gap-6`**
- Left+Center (col-span-2): Two stacked cards
- Right (col 3): Preview card

---

#### LEFT+CENTER AREA:

**CARD 1 — Production Preferences:**
```
Section header: Factory icon + "Production Preferences"
                + "Configure production process and defaults"

SECTION A — Default Production Stage Flow:
  Label: "Default Production Stage Flow" text-sm font-medium text-[#374151] mb-1.5
  Helper: "Define and manage the default stage sequence for production"
          text-xs text-[#94A3B8] mb-3

  Stage pills display (horizontal scrollable flex):
    Each stage: flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB]
                bg-white text-sm text-[#374151]
                Stage icon (colored) + Stage Name
    Between stages: ChevronRight icon size-4 text-[#94A3B8]
    Last stage has a ChevronDown (expand/reorder button)

    Example from screen: [✂ Cutting] → [🧵 Stitching] → [⚡ Finishing] → [✓ Quality Check] → [📦 Packing] ⌄

SECTION B — Job Work Bill Type (Default) *:
  Label + Select: "Job Work In" (default)
  Options: Job Work In / Job Work Out / Ask Each Time

SECTION C — Auto-complete Lot:
  Toggle row: "Auto-complete Lot" label +
  "Automatically complete lot when all operations are finished" subtitle
  Toggle: ON by default
```

**CARD 2 — Production Advanced Settings:**
```
Section header: SlidersHorizontal icon + "Production Advanced Settings"
                + "Additional production configurations"

Toggle rows:
  Allow Back Date Production | "Allow creating production entries with back dates" | OFF
  Lock Completed Lots        | "Prevent editing of completed lots"                 | ON

Default Work Center:
  Label: "Default Work Center"
  Select: "Main Production Unit" (default, populated from workers/godowns)

Info banner (blue, full width):
  "These production settings will be applied across all production modules."
```

---

#### RIGHT CARD — Preview

```
Section header: Eye icon + "Preview" + "Current Production Settings"

Key-value rows:
  Default Stage Flow | "Cutting → Stitching → Finishing → Quality Check → Packing"
                      (truncated with → arrows, text-xs)
  Job Work Bill Type | "Job Work In"
  Auto-complete Lot  | "Enabled" badge (green)
```

---

### 5.7 Notifications — `/settings/notifications`

**Page title:** "Settings > Notifications" | **Breadcrumb:** Settings > Notifications | **Button:** "Save Changes"
**Subtitle:** "Configure and manage notification preferences"

**Content layout: stacked cards (full width)**

---

#### CARD 1 — Notification Rules

```
Section header: Bell icon + "Notification Rules"
                + "Manage notification rules, timing and recipients"

TABLE — 9 columns:
  Notification | Description | Days Before | Target Roles | Email | SMS | In-App | Status | Action

Column widths (approximate flex proportions):
  Notification: ~200px | Description: ~200px | Days Before: ~120px | Target Roles: ~200px
  Email: ~80px | SMS: ~80px | In-App: ~80px | Status: ~80px | Action: ~60px

Column headers: text-xs font-medium text-[#64748B] uppercase bg-[#F9FAFB] h-11 px-4

NOTIFICATION column:
  flex items-center gap-3
  Icon container: w-9 h-9 rounded-lg flex items-center justify-center
  Icon + icon bg colors (from approved screen):
    Payment Due:     Calendar,    bg-[#EEF2FF] icon #6366F1
    Overdue:         Clock,       bg-[#FEF3C7] icon #D97706
    PDC Cheque Due:  CalendarClock, bg-[#FEF3C7] icon #D97706
    Low Stock:       Package,     bg-[#DBEAFE] icon #1D4ED8
    Cheque Bounce:   ShieldAlert,  bg-[#FEE2E2] icon #DC2626
  Rule name: text-sm font-medium text-[#0F172A]

DESCRIPTION column: text-sm text-[#64748B]

DAYS BEFORE column:
  flex items-center gap-2
  Number input: w-14 h-8 text-center border border-[#E5E7EB] rounded-lg text-sm
                bg-white focus:ring-2 focus:ring-[#6366F1]
                Disabled (opacity-50) when row toggle is OFF
  "days" text: text-sm text-[#64748B]
  If no days concept (e.g. cheque bounce): show "0" with "days"

TARGET ROLES column:
  flex items-center gap-1.5 flex-wrap
  Role chips: text-xs font-medium px-2 py-0.5 rounded
    Admin chip:      bg-[#EDE9FE] text-[#6D28D9]
    Accountant chip: bg-[#FEF3C7] text-[#D97706]
    +1 chip (overflow): bg-[#F1F5F9] text-[#64748B] — shows "+1" for hidden roles

EMAIL column: Toggle switch (small, h-5 w-9)
SMS column: Toggle switch
IN-APP column: Toggle switch

STATUS column: "Active" badge = bg-[#DCFCE7] text-[#15803D]

ACTION column:
  ⋮ MoreVertical icon, w-8 h-8 border border-[#E5E7EB] rounded-lg

INFO BANNER (blue, full width, below table):
  "Days Before: Number of days before the event to send notification. (0 = on the day of event)"
```

---

#### CARD 2 — Notification Preferences

```
Section header: Settings2 icon + "Notification Preferences"
                + "General notification preferences"

Top row (grid grid-cols-3 gap-4):
  Default Time:
    Label: "Default Time"
    Time input: "09:00 AM" with Clock icon suffix (absolute right-3)
    Helper: "Default time to send notifications"

  Email Sender Name:
    Label: "Email Sender Name"
    Text input: "ABC Garments Pvt. Ltd."
    Helper: "Name used in email notifications"

  Email Reply To:
    Label: "Email Reply To"
    Email input: "noreply@abcgarments.com"
    Helper: "Reply-to email address"

Toggle rows (below the 3-col grid, flex row):
  Enable Weekend Notifications | "Allow notifications to be sent on weekends" | ON
  Enable Holiday Notifications | "Allow notifications to be sent on company holidays" | OFF
  
  Layout for toggle row pair:
    flex items-center gap-8 mt-4
    Each: flex items-center justify-between gap-4
      Left: label text-sm font-medium + subtitle text-xs text-[#94A3B8]
      Right: Toggle switch
```

---

#### BOTTOM — About Notifications Banner (Variant 4 — purple)

```
bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-4
flex items-start gap-3
Info icon size-4 text-[#7C3AED]
"About Notifications" text-sm font-semibold text-[#6D28D9] mb-1
"Notifications will be sent based on the rules above. Users will receive only those notifications for which they have the selected target roles."
text-sm text-[#5B21B6]
```

---

### 5.8 Backup & Restore — `/settings/backup-restore`

**Page title:** "Settings > Backup & Restore" | **Breadcrumb:** Settings > Backup & Restore
**Button:** "Create Backup Now" (CloudUpload icon, primary button)
**Subtitle:** "Manage system backups and restore data"

**Content layout: Top 3-column grid + bottom full-width card**

---

#### TOP ROW — `grid grid-cols-3 gap-6`

**LEFT CARD — "Backup to Cloud (R2)":**
```
Section header: CloudUpload icon + "Backup to Cloud (R2)"
                + "Create a manual backup of your data to Cloudflare R2 storage."

Two-column info row (flex justify-between mb-4):
  Left:  "Last Backup"       label text-xs text-[#94A3B8]
         "31 May 2024, 11:45 PM" text-sm font-medium text-[#374151]
  Right: "Next Scheduled Backup" label text-xs text-[#94A3B8]
         "01 Jun 2024, 11:45 PM" text-sm font-medium text-[#374151]

"Create Backup Now" button:
  FULL WIDTH of card, h-11
  bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg
  CloudUpload icon + "Create Backup Now"
  Loading state: spinner + "Creating backup..."

Info banner (blue, inside card below button):
  Info icon + "Daily automated backups are created at 11:45 PM."
```

**CENTER CARD — "Last Backup Details":**
```
Section header: Database icon + "Last Backup Details"

Key-value rows (NO borders, stacked with py-2 each):
  Backup Name    | "backup_2024_05_31_234500.sql"
                   text-xs font-mono text-[#374151]
  Backup Size    | "1.42 GB"
  Storage Location | "Cloudflare R2"
  Uploaded On    | "31 May 2024, 11:45 PM"
  Uploaded By    | "Super Admin"

Label style: text-sm text-[#64748B], w-36 flex-shrink-0
Value style: text-sm text-[#374151]

"Download Last Backup" button (below key-values):
  FULL WIDTH, h-10, outline style
  border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC]
  Download icon + "Download Last Backup"
```

**RIGHT CARD — "Restore From File":**
```
Section header: History icon + "Restore From File"
                + "Upload a backup file (.sql) to restore your data."

UPLOAD DROPZONE:
  border-2 border-dashed border-[#D1D5DB] rounded-xl p-6
  flex flex-col items-center justify-center gap-3 cursor-pointer
  hover:border-[#6366F1] hover:bg-[#F8FAFC] transition-colors

  CloudUpload icon: size-10 text-[#94A3B8]
  "Drag and drop your backup file here" text-sm text-[#64748B]
  "or" text-xs text-[#94A3B8]
  "Choose File" button: outline, h-9 px-4 rounded-lg text-sm

Below dropzone — two warning banners:

Caution banner (blue):
  Info icon + "Please ensure you have a recent backup before restoring."
  text-xs

Danger banner (red):
  AlertTriangle icon text-[#DC2626] +
  "Restoring will overwrite current data." text-sm font-semibold text-[#991B1B]
  "This action cannot be undone." text-xs text-[#DC2626]

"Restore Now" button:
  FULL WIDTH, h-10
  DISABLED state (grayed) until file is selected:
    bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E5E7EB]
  ENABLED state (after file selected):
    bg-[#DC2626] hover:bg-[#B91C1C] text-white
  Always shows ConfirmDialog before executing
```

---

#### BOTTOM CARD — "Backup History" (full width)

```
Section header: History icon + "Backup History" + "View and manage all system backups."

TABLE:
Columns: Backup Name | Date & Time | Size | Uploaded By | Location | Status | Action

Backup Name: text-sm font-mono text-[#374151]
Date & Time: text-sm text-[#374151]
Size: text-sm text-[#374151]
Uploaded By: text-sm text-[#374151]
Location: text-sm text-[#374151]
Status badge:
  Success: bg-[#DCFCE7] text-[#15803D] "Success"
  Failed:  bg-[#FEE2E2] text-[#DC2626] "Failed"
  In Progress: bg-[#FEF3C7] text-[#D97706] "In Progress"

Action column: flex items-center gap-2
  Download: Download icon, w-8 h-8 border border-[#E5E7EB] rounded-lg
  More: ⋮ MoreVertical, same style

FOOTER: "Showing 1 to 5 of 15 entries" + pagination 1/2/3/...

INFO BANNER (blue, below table):
  "Backups are retained for 30 days. After that, they are automatically deleted."
```

---

### 5.9 Audit Logs — `/settings/audit-logs`

**Page title:** "Settings > Audit Logs" | **Breadcrumb:** Settings > Audit Logs
**Button:** "Export Logs" — OUTLINE button: border border-[#E5E7EB] bg-white h-10 px-4 rounded-lg
            Download icon + "Export Logs" text-[#374151]
**Subtitle:** "Track system changes and user activities"

**Content layout: Filter card + Log table card (stacked full width)**

---

#### FILTER CARD — "Filter Audit Logs"

```
Section header: Filter icon (Lucide `SlidersHorizontal`) + "Filter Audit Logs"
No subtitle.

Filters row (flex items-end gap-4 flex-wrap):

Filter 1 — Date Range:
  Label: "Date Range" text-sm font-medium text-[#374151] mb-1.5
  Date range picker: flex items-center gap-2
    From date input: h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm w-[160px]
    "-" separator text-[#94A3B8]
    To date input: same style
    Calendar icon inside inputs (absolute right-3)

Filter 2 — Module:
  Label: "Module"
  Select: "All Modules" default
  Options: All Modules / Brands / Godowns / Designs / Sale Bills / Purchases / Payments / Users / Settings

Filter 3 — User:
  Label: "User"
  Select: "All Users" default
  Options: populated from users table

Filter 4 — Action:
  Label: "Action"
  Select: "All Actions" default
  Options: All Actions / Create / Update / Delete / Login / Logout / Export

Buttons (flex items-center gap-3, ml-auto, align-end):
  Reset: outline h-10 px-4 rounded-lg text-sm text-[#374151]
  Apply Filters: primary h-10 px-4 rounded-lg text-sm bg-[#6366F1] text-white
```

---

#### AUDIT LOG TABLE CARD

```
Card header (flex items-center justify-between mb-4):
  Section header: SlidersHorizontal icon + "Audit Logs" + "View all system activities and changes"
  Right: "Show" text-sm text-[#64748B] +
         Select (w-20): "10" / "25" / "50" entries per page

TABLE COLUMNS: Date & Time | User | Module | Action | Description | IP Address | ⋮

DATE & TIME column:
  text-sm text-[#374151]
  Date on line 1: "31 May 2024,"
  Time on line 2: "11:45 PM"
  (two lines, no explicit br — text wraps in narrow column)

USER column:
  flex items-center gap-2
  Avatar circle: w-7 h-7 rounded-full bg-[#6366F1] text-white text-xs font-bold
                 (same initial-based color system as Users table)
  Name: text-sm text-[#374151]

MODULE column — colored badges:
  Users:        bg-[#EDE9FE] text-[#7C3AED]
  Inventory:    bg-[#DCFCE7] text-[#15803D]
  Payments:     bg-[#FEE2E2] text-[#DC2626]
  Sales & Billing: bg-[#FEF3C7] text-[#D97706]
  Master Data:  bg-[#DBEAFE] text-[#1D4ED8]
  Settings:     bg-[#EDE9FE] text-[#7C3AED]
  Production:   bg-[#DBEAFE] text-[#1D4ED8]
  Badge: text-xs font-medium px-2.5 py-1 rounded-md
         flex items-center gap-1.5 (icon + label)
  Each module badge has a small icon inside (size-3) matching the sidebar icon

ACTION column — colored badges:
  Create: bg-[#DCFCE7] text-[#15803D] "Create"
  Update: bg-[#DBEAFE] text-[#1D4ED8] "Update"
  Delete: bg-[#FEE2E2] text-[#DC2626] "Delete"
  Login:  bg-[#DCFCE7] text-[#15803D] "Login"
  Logout: bg-[#F1F5F9] text-[#64748B] "Logout"
  Export: bg-[#FEF3C7] text-[#D97706] "Export"
  Badge: text-xs font-medium px-2.5 py-1 rounded-md

DESCRIPTION column:
  text-sm text-[#374151]
  Full description string e.g. "Created new user 'John Doe' (john.doe@abc.com)"
  Truncate with ellipsis if > 60 chars, full on hover tooltip

IP ADDRESS column:
  text-sm text-[#64748B] font-mono
  e.g. "192.168.1.10"

ACTION column (⋮):
  MoreVertical icon, w-8 h-8 border border-[#E5E7EB] rounded-lg
  Dropdown: "View Details" / "Copy Entry"

FOOTER: "Showing 1 to 10 of 124 entries" + full pagination: < 1 2 3 4 5 ... 13 >

INFO BANNER (blue, below table):
  "Audit logs are retained for 180 days. You can export logs for further analysis."
```

---

## 6. New Database Tables

Run in Supabase SQL Editor at start of Phase 2:

```sql
-- business_settings
CREATE TABLE business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  default_credit_days INTEGER DEFAULT 0,
  default_payment_terms TEXT DEFAULT '30_days',
  late_payment_interest BOOLEAN DEFAULT false,
  late_payment_rate NUMERIC(5,2) DEFAULT 0,
  default_gst_type TEXT DEFAULT 'intrastate',
  round_off_method TEXT DEFAULT 'two_decimals',
  default_tds_type TEXT DEFAULT '194C',
  enable_cash_rounding BOOLEAN DEFAULT true,
  default_godown_id UUID REFERENCES godowns(id),
  low_stock_threshold NUMERIC(12,2) DEFAULT 10,
  stock_valuation_method TEXT DEFAULT 'fifo',
  enable_batch_tracking BOOLEAN DEFAULT true,
  enable_serial_numbers BOOLEAN DEFAULT false,
  allow_negative_stock BOOLEAN DEFAULT false,
  enable_barcode_qr BOOLEAN DEFAULT false,
  auto_deduct_on_bill BOOLEAN DEFAULT true,
  job_work_default_bill_type TEXT DEFAULT 'kacha',
  job_work_auto_calculate BOOLEAN DEFAULT true,
  require_worker_assignment BOOLEAN DEFAULT false,
  auto_complete_lot BOOLEAN DEFAULT false,
  lock_completed_lots BOOLEAN DEFAULT true,
  allow_back_date_production BOOLEAN DEFAULT false,
  lot_number_prefix TEXT DEFAULT 'LOT',
  notif_default_time TEXT DEFAULT '09:00',
  notif_email_sender_name TEXT,
  notif_email_reply_to TEXT,
  notif_weekend BOOLEAN DEFAULT true,
  notif_holiday BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON business_settings
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- notification_rules
CREATE TABLE notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'payment_due','overdue','pdc_reminder','low_stock',
    'cheque_bounce','stage_delay','lot_complete','write_off_alert'
  )),
  is_enabled BOOLEAN DEFAULT true,
  days_before INTEGER DEFAULT 0,
  target_roles TEXT[] DEFAULT '{owner,admin}',
  enable_email BOOLEAN DEFAULT true,
  enable_sms BOOLEAN DEFAULT false,
  enable_in_app BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, type)
);
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON notification_rules
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- role_permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_add BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, role, module)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON role_permissions
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- backup_history
CREATE TABLE backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual','automatic')),
  file_key TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress','completed','failed')),
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_owner_admin" ON backup_history
  FOR ALL USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner','admin')
  );

-- Seed defaults when new business is registered
-- (call from /api/auth/register after creating business+user)
-- 1. INSERT INTO business_settings (business_id) VALUES (:bid);
-- 2. INSERT INTO notification_rules for all 8 types
-- 3. INSERT INTO role_permissions for all roles × modules with default values
```

---

## 7. API Routes

| Method | Route | Notes |
|---|---|---|
| GET/PUT | `/api/settings/general` | businesses + business_settings, optimistic lock |
| GET/PUT | `/api/settings/company-profile` | businesses table, R2 logo upload |
| GET | `/api/settings/users` | list users for business with role filter |
| POST | `/api/settings/users` | create via Supabase auth.admin + INSERT users |
| PUT | `/api/settings/users/[id]` | update name, phone, role |
| PATCH | `/api/settings/users/[id]/deactivate` | set deleted_at + invalidate session |
| GET/PUT | `/api/settings/permissions` | role_permissions bulk read + update |
| GET/PUT | `/api/settings/financial` | business_settings + brands bill series |
| GET/PUT | `/api/settings/inventory` | business_settings inventory fields |
| GET/PUT | `/api/settings/production` | business_settings production fields |
| GET/PUT | `/api/settings/notifications` | notification_rules bulk update |
| POST | `/api/settings/backup` | trigger backup → R2 → backup_history |
| GET | `/api/settings/backup-history` | list backup_history |
| DELETE | `/api/settings/backup-history/[id]` | delete record + R2 file |
| GET | `/api/settings/audit-logs` | paginated audit_log with filters |
| GET | `/api/settings/audit-logs/export` | CSV of filtered audit_log |
| GET | `/api/settings/storage-info` | DB size + R2 usage |

---

## 8. Reusable Settings Components

### `SettingsCard` — `components/settings/SettingsCard.tsx`
```tsx
// Props: icon: LucideIcon, iconBg?: string, title, subtitle, children, className?
// Renders the section header (icon square + title + subtitle + border-b) + children
// bg-white rounded-xl border border-[#E5E7EB] p-6
```

### `SettingsToggleRow` — `components/settings/SettingsToggleRow.tsx`
```tsx
// Props: icon: LucideIcon, label, subtitle, checked, onCheckedChange, disabled?
// Exact layout from Section 2.4
// Uses shadcn Switch
```

### `SettingsPreviewCard` — `components/settings/SettingsPreviewCard.tsx`
```tsx
// Props: title, subtitle, rows: { icon, label, value, type: 'text'|'badge' }[]
// Renders the right-side preview panel from General / Inventory / Production
// Accepts liveData prop for real-time updates
```

### `RoleBadge` — `components/shared/RoleBadge.tsx`
```tsx
// Props: role: string
// Exact colors as specified in Section 5.3
// text-xs font-medium px-2.5 py-1 rounded-md
```

### `ModuleBadge` — `components/shared/ModuleBadge.tsx`
```tsx
// Props: module: string
// Colors from Section 2.1 --module-* tokens
// Renders icon (size-3) + module name
```

### `ActionBadge` — `components/shared/ActionBadge.tsx`
```tsx
// Props: action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Logout' | 'Export'
// Colors from Section 2.1 --action-* tokens
```

### `InfoBanner` — `components/shared/InfoBanner.t
<truncated 8319 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.