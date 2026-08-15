# TAS ERP — Comprehensive User Manual & Testing Guide

> **Welcome to TAS ERP!**  
> TAS ERP is a complete, multi-company Enterprise Resource Planning system purpose-built for the **Textile, Apparel, and Garment Manufacturing** industry. It seamlessly connects **Raw Materials Purchasing**, **Cutting & Production Workflow**, **Outside Job Work / Karigar Tracking**, **Finished Goods Inventory**, **Barcode / QR Labeling & PWA Scanning**, **Wholesale & Retail Sales Invoicing (Pakka GST & Kacha Bills)**, **Payments & Double-Entry Ledgers**, **WhatsApp Dues Reminders**, and **Executive Financial Reporting**.

---

## Table of Contents

1. [System Overview & Global Navigation](#1-system-overview--global-navigation)
   - [Authentication & Multi-Company Switching](#authentication--multi-company-switching)
   - [Top Header Global Controls](#top-header-global-controls)
   - [Left Navigation Sidebar](#left-navigation-sidebar)
2. [Module 1: Dashboard](#module-1-dashboard)
3. [Module 2: Master Data](#module-2-master-data)
   - [Brands](#master-data-brands)
   - [Godowns / Warehouses](#master-data-godowns)
   - [Material Types & Raw Materials](#master-data-material-types)
   - [Production Stages & Templates](#master-data-production-stages)
   - [Size Sets](#master-data-size-sets)
   - [Designs Catalog & BOM](#master-data-designs)
   - [Expense Types](#master-data-expense-types)
   - [GST Rates & HSN](#master-data-gst-rates)
   - [Banks & UPI Accounts](#master-data-banks--upi)
   - [Units of Measurement](#master-data-units)
   - [Garment Types](#master-data-garment-types)
   - [Barcode & QR Master](#master-data-barcode--qr)
   - [Workers Directory](#master-data-workers)
4. [Module 3: Parties (Suppliers, Customers, Workers)](#module-3-parties)
5. [Module 4: Purchases (Raw Materials & Inward)](#module-4-purchases)
6. [Module 5: Production Management](#module-5-production-management)
   - [Production Lots (Lot Lifecycle & Costing)](#production-lots)
   - [Stage Entries & Piece-Rate Wages](#production-stage-entries)
   - [Job Work & Worker Ledger](#production-job-work)
7. [Module 6: Stock & Inventory Management](#module-6-stock--inventory-management)
   - [Finished Stock Matrix](#finished-stock-overview)
   - [Raw Material Stock](#raw-material-stock)
   - [Stock Operations (Adjustments, Transfers, Challans)](#stock-operations)
8. [Module 7: Mobile Scanner (PWA)](#module-7-mobile-scanner-pwa)
9. [Module 8: Sales & Billing](#module-8-sales--billing)
   - [Sales Bills (Pakka GST, Kacha Bills, Returns)](#sales-bills)
   - [Sales Orders & Booking](#sales-orders)
10. [Module 9: Payments & Financial Settlements](#module-9-payments--financial-settlements)
    - [Payments Workspace & History](#payments-workspace)
    - [Receive Payment (Customer Inward)](#payments-receive)
    - [Make Payment (Supplier & Worker Outward)](#payments-make)
    - [Direct Payment Linking & Contra Allocation](#payments-direct-link)
    - [Cheques & Post-Dated Cheques (PDC)](#cheques--pdc-management)
    - [Expenses & Adjustments](#expenses--adjustments)
    - [Salary & Advances](#salary--advances)
    - [Miscellaneous Income](#miscellaneous-income)
11. [Module 10: Calendar, Reminders & WhatsApp Follow-Ups](#module-10-calendar-reminders--whatsapp)
12. [Module 11: Reports & Business Intelligence](#module-11-reports--business-intelligence)
    - [Financial Reports (P&L, Balance Sheet, GST, Cashflow)](#reports-financial)
    - [Sales Reports](#reports-sales)
    - [Purchase Reports](#reports-purchases)
    - [Payment Reports](#reports-payments)
    - [Inventory Reports & Valuation](#reports-inventory)
    - [Production & Worker Output Reports](#reports-production)
    - [Party Statement / Running Ledger](#reports-party-statement)
    - [Executive Analysis](#reports-analysis)
13. [Module 12: Settings & System Administration](#module-12-settings--system-administration)
    - [General & Financial Defaults](#settings-general)
    - [Companies & Company Profile](#settings-company-profile)
    - [Users, Roles & Permission Matrix](#settings-users--roles)
    - [Bill Builder (Invoice Customization)](#settings-bill-builder)
    - [Database Backup & Restore](#settings-backup--restore)
    - [Audit Logs](#settings-audit-logs)
    - [Data Import Wizard](#settings-import)
14. [End-to-End Testing Scenarios (Walkthroughs)](#14-end-to-end-testing-scenarios)
15. [Troubleshooting & Common Questions](#15-troubleshooting--common-questions)

---

# 1. System Overview & Global Navigation

## Authentication & Multi-Company Switching
TAS ERP supports multi-tenant company isolation. A single user login can access one or multiple independent textile companies (e.g., "TAS Apparels Ltd" and "TAS Fabrics Trading").

* **Login Page (`/login`)**:
  - Enter registered email and password.
  - If multi-company access is enabled, the system redirects to `/select-company` or loads your default company session.
* **Company Selection (`/select-company`)**:
  - Displays cards for all companies you have permissions to view.
  - Clicking a company sets your session and redirects to the main Dashboard.

---

## Top Header Global Controls
The header is permanently accessible across all pages:

| Control | Location | What it does | How to Test |
|---|---|---|---|
| **Hamburger Toggle** | Top Left | Expands / collapses the sidebar navigation menu | Click button. Sidebar toggles between full icon+label width and compact icon-only width. |
| **Company Switcher** | Top Left | Switch current active company instantly | Click company name. Select a different company. Verify header updates and all tables refresh with that company's data. |
| **Breadcrumbs** | Top Left / Center | Displays current navigation trail | Click any previous crumb to jump back to higher-level lists. |
| **Brand Filter** | Top Right | Globally filters all stats and lists by Brand | Click dropdown, select a Brand (or "All Brands"). Dashboard KPIs and lists adjust. |
| **Period Filter** | Top Right | Globally sets active date scope (`Today`, `This Week`, `This Month`, `Last Month`, `This Fiscal Year`) | Click period dropdown. Change period and check data ranges. |
| **Notification Popover** | Top Right (Bell icon) | Alerts for overdue bills, low stock, bounced cheques, and lot milestones | Click Bell icon. Verify popover opens. Click any notification to jump directly to the target record. |
| **Theme Toggle** | Top Right (Sun/Moon icon) | Toggles between Dark Mode and Light Mode | Click toggle. Theme shifts instantaneously without breaking contrast. |
| **User Profile Dropdown** | Top Right (Avatar circle) | View user name/email, access Settings, or Sign Out | Click avatar -> Select **Profile Settings** or **Sign Out**. |

---

## Left Navigation Sidebar
The sidebar groups the entire ERP into logical departments:
1. **Dashboard** (`/`)
2. **Master Data** (`/master-data/...`)
3. **Parties** (`/parties`)
4. **Purchases** (`/purchases`)
5. **Production** (`/production/...`)
6. **Stock** (`/finished-stock`, `/stock/raw-materials`, `/finished-stock/operations`)
7. **Scan (PWA)** (`/scan`)
8. **Sales & Billing** (`/sales/bills`, `/sales/orders`)
9. **Payments & Finance** (`/payments`, `/expenses`, `/finance/cheques`)
10. **Calendar, Reminders & WhatsApp** (`/reminders`)
11. **Reports** (`/reports/...`)
12. **Settings** (`/settings/...`)

---

# Module 1: Dashboard

**Route**: `/`  
**Purpose**: Executive command center providing a 360° pulse of manufacturing, sales, inventory valuation, cash balances, and urgent alerts.

### What is on this page?
* **KPI Metric Cards**:
  - **Total Stock Value**: Total valuation of raw materials + finished garments in ₹.
  - **Today's Sales**: Gross sales revenue recorded today with day-on-day trend percentage.
  - **This Month Sales**: Cumulative revenue for the active month with comparison to previous month.
  - **Pending Dues (Receivables)**: Total outstanding money owed by buyers/customers.
  - **Cash & Bank Balance**: Liquid cash in hand + balance across all active bank accounts.
* **Sales Trend Chart**: Interactive line/area graph tracking daily billing revenue.
* **Production Status Donut**: Visual piece-count breakdown of active lots across manufacturing stages (Cutting, Stitching, Finishing, Quality Checking, Completed).
* **Low Stock Alerts Table**: Highlights fabric rolls or trims that have fallen below minimum safety reorder thresholds.
* **Godown Stock Distribution**: Warehouse-wise distribution showing quantity of pieces and total valuation.
* **Bank Balances Panel**: Quick cards listing each bank account name, account number, and live cleared balance.
* **Overdue Summary**: High-priority alert widget showing total overdue receivables vs payables.

### How to Test Module 1:
1. Navigate to `/`.
2. Verify all 5 KPI cards load numeric values.
3. Hover over the **Sales Trend Chart** to inspect daily tooltips.
4. Hover over the **Production Donut** segments to inspect stage counts.
5. In the top header, switch the **Period Filter** from "This Month" to "Today". Verify KPI cards update smoothly.
6. Switch the **Brand Filter** to a specific brand. Verify sales and stock metrics recalculate for that brand only.

---

# Module 2: Master Data

Master Data forms the backbone of the entire ERP. You configure your products, units, brands, warehouses, stages, and tax slabs here before running production and billing.

---

### Master Data: Brands
**Route**: `/master-data/brands`  
**Purpose**: Manage in-house apparel brands or customer private labels (e.g., "Zara Clone", "Urban Denim").

* **Key Elements**:
  - Table of brands: Name, Code, Description, Total Active Designs count, Status.
  - **+ Add Brand** button (opens modal).
* **Actions**:
  - Create brand: Name, unique Code, Logo image upload, status toggle.
  - Edit / Delete existing brand.
* **Testing Steps**:
  1. Click **+ Add Brand**.
  2. Fill Name: `Test Apparel`, Code: `TAP`, Description: `Premium Casuals`.
  3. Click **Save**. Verify toast alert `Brand created successfully` appears and `Test Apparel` is listed.

---

### Master Data: Godowns / Warehouses
**Route**: `/master-data/godowns`  
**Purpose**: Multi-location inventory management (e.g., "Main Factory Godown", "Cutting Unit Godown", "Dispatch Warehouse").

* **Key Elements**:
  - Table of Godowns: Name, Code, Location Address, Manager Name, Total Items count, Current Stock Value.
  - **+ Add Godown** button.
* **Testing Steps**:
  1. Click **+ Add Godown**.
  2. Enter Name: `Basement Storage`, Code: `BS-01`, Address: `Unit 4, Industrial Area`.
  3. Click **Save**. Verify new godown appears and becomes selectable in purchase and stock transfer dropdowns.

---

### Master Data: Material Types & Raw Materials
**Route**: `/master-data/raw-materials`  
**Purpose**: Master catalog of fabrics, yarns, threads, buttons, zippers, polybags, tags, and packing boxes.

* **Key Elements**:
  - Categories: `Fabric`, `Yarn`, `Trims & Accessories`, `Packaging`.
  - Columns: Item Code, Name, Category, Default Unit, Standard Cost, Current Available Quantity, Safety Reorder Level.
  - **+ Add Material Type** button.
* **Testing Steps**:
  1. Click **+ Add Material Type**.
  2. Enter Name: `100% Combed Cotton Single Jersey 180 GSM`, Category: `Fabric`, Unit: `Kgs` or `Meters`, Reorder Level: `50`.
  3. Click **Save**. Verify it appears in the catalog.

---

### Master Data: Production Stages & Templates
**Route**: `/master-data/production-stages/templates`  
**Purpose**: Define manufacturing processes (Cutting, Printing, Embroidery, Stitching, Washing, Ironing, Packing) and reusable workflow templates.

* **Key Elements**:
  - **Stage Master**: Master list of all possible stages with default piece-rate labor rates.
  - **Workflow Templates**: Pre-configured stage sequences (e.g., "Basic T-Shirt Workflow" vs "Denim Jacket with Wash Workflow").
* **Testing Steps**:
  1. Click **+ New Stage Template**.
  2. Enter Template Name: `Standard Round Neck T-Shirt`.
  3. Add stages in order: 1. Cutting -> 2. Screen Printing -> 3. Overlock Stitching -> 4. Flatlock -> 5. Ironing & Packing.
  4. Specify standard piece rates for each stage (e.g., Stitching: ₹12/pc). Click **Save Template**.

---

### Master Data: Size Sets
**Route**: `/master-data/size-sets`  
**Purpose**: Standardize garment size groupings used across cutting, inventory, and billing.

* **Key Elements**:
  - List of Size Sets (e.g., `S-M-L-XL-XXL`, `28-30-32-34-36`, `2-4-6-8 Kids`, `Free Size`).
  - Size tags order and sequence.
* **Testing Steps**:
  1. Click **+ Add Size Set**.
  2. Name: `Adult Standard 5-Size`, Sizes: `S, M, L, XL, XXL`.
  3. Click **Save**. Verify size set is available when creating new designs.

---

### Master Data: Designs Catalog & BOM
**Route**: `/master-data/designs`  
**Purpose**: Complete catalog of garment styles, Bill of Materials (BOM), sample photos, and wholesale/retail pricing.

* **Key Elements**:
  - Design Cards / Table: Design Code (e.g., `DSN-101`), Style Name, Brand, Garment Type, Size Set, Available Stock, Wholesale Rate, Retail MRP.
  - **+ Add New Design** modal:
    - Basic Details: Style Code, Name, Brand, Garment Type, Size Set.
    - Colors: Add available colorways (with color picker hex code).
    - Bill of Materials (BOM): Link required fabric, quantity per piece, buttons, threads.
    - Default Stage Template: Link standard manufacturing steps.
    - Pricing: Wholesale Base Rate, Retail MRP, GST Slab.
* **Testing Steps**:
  1. Click **+ Add Design**.
  2. Enter Code: `DSN-2026`, Name: `Vintage Oversized Graphic Tee`, Brand: Select `Test Apparel`, Size Set: `S-M-L-XL-XXL`.
  3. Add Colors: `Black (#000000)`, `Off White (#FAF9F6)`.
  4. Set Wholesale Rate: `₹350`, MRP: `₹899`. Click **Save**.

---

### Master Data: Expense Types
**Route**: `/master-data/expense-types`  
**Purpose**: Ledger expense categories for business operational overheads.

* **Key Elements**:
  - List of categories: `Factory Rent`, `Electricity & Power`, `Staff Welfare / Tea`, `Freight & Courier`, `Machine Maintenance & Oil`, `Office Supplies`.
* **Testing Steps**:
  1. Click **+ Add Expense Type**. Name: `Generator Fuel / Diesel`, Type: `Operational Expense`. Click **Save**.

---

### Master Data: GST Rates & HSN
**Route**: `/master-data/gst-rates`  
**Purpose**: Tax rates and Harmonized System of Nomenclature (HSN) codes for apparel and textiles.

* **Key Elements**:
  - Slabs: `0% (Exempt)`, `5% (Apparel < ₹1,000)`, `12% (Apparel > ₹1,000 / Synthetic)`, `18% (Services/Job work)`, `28%`.
  - HSN mappings (e.g., `6109` for T-Shirts, `5208` for Cotton Woven Fabrics).
* **Testing Steps**:
  1. Verify pre-configured 5%, 12%, and 18% slabs exist.
  2. Add/Edit custom HSN code `61091000` with 5% tax.

---

### Master Data: Banks & UPI Accounts
**Route**: `/master-data/banks-upi`  
**Purpose**: Manage company bank accounts, current accounts, overdrafts (OD), cash counters, and UPI QR IDs.

* **Key Elements**:
  - Accounts Table: Bank Name, Account Holder, Account Number, IFSC Code, Branch, UPI ID, Opening Balance, Live Balance, Default for Invoice toggle.
* **Testing Steps**:
  1. Click **+ Add Bank Account**.
  2. Bank Name: `HDFC Bank`, Account No: `50200012345678`, IFSC: `HDFC0001234`, Account Type: `Current Account`, Opening Balance: `₹50,000`.
  3. Toggle **Default for Invoices** = Yes. Click **Save**.

---

### Master Data: Units of Measurement
**Route**: `/master-data/units`  
**Purpose**: Measurement units for purchasing, consumption, and sales (`Pcs`, `Meters`, `Kgs`, `Dozen`, `Rolls`, `Cones`, `Gross`).

* **Testing Steps**:
  1. Click **+ Add Unit**. Code: `MTR`, Name: `Meters`, Decimal Places: `2`. Click **Save**.

---

### Master Data: Garment Types
**Route**: `/master-data/garment-types`  
**Purpose**: Product classification (`T-Shirts`, `Polo Shirts`, `Hoodies`, `Jeans`, `Shorts`, `Joggers`, `Shirts`, `Dresses`).

* **Testing Steps**:
  1. Click **+ Add Garment Type**. Name: `Cargo Pants`, Code: `CRG`. Click **Save**.

---

### Master Data: Barcode & QR Master
**Route**: `/master-data/barcode-qr`  
**Purpose**: Decode, inspect, and bulk-generate secure 1D barcodes (`Code 128`) and 2D QR codes for finished garment labels, box stickers, and roll tags.

* **Tabs Breakdown**:
  1. **Barcode / QR Decoder (`scan` tab)**:
     - Allows instant manual lookup or USB scanner input of a Barcode/QR UUID.
     - Fetches live stock details: Design style, Color, Size, MRP, Godown location, Production Lot reference.
  2. **Label Generator & Batch Print (`generator` tab)**:
     - Generates thermal printable label sheets.
     - Displays: Company Name, Design Code, Color, Size, MRP, HSN, Barcode graphic, and QR UUID.
     - Options: Print individual sticker or **Print All Batch**.
* **Testing Steps**:
  1. Open **Label Generator** tab.
  2. Select an active design with stock.
  3. Click **Generate Labels**. Verify barcode tags render with barcode graphic and clear text details.
  4. Click **Print**. Verify browser print dialog formats labels for thermal/sticker roll.

---

### Master Data: Workers Directory
**Route**: `/master-data/workers`  
**Purpose**: Master list of in-house tailors, master cutters, checkers, packers, and outside job-work contractors.

* **Key Elements**:
  - Columns: Worker ID (e.g., `WRK-001`), Full Name, Phone, Type (`In-house Staff` vs `Outside Job Worker / Contractor`), Skill / Specialized Stage, Wage Type (`Piece-rate` vs `Monthly Salary`).
* **Testing Steps**:
  1. Click **+ Add Worker**.
  2. Name: `Ramesh Master`, Worker ID: `WRK-101`, Phone: `9876543210`, Type: `Job Worker`, Specialization: `Cutting & Stitching`.
  3. Click **Save**.

---

# Module 3: Parties

**Route**: `/parties`  
**Purpose**: Central customer (buyer), supplier (vendor), and contractor (job worker) relationship and ledger directory.

### Tabs & Filters:
* **Tabs**:
  1. **All Parties**: Unified list of all registered business entities.
  2. **Suppliers**: Raw material and trim vendors.
  3. **Customers (Buyers)**: Wholesale buyers, retail shops, e-commerce portals.
  4. **Workers / Karigars**: Manufacturing contractors and piece-rate workers.
* **Search & Filters**: Search by Name, Company, Phone, GSTIN, State, or City.

### Key Actions on this page:
* **+ Add Party** button (opens comprehensive party creation page).
* **Party Profile 360 View (`/parties/[id]`)**:
  - Displays contact directory, multiple branch addresses, GSTIN, PAN, bank details, credit limits.
  - **Conditional Tabs**:
    - **Supplier Tab**: Purchase bills history, return notes, outstanding payables balance.
    - **Customer Tab**: Sales invoices history, payment receipt logs, outstanding receivables balance.
    - **Worker Tab**: Production stage assignments, job work issues, wage ledger.
* **Manual Note Modal**: Direct creation of Credit Note or Debit Note against a party.

### How to Test Module 3:
1. Navigate to `/parties`.
2. Click **+ Add Party**.
3. Select Type: `Customer` (Buyer).
4. Enter Name: `Apex Fashion House`, Phone: `9988776655`, GSTIN: `27AAAAA0000A1Z5`, State: `Maharashtra`.
5. Enter Billing & Shipping Address. Set Credit Limit: `₹2,00,000`. Click **Save**.
6. Find `Apex Fashion House` in the list, click on it to open `/parties/[id]`.
7. Verify all details, blank sales history, and 0 balance render properly.

---

# Module 4: Purchases (Raw Materials & Inward)

**Route**: `/purchases`  
**Purpose**: Record supplier invoices, inward fabric rolls, trims, and automatically update warehouse stock and supplier accounts payable.

### What is on this page?
* **Summary Cards**: Total Purchase Amount, Total Paid, Total Outstanding Payables, Purchase Returns count.
* **Purchases List Table**: Purchase Bill No, Supplier Invoice No, Supplier Name, Date, Destination Godown, Total Items, Taxable Value, GST Amount, Grand Total, Payment Status (`Paid`, `Partial`, `Unpaid`).
* **Actions**:
  - **+ New Purchase Bill** (`/purchases/new`): Comprehensive inward entry form.
  - **Purchase Returns** (`/purchases/returns`): Manage return of defective fabric/trims to vendors.
  - **View / Print Voucher**: View full line-item bill with tax breakdown.

### How to Test Module 4:
1. Navigate to `/purchases` and click **+ New Purchase Bill**.
2. Select Supplier: Choose a registered supplier party.
3. Enter Supplier Invoice No: `INV-FAB-8891`, Invoice Date: Today.
4. Select Destination Godown: `Basement Storage`.
5. Add Item line:
   - Item: `100% Combed Cotton Single Jersey 180 GSM`.
   - Quantity: `200` Kgs.
   - Purchase Rate: `₹280` per Kg.
   - GST Slab: `5%`.
6. Verify Subtotal (`₹56,000`), GST (`₹2,800`), and Grand Total (`₹58,800`) calculate automatically.
7. Click **Save & Inward Stock**.
8. Verify:
   - Purchase bill appears in `/purchases` list with status `Unpaid`.
   - Raw material stock in `/stock/raw-materials` increases by `200 Kgs`.
   - Supplier's ledger balance in `/parties/[id]` reflects `₹58,800` payable.

---

# Module 5: Production Management

The Production module powers the heart of the apparel factory, handling production batching, fabric cutting, multi-stage manufacturing tracking, job work challans, and exact piece-rate costing.

---

## Production Lots
**Route**: `/production/lots`  
**Purpose**: Manage production job orders from cutting to final packing.

### What is on this page?
* **KPI Metrics**: Total Active Lots, Lots In-Progress, Completed Lots, Overdue Batches, Total Pieces in Production.
* **Filter Bar**: Brand, Design, Status (`Draft`, `In Progress`, `Completed`, `On Hold`, `Cancelled`), Worker, Payment Status.
* **Production Lots Table**:
  - Lot Number (e.g., `LOT-2026-001`), Brand, Design Style, Colorway, Size Set, Planned Quantity, Completed Quantity, Current Stage, Days in Working Stage, Progress Bar, Action Menu.

### Detail Page (`/production/lots/[id]`):
* **Top Header & Status Badges**: Lot Number, Style Code, Planned vs Completed pieces, Move to Stock button.
* **Tabs Breakdown**:
  1. **Tab 1: Progress & Logs (`progress`)**:
     - **Stage Progress Tracker**: Step-by-step visual tracker showing every manufacturing step (e.g. Cutting [1000 pcs] -> Stitching [980 pcs] -> Washing [980 pcs] -> Packing [975 pcs]).
     - **Add Stage Dialog**: Insert additional unplanned stages (e.g., extra Embroidery or Special Wash).
     - **Stage Entries Log Table**: Log of all completed batches by date, worker name, accepted qty, and rejected/scrap qty.
     - **Move Lot to Stock Dialog**: When the final stage is complete, transfer packed garments into Finished Goods Inventory with Godown destination.
  2. **Tab 2: Lot Costing & Valuation (`costing`)**:
     - Complete unit costing breakdown:
       - Fabric Material Cost (Total Kg/Mtr consumed × rate)
       - Total Labor / Stage Wages (Sum of all karigar piece-rate entries)
       - Trims & Accessories Cost (Buttons, zippers, polybags, tags)
       - Factory Overheads & Other Costs
     - **Per-Piece Unit Costing**: Calculated automatically as `(Total Costs) / (Completed Good Pieces)`.
  3. **Tab 3: Lot Specifications & Routing (`details`)**:
     - Spec sheet, measurement chart, cutting breakdown matrix (Color × Size grid), linked raw material rolls.

### How to Test Production Lots:
1. Navigate to `/production/lots` and click **+ Create Production Lot** (`/production/lots/new`).
2. Select Brand: `Test Apparel`, Design: `Vintage Oversized Graphic Tee`.
3. Cutting Matrix:
   - Color: `Black` -> Enter sizes: `S: 50`, `M: 100`, `L: 100`, `XL: 50`. Total = `300 Pcs`.
4. Link Raw Material: Select Cotton Single Jersey fabric, specify estimated consumption `60 Kgs`.
5. Select Workflow Template: `Standard Round Neck T-Shirt`.
6. Click **Create Lot**.
7. In the lots list, click on the new lot to open `/production/lots/[id]`.
8. Verify all 3 tabs load correctly.

---

## Production Stage Entries
**Route**: `/production/stage-entries`  
**Purpose**: Record daily worker output, pieces completed per stage, defects/scrap, and automatically credit worker wage accounts.

### What is on this page?
* **Stage Entries Table**: Entry No, Date, Lot Number, Stage Name, Worker / Karigar Name, Quantity Completed, Rejection / Scrap Qty, Piece Rate (₹/pc), Total Labor Amount, Payment Status (`Unpaid`, `Paid`).
* **+ New Stage Entry** button:
  - Select Lot Number.
  - Select Active Stage (e.g., `Overlock Stitching`).
  - Select Worker (e.g., `Ramesh Master`).
  - Enter Quantity Received from Previous Stage: `300`.
  - Enter Quantity Completed: `298`, Rejected / Defective: `2`.
  - Piece Rate auto-populates (e.g., `₹12`). Total Amount calculates to `₹3,576`.
  - Click **Save Entry**.

---

## Production Job Work
**Route**: `/production/job-work`  
**Purpose**: Manage outside job work contractors, issue raw cuts for stitching/embroidery/washing, track return delivery challans, and maintain worker running ledgers.

### Tabs Breakdown:
1. **Tab 1: Job Work Entries / Issues (`entries`)**:
   - Lists all job work issues with issue date, due date, contractor name, lot number, stage, issued qty, rate, total amount, and settlement status.
   - Filter by Worker, Stage, Lot, Status, or Date range.
2. **Tab 2: Worker Ledger (`ledger`)**:
   - Select a worker/contractor to view their live double-entry wage ledger.
   - Displays running credits (work done) vs debits (payments/advances made) and current outstanding payable balance.
3. **Tab 3: Payment History (`payments`)**:
   - Log of all historical wage payments made to contractors with payment mode, bank name, reference number, and voucher print.

### Modals & Actions:
* **Record Payment Modal**: Make partial or full payment against a contractor's outstanding earnings.
* **Job Work Details Modal**: View complete piece breakdown and delivery challan slip.

---

# Module 6: Stock & Inventory Management

TAS ERP maintains a dual inventory system: **Raw Materials Stock** (fabric rolls, threads, trims) and **Finished Goods Stock** (packed garments classified by Design, Color, Size, and Godown).

---

## Finished Stock Overview
**Route**: `/finished-stock`  
**Purpose**: Real-time snapshot of ready-to-sell garments.

### What is on this page?
* **Stock Metrics**: Total Stock (Pieces), Total Unique Designs, Total Colorways, Total Sizes, Total Valuation (₹), Active Godowns.
* **Visual Charts**:
  - Warehouse Distribution Bar Chart.
  - Size-wise Breakdown (e.g., distribution across S, M, L, XL, XXL).
* **Top Selling Designs Table**: Design Code, Style Name, Total Pieces in Stock, Color variations, Godowns where stored, Total Valuation.

---

## Raw Material Stock
**Route**: `/stock/raw-materials`  
**Purpose**: Real-time inventory of fabrics, yarns, and packaging materials.

* **Key Elements**:
  - Filter by Material Category (`Fabric`, `Yarn`, `Trims`, `Packaging`) and Godown.
  - Columns: Item Code, Name, Category, Godown, Unit, Current Quantity, Safety Reorder Qty, Stock Status badge (`In Stock`, `Low Stock`, `Out of Stock`), Action (Adjust / Transfer).

---

## Stock Operations
**Route**: `/finished-stock/operations`  
**Purpose**: Unified control hub for stock reconciliations, inter-godown transfers, and delivery dispatch challans.

### Tabs Breakdown:
1. **Tab 1: Stock Adjustments (`adjustments`)**:
   - Used for physical audit reconciliations, damaged goods write-offs, or sample stock entries.
   - **+ Add Adjustment** button:
     - Select Item (Design + Color + Size).
     - Adjustment Type: `Addition (+)` or `Deduction (-)`.
     - Quantity Change, Unit Cost, Reason (`Physical Audit Variance`, `Fabric Damage / Wastage`, `Sample Issued`).
2. **Tab 2: Godown Transfers (`transfers`)**:
   - Move stock between company warehouses (e.g., Factory -> Retail Outlet).
   - **+ New Transfer** button:
     - Source Godown, Destination Godown, Vehicle / Transporter Details, Item Breakdown table.
3. **Tab 3: Delivery Challans (`challans`)**:
   - Issue non-sale delivery challans (e.g., sending garments for client approval, exhibition memo, job work transfer).
   - Printable delivery challan with transport details and receiver acknowledgment signature box.

---

# Module 7: Mobile Scanner (PWA)

**Route**: `/scan`  
**Purpose**: High-speed Progressive Web App (PWA) camera barcode scanner optimized for mobile phones and warehouse tablets.

### What is on this page?
* **Live Camera Viewfinder**:
  - Automatically scans 1D Barcodes (`Code 128`, `EAN-13`) and 2D QR Codes using device camera.
  - **Torch / Flashlight Toggle**: For dark warehouse environments.
  - **Camera Switcher**: Toggle between Back (environment) and Front camera.
  - **Audio Beep**: Audible confirmation upon successful barcode detection.
* **Manual Input Fallback**: Textbox to type or paste UUID / barcode manually if camera is unavailable.
* **Instant Stock Information Card**:
  - Design Style Code, Item Name, Color, Size, MRP, Current Godown, Lot reference.
  - Quick action buttons: **Transfer Stock**, **Dispatch on Sale**, **View Design Details**.

### How to Test Module 7:
1. Open `/scan` on your desktop or mobile browser.
2. Grant camera permissions when prompted.
3. If no camera is available, type a valid QR UUID into the manual input box and click **Lookup**.
4. Verify the stock card instantly renders with full item details.

---

# Module 8: Sales & Billing

The Sales module handles both official GST tax invoices (**Pakka Bills**) and informal estimate bills (**Kacha Bills**), Sales Orders, Sales Returns, and Barcode POS billing.

---

## Sales Bills
**Route**: `/sales/bills`  
**Purpose**: Invoicing workspace for all wholesale and retail sales.

### Tabs Breakdown:
1. **Tab 1: Pakka Bills (`pakka`)**:
   - Official Tax Invoices compliant with GST regulations.
   - Calculates Taxable Value, CGST, SGST, IGST (inter-state vs intra-state), and HSN summaries.
2. **Tab 2: Kacha Bills (`kacha`)**:
   - Estimate / Memo billing for cash or preliminary trade.
   - Can be converted to Pakka bills with 1-click (**Convert to Pakka** action).
3. **Tab 3: Sales Returns (`return`)**:
   - Credit notes and goods return slips. Restocks returned garments back to warehouse inventory.
4. **Tab 4: All Transactions (`all`)**:
   - Unified chronological view of all invoices and returns.

### Key Actions on this page:
* **+ Create Sale Bill** (`/sales/bills/new`):
  - Select Buyer / Customer Party.
  - Select Bill Type (`Pakka` vs `Kacha`).
  - Invoice Date, Due Date, Payment Terms.
  - **Item Entry Grid**:
    - Select Design Style -> Color -> Enter quantities across size matrix (S, M, L, XL, XXL).
    - Or **Scan Barcode**: Scan barcode directly to add items to cart.
    - Set Rate, Line Discount %, Tax Slab (5%, 12%, 18%).
  - **Payment Settlement**: Option to record immediate cash/bank receipt or leave as unpaid credit.
* **Bulk Excel Import & Template Download**: Download standard Excel template, populate billing rows, and upload to create multiple bills in batch.
* **Print Options**:
  - **Standard Tax Invoice (A4 PDF)**: Formatted with company header, buyer details, bank account, and GST breakdown.
  - **Thermal POS Receipt**: 3-inch slip for retail counters.
  - **Public Bill Share Link (`/p/bill/[token]`)**: Secure web link to share invoices directly via WhatsApp/SMS without logging in.

---

## Sales Orders
**Route**: `/sales/orders`  
**Purpose**: Advance booking of customer orders before manufacturing or dispatch.

* **Key Elements**:
  - Customer Name, Order Date, Delivery Target Date, Total Booked Quantity, Total Value, Fulfillment Status (`Pending`, `Partially Dispatched`, `Completed`, `Cancelled`).
  - **Convert Order to Sale Bill** button when goods are ready for dispatch.

---

# Module 9: Payments & Financial Settlements

TAS ERP features a comprehensive double-entry accounting engine for tracking inward receipts, supplier payables, advances, PDC cheques, and daily operational expenses.

---

## Payments Workspace
**Route**: `/payments`  
**Purpose**: Unified dashboard for all cash, bank, UPI, and cheque transactions.

### Tabs Breakdown:
1. **Tab 1: Payment History (`history`)**:
   - Filter by direction (`All`, `Inward Received`, `Outward Paid`), Date range, or Payment Mode.
   - Columns: Payment No, Date, Party Name, Direction Badge, Payment Mode (`Cash`, `NEFT/RTGS`, `UPI`, `Cheque`), Amount (₹), Unallocated Advance (₹), Status, Voucher Print.
2. **Tab 2: Advances & Credit Notes (`advances`)**:
   - View unadjusted customer advance receipts and supplier advance payments.
   - Manage open Credit Notes available for future bill adjustments.
3. **Tab 3: Direct Payment Linking (`direct-link`)**:
   - Contra settlements and line-item invoice reconciliation.
   - Allows allocating unassigned receipts against specific unpaid sales bills using FIFO auto-allocation or manual amount entry.

---

## Receive Payment (Customer Inward)
**Route**: `/payments/receive`  
**Purpose**: Record payment received from a customer/buyer.

* **Form Fields**:
  - Customer Party selector.
  - Payment Date, Payment Mode (`Bank Transfer`, `Cash`, `UPI`, `Cheque/PDC`).
  - Deposited Into Bank Account selector.
  - Total Received Amount.
  - TDS Deducted (if applicable), Discount / Write-Off Amount.
  - **Unpaid Invoices Allocation Table**: Checkbox list of unpaid bills for this customer with balance dues. Allocates amount to bills in real-time.
  - Click **Save & Post Receipt**.

---

## Make Payment (Supplier & Worker Outward)
**Route**: `/payments/make`  
**Purpose**: Disburse payment to raw material suppliers, transport agencies, or job-work karigars.

* **Form Fields**:
  - Party selector (Supplier / Worker).
  - Paid From Account (Bank / Cash Counter).
  - Payment Amount, Payment Mode, Cheque No / Reference No.
  - Link against unpaid purchase invoices or worker stage wages.

---

## Cheques & Post-Dated Cheques (PDC)
**Route**: `/finance/cheques`  
**Purpose**: Complete lifecycle management for bank cheques received from customers or issued to vendors.

### Tabs Breakdown:
1. **Tab 1: Cheques Received (`received`)**:
   - Cheques collected from buyers.
   - Statuses: `Pending` -> `Deposited` -> `Cleared` OR `Bounced` / `Cancelled`.
   - **Actions**:
     - **Deposit Cheque**: Select target company bank account and deposit date.
     - **Mark Cleared**: Credits bank balance and finalizes invoice settlement.
     - **Mark Bounced**: Reverses invoice payment, logs bank bounce charges, and alerts customer ledger.
2. **Tab 2: Cheques Issued (`issued`)**:
   - Cheques written to suppliers/workers.
   - Track presentation and debit clearance against bank accounts.

---

## Expenses & Adjustments
**Route**: `/expenses`  
**Purpose**: Record day-to-day factory and office expenses.

* **Form Fields**: Expense Category (Rent, Electricity, Tea/Food, Travel, Machine Repair), Amount, Paid From Bank/Cash, Paid To, Tax invoice attachment, Remarks.

---

## Salary & Advances
**Route**: `/salary`  
**Purpose**: Monthly staff payroll and daily wage settlement.

* **Sub-routes**:
  - `/salary/process`: Calculate monthly net pay after deducting advances and TDS.
  - `/salary/advances`: Issue staff salary advances and track monthly recovery.

---

## Miscellaneous Income
**Route**: `/misc-income`  
**Purpose**: Record non-operational revenue (e.g., scrap fabric cut-piece sale, carton box disposal, rental sub-lease, interest).

---

# Module 10: Calendar, Reminders & WhatsApp

**Route**: `/reminders`  
**Purpose**: Automated debt recovery, payment follow-up calendar, and 1-click WhatsApp customer messaging.

### Tabs Breakdown:
1. **Tab 1: Calendar Planner & Schedule (`calendar`)**:
   - Interactive monthly and weekly calendar planner.
   - Visual color-coded event markers for:
     - 🔴 Overdue Customer Invoices
     - 🟡 Upcoming Sales Bill Dues
     - 🟢 Expected Inward PDC Cheque Clearances
     - 🔵 Scheduled Vendor Payables
   - Clicking any date expands a detailed day-view side drawer with direct settlement buttons.
2. **Tab 2: Customer Receivables (`receivables`)**:
   - Table of all overdue sales bills sorted by days overdue.
   - Columns: Invoice No, Date, Due Date, Party Name, Phone, Outstanding Amount, Days Overdue, Snooze Status, WhatsApp Action.
   - **Actions**:
     - **Snooze Reminder**: Delay reminder alerts for X days.
     - **Send WhatsApp**: Opens WhatsApp Web / Mobile app with pre-filled reminder text and public bill link.
     - **Bulk WhatsApp Action**: Generate bulk reminder queue for all selected overdue clients.
3. **Tab 3: Supplier Payables (`payables`)**:
   - List of vendor invoices nearing due date.
   - Send payment advice notices to suppliers.
4. **Tab 4: Cheques & PDC Reminders (`cheques`)**:
   - Alerts for cheques maturing in the next 3–7 days.
5. **Tab 5: WhatsApp Templates (`templates`)**:
   - Template editor with dynamic placeholder chips:
     - `{{party_name}}`, `{{invoice_no}}`, `{{amount}}`, `{{due_date}}`, `{{days}}`, `{{bill_url}}`.
   - Live test preview box to verify message formatting before dispatch.

---

# Module 11: Reports & Business Intelligence

All report pages feature date range presets (`Today`, `This Month`, `This FY`, `Custom`), multi-filter pills, interactive Recharts visualizations, and 1-click **Excel Export** and **PDF Print**.

---

### Financial Reports
**Route**: `/reports/financial`  
* **Tabs**:
  1. **Profit & Loss (`pl`)**: Revenue from Sales vs Cost of Goods Sold (COGS) vs Operational Expenses = Gross & Net Profit.
  2. **Balance Sheet (`balance`)**: Assets (Current Stock, Bank Balances, Receivables) vs Liabilities (Payables, Loans) + Equity.
  3. **GST Summary (`gst`)**: GSTR-1 Sales Tax liability vs GSTR-3B Purchase Input Tax Credit (ITC) with net GST payable.
  4. **Cash Flow (`cashflow`)**: Operating, investing, and financing cash movement.

---

### Sales Reports
**Route**: `/reports/sales`  
* **Tabs**: `Combined`, `Kaacha Bills`, `Pakka Bills`.
* **Filters**: Customer Party, Payment Status (`Paid`, `Partial`, `Unpaid`), Date Period.
* **Charts**: Monthly revenue area chart, Top 10 buying customers bar chart, Product category sales pie chart.

---

### Purchase Reports
**Route**: `/reports/purchases`  
* Breakdown of raw material purchasing by supplier, material category (Cotton, Polyester, Trims), and monthly spend trends.

---

### Inventory & Stock Reports
**Route**: `/reports/inventory`  
* **Tabs**:
  1. **Stock Valuation (`valuation`)**: Total ₹ value of inventory categorized by fabric vs finished apparel.
  2. **Warehouse Stock (`warehouse`)**: Piece count and valuation by godown.
  3. **Design Stock (`design`)**: Style-wise inventory depth and fast/slow-moving analysis.

---

### Production & Worker Output Reports
**Route**: `/reports/production`  
* **Tabs**:
  1. **Production Overview (`overview`)**: Monthly manufacturing volume, stage throughput, bottlenecks.
  2. **Worker Job Work (`workers`)**: Individual karigar output, total pieces made, defect rates, and earnings.

---

### Party Statement / Running Ledger
**Route**: `/reports/party-statement`  
* Search and select any Party (Customer, Supplier, or Worker).
* Displays chronological double-entry ledger: Date, Voucher Type, Ref No, Debit (₹), Credit (₹), and Running Balance.
* Export to formatted Excel statement or print formal PDF statement for client reconciliation.

---

### Executive Analysis
**Route**: `/reports/analysis`  
* Top 5 / 10 / 20 / 50 customer ranking, Pareto 80/20 analysis of styles, seasonal sales comparison.

---

# Module 12: Settings & System Administration

**Route**: `/settings/...`  
**Purpose**: System-wide configuration, security roles, company profiles, and data safety.

---

### General & Financial Settings
**Route**: `/settings/general` & `/settings/financial`  
* Set base currency format (`₹ INR`), decimal precision, fiscal year start/end dates, default invoice series numbering, and negative stock policy.

---

### Companies & Company Profile
**Route**: `/settings/companies` & `/settings/company-profile`  
* Manage multi-company registrations.
* Set Legal Name, Trade Name, GSTIN, PAN, Registered Address, Bank Account details, and upload Company Brand Logo.

---

### Users, Roles & Permissions
**Route**: `/settings/users-roles`  
* **User Accounts**: Create user logins with Email, Full Name, Phone, and Role.
* **Roles Available**: `Admin`, `Manager`, `Production Supervisor`, `Sales Executive`, `Accountant`, `Viewer`.
* **Granular Permission Matrix**: Configure View, Add, Edit, Delete, Approve, and Export rights for every individual module.

---

### Bill Builder (Invoice Customization)
**Route**: `/settings/bill-builder`  
* **Tabs**:
  1. **Print Settings (`print_settings`)**: Configure Terms & Conditions, Legal Declarations, Bank details on invoice footer, and Authorized Signatory text.
  2. **Layout Builder (`layout_builder`)**: Interactive canvas to arrange logo placement, company header, columns, and border styles.

---

### Backup & Restore
**Route**: `/settings/backup-restore`  
* **Manual Backup**: Create and download instant JSON/SQL encrypted database snapshots.
* **Auto-Backup Schedule**: Configure daily automatic snapshots (e.g. daily at 23:45) with retention days.
* **Restore from Backup**: Upload a previously exported backup file to restore system state.

---

### Audit Logs
**Route**: `/settings/audit-logs`  
* Immutable audit trail recording user logins, record creations, price modifications, stock adjustments, and record deletions with IP and timestamp.

---

### Data Import Wizard
**Route**: `/settings/import`  
* Upload Excel / CSV spreadsheets to import historical Parties, Designs catalog, Raw Materials, and Opening Stock balances.

---

# 14. End-to-End Testing Scenarios

Here are step-by-step end-to-end tests that verify the complete operational flow of TAS ERP from raw cotton purchase to customer payment:

```
                  ┌─────────────────────────────────┐
                  │ 1. Master Setup                 │
                  │ (Brand, Design, Godown, Worker) │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 2. Purchase Raw Materials       │
                  │ (Cotton Fabric -> Inward Stock) │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 3. Create Production Lot        │
                  │ (Issue Fabric -> Cut 300 Pcs)   │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 4. Track Stages & Job Work      │
                  │ (Stitching -> Ironing -> Pack)  │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 5. Move Lot to Finished Stock   │
                  │ (300 Pcs in Main Godown)        │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 6. Print Barcodes & Scan (PWA)  │
                  │ (Label Generation -> Scan Test) │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 7. Create Sales Bill (Invoice)  │
                  │ (Sell 100 Pcs to Apex Fashion)  │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 8. Collect Customer Payment     │
                  │ (Receive ₹35,000 -> Bank Debit) │
                  └──────────────┬──────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ 9. Financial & Audit Check      │
                  │ (P&L Profit -> Ledger Balance 0)│
                  └─────────────────────────────────┘
```

---

### Scenario Test Checklist:

#### Step 1: Master Data
- [ ] Create Brand `Test Brand`.
- [ ] Create Godown `Main Warehouse`.
- [ ] Create Size Set `S, M, L, XL`.
- [ ] Create Design `DSN-101` (Vintage Tee), Size Set `S-XL`, Wholesale Rate `₹350`.
- [ ] Create Party `Supreme Textiles` (Type: `Supplier`).
- [ ] Create Party `Apex Retailers` (Type: `Customer`).
- [ ] Create Worker `Ramesh Karigar` (Type: `Job Worker`).

#### Step 2: Purchase & Raw Material Inward
- [ ] Go to `/purchases/new`.
- [ ] Create Purchase Bill from `Supreme Textiles` for `100 Kgs` Cotton Fabric at `₹250/Kg` = `₹25,000` + 5% GST = `₹26,250`.
- [ ] Verify raw material stock increases by 100 Kgs in `/stock/raw-materials`.
- [ ] Verify `Supreme Textiles` ledger reflects `₹26,250` credit payable.

#### Step 3: Production Lot Lifecycle
- [ ] Go to `/production/lots/new`.
- [ ] Create Lot `LOT-001` for Design `DSN-101`.
- [ ] Cutting Breakdown: `S: 25`, `M: 50`, `L: 50`, `XL: 25` = `150 Pcs`.
- [ ] Issue `30 Kgs` fabric from `Main Warehouse`.
- [ ] Complete Stage 1 (Cutting) -> Stage 2 (Stitching with worker `Ramesh`) -> Stage 3 (Packing).
- [ ] In `/production/lots/[id]`, open **Costing tab** -> Verify unit cost per piece is calculated.
- [ ] Click **Move Lot to Stock** -> Send 150 Pcs to `Main Warehouse`.
- [ ] Verify Finished Stock in `/finished-stock` shows `150 Pcs` for `DSN-101`.

#### Step 4: Barcode Printing & PWA Scan
- [ ] Go to `/master-data/barcode-qr` -> **Label Generator tab**.
- [ ] Generate labels for `DSN-101` -> Click **Print**.
- [ ] Go to `/scan` -> Scan or enter barcode UUID -> Verify stock card loads with `150 Pcs` available.

#### Step 5: Sales Invoicing
- [ ] Go to `/sales/bills/new`.
- [ ] Select Customer `Apex Retailers`, Type: `Pakka Bill`.
- [ ] Add `DSN-101`: `M: 20 pcs`, `L: 20 pcs` = `40 Pcs` at `₹350` = `₹14,000` + 5% GST = `₹14,700`.
- [ ] Click **Save & Dispatch**.
- [ ] Verify:
  - Finished stock decreases from `150` to `110 Pcs`.
  - Customer ledger in `/reports/party-statement` reflects `₹14,700` debit due.

#### Step 6: Payment Receipt & Settlement
- [ ] Go to `/payments/receive`.
- [ ] Select Customer `Apex Retailers`.
- [ ] Enter Amount: `₹14,700`, Mode: `Bank Transfer`, Target Account: `HDFC Bank`.
- [ ] Allocate against the unpaid invoice. Click **Save Receipt**.
- [ ] Verify:
  - Invoice payment status in `/sales/bills` changes to `Paid`.
  - Customer ledger balance returns to `₹0.00`.
  - Bank balance in `/master-data/banks-upi` increases by `₹14,700`.

#### Step 7: Reports & Profit Verification
- [ ] Open `/reports/financial` -> **Profit & Loss tab**.
- [ ] Verify Sales Revenue reflects `₹14,000`, COGS reflects manufactured cost, and Gross Profit is positive.
- [ ] Open `/reports/party-statement` -> Verify running balance is zero.

---

# 15. Troubleshooting & Common Questions

### Q1: Why is an item blocked from deletion in Sales Bills?
> **Answer**: If a payment has already been received or allocated against that sales bill, TAS ERP prevents deletion to protect accounting integrity. You must first unallocate/delete the payment receipt in `/payments` before the bill can be cancelled or deleted.

### Q2: How do I switch between Dark Mode and Light Mode?
> **Answer**: Click the Sun/Moon icon in the top right corner of the header. The system remembers your preference across browser sessions.

### Q3: Why does a worker's ledger show pending dues?
> **Answer**: Every time a stage entry is logged for a worker in `/production/stage-entries`, the system credits their earnings. To clear this balance, record a payment voucher via `/production/job-work` (Tab 3) or `/payments/make`.

### Q4: Can I share an invoice with a buyer without giving them an ERP login?
> **Answer**: Yes! In `/sales/bills`, click the action menu on any invoice and select **Share via WhatsApp** or **Copy Public Bill Link**. The customer can view the invoice online at `/p/bill/[token]`.

### Q5: How do I backup my database?
> **Answer**: Navigate to `/settings/backup-restore` and click **Create Manual Backup Now**. You can download the encrypted file directly to your local computer.

---

*TAS ERP — Built for Speed, Reliability, and Operational Excellence.*
