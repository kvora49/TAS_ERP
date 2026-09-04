import {
  FileText,
  ClipboardList,
  ArrowLeftRight,
  Boxes,
  Scale,
  Truck,
  Star,
  Barcode,
  Hammer,
  Package,
  Receipt,
  Layers,
  Users,
  PlusCircle,
  CreditCard,
  ArrowDownLeft,
  Wallet,
  Link as LinkIcon,
  AlertCircle,
  Tag,
  Palette,
  Warehouse,
  Shirt,
  Percent,
  Ruler,
  DollarSign,
  Building2,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export const SALES_NAV: NavItem[] = [
  { label: "Bills & Invoices", href: "/sales/bills", icon: FileText },
  { label: "Orders / Bookings", href: "/sales/orders", icon: ClipboardList },
  { label: "Sales Returns", href: "/sales/returns", icon: ArrowLeftRight },
];

export const PRODUCTION_NAV: NavItem[] = [
  { label: "Lots", href: "/production/lots", icon: Layers },
  { label: "Stage Entries", href: "/production/stage-entries", icon: ClipboardList },
  { label: "Job Work", href: "/production/job-work", icon: Hammer },
];

export const FINISHED_STOCK_NAV: NavItem[] = [
  { label: "Overview", href: "/finished-stock", icon: Boxes },
  { label: "Adjustments", href: "/finished-stock/adjustments", icon: Scale },
  { label: "Transfers", href: "/finished-stock/transfers", icon: ArrowLeftRight },
  { label: "Delivery Challans", href: "/finished-stock/challans", icon: Truck },
  { label: "B-Grade & Aatri", href: "/finished-stock/b-grade", icon: Star },
  { label: "Barcode / QR", href: "/finished-stock/barcode-qr", icon: Barcode },
  { label: "Operations", href: "/finished-stock/operations", icon: Hammer },
];

export const RAW_MATERIALS_NAV: NavItem[] = [
  { label: "RM Stock", href: "/stock/raw-materials", icon: Package },
  { label: "RM Purchases", href: "/purchases", icon: Receipt },
  { label: "RM Returns", href: "/purchases?tab=returns", icon: ArrowLeftRight },
];

export const PURCHASES_NAV: NavItem[] = [
  { label: "Purchase Log", href: "/purchases", icon: Receipt },
  { label: "Purchase Returns", href: "/purchases/returns", icon: ArrowLeftRight },
];

export const PARTIES_NAV: NavItem[] = [
  { label: "All Parties", href: "/parties", icon: Users },
  { label: "Add New Party", href: "/parties/new", icon: PlusCircle },
];

export const PAYMENTS_NAV: NavItem[] = [
  { label: "History", href: "/payments", icon: CreditCard },
  { label: "Receive", href: "/payments/receive", icon: ArrowDownLeft },
  { label: "Make Payment", href: "/payments/make", icon: ArrowLeftRight },
  { label: "Supplier", href: "/payments/supplier", icon: Truck },
  { label: "Advances", href: "/payments/advances", icon: Wallet },
  { label: "Direct Link", href: "/payments/direct-link", icon: LinkIcon },
  { label: "Write-offs", href: "/payments/write-offs", icon: AlertCircle },
];

export const MASTER_DATA_NAV: NavItem[] = [
  { label: "Brands", href: "/master-data/brands", icon: Tag },
  { label: "Designs", href: "/master-data/designs", icon: Palette },
  { label: "Godowns", href: "/master-data/godowns", icon: Warehouse },
  { label: "Garments", href: "/master-data/garment-types", icon: Shirt },
  { label: "GST Rates", href: "/master-data/gst-rates", icon: Percent },
  { label: "Size Sets", href: "/master-data/size-sets", icon: Ruler },
  { label: "Units", href: "/master-data/units", icon: Scale },
  { label: "Workers", href: "/master-data/workers", icon: Users },
  { label: "Stages", href: "/master-data/production-stages", icon: Layers },
  { label: "Banks/UPI", href: "/master-data/banks-upi", icon: Building2 },
  { label: "Expense Types", href: "/master-data/expense-types", icon: DollarSign },
  { label: "Barcode/QR", href: "/master-data/barcode-qr", icon: Barcode },
  { label: "Raw Materials", href: "/master-data/raw-materials", icon: Package },
];

export const SETTINGS_NAV: NavItem[] = [
  { label: "General", href: "/settings/general" },
  { label: "Financial", href: "/settings/financial" },
  { label: "Inventory", href: "/settings/inventory" },
  { label: "Production", href: "/settings/production" },
  { label: "Company Profile", href: "/settings/company-profile" },
  { label: "Companies", href: "/settings/companies" },
  { label: "Users & Roles", href: "/settings/users-roles" },
  { label: "Communication", href: "/settings/communication" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Audit Logs", href: "/settings/audit-logs" },
  { label: "Backup & Restore", href: "/settings/backup-restore" },
  { label: "Import Data", href: "/settings/import" },
  { label: "Bill Builder", href: "/settings/bill-builder" },
];

export const REPORTS_NAV: NavItem[] = [
  { label: "Financial", href: "/reports/financial" },
  { label: "Sales", href: "/reports/sales" },
  { label: "Purchases", href: "/reports/purchases" },
  { label: "Inventory", href: "/reports/inventory" },
  { label: "Payments", href: "/reports/payments" },
  { label: "Production", href: "/reports/production" },
  { label: "Party Reports", href: "/reports/party-reports" },
  { label: "Party Statement", href: "/reports/party-statement" },
  { label: "Profit & Loss", href: "/reports/profit-loss" },
  { label: "Balance Sheet", href: "/reports/balance-sheet" },
  { label: "Cash Flow", href: "/reports/cash-flow" },
  { label: "GST Summary", href: "/reports/gst-summary" },
  { label: "Valuation", href: "/reports/stock-valuation" },
  { label: "Executive", href: "/reports/analysis" },
];
