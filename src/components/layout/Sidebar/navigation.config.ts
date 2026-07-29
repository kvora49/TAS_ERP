import {
  Home,
  Settings2,
  Package,
  Factory,
  Boxes,
  Receipt,
  Wallet,
  Settings,
  Users,
  QrCode,
} from "lucide-react";
import { QueryClient } from "@tanstack/react-query";

export interface NavSubSubItem {
  name: string;
  href: string;
}

export interface NavSubItem {
  name: string;
  href?: string;
  subItems?: NavSubSubItem[];
}

export interface NavItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<any>;
  subItems?: NavSubItem[];
}

export const IMPLEMENTED_ROUTES = [
  "/",
  "/master-data/brands",
  "/master-data/godowns",
  "/master-data/production-stages/templates",
  "/master-data/size-sets",
  "/master-data/designs",
  "/master-data/expense-types",
  "/master-data/gst-rates",
  "/master-data/banks-upi",
  "/master-data/raw-materials",
  "/master-data/workers",
  "/master-data/units",
  "/master-data/garment-types",
  "/parties",
  "/raw-materials/purchases",
  "/raw-materials/purchase-returns",
  "/raw-materials/stock",
  "/production/lots",
  "/production/stage-entries",
  "/production/job-work",
  "/production/job-work/list",
  "/production/job-work/record-payment",
  "/payments/supplier",
  "/finished-stock",
  "/finished-stock/designs",
  "/finished-stock/adjustments",
  "/finished-stock/adjustments/new",
  "/finished-stock/transfers",
  "/finished-stock/transfers/new",
  "/finished-stock/challans",
  "/finished-stock/challans/new",
  "/finished-stock/barcode-qr",
  "/scan",
];

export const isWhitelisted = (href: string): boolean => {
  return (
    IMPLEMENTED_ROUTES.includes(href) ||
    href.startsWith("/production/job-work/ledger") ||
    href === "/settings/general" ||
    href === "/settings/company-profile" ||
    href === "/settings/users-roles" ||
    href === "/settings/financial" ||
    href === "/settings/inventory" ||
    href === "/settings/production" ||
    href === "/settings/integrations" ||
    href === "/settings/notifications" ||
    href === "/settings/backup-restore" ||
    href === "/settings/audit-logs" ||
    href === "/settings/communication" ||
    href.startsWith("/master-data/workers/") ||
    href.startsWith("/master-data/production-stages/templates/") ||
    href.startsWith("/production/lots/") ||
    href.startsWith("/production/stage-entries/") ||
    href.startsWith("/finished-stock/designs/") ||
    href.startsWith("/finished-stock/operations") ||
    href.startsWith("/finished-stock/adjustments/") ||
    href.startsWith("/finished-stock/transfers/") ||
    href.startsWith("/finished-stock/challans/") ||
    href.startsWith("/parties") ||
    href.startsWith("/sales") ||
    href.startsWith("/purchases") ||
    href.startsWith("/finance") ||
    href.startsWith("/payments") ||
    href.startsWith("/expenses") ||
    href.startsWith("/misc-income") ||
    href.startsWith("/salary") ||
    href.startsWith("/reports") ||
    href.startsWith("/reminders")
  );
};

export const handlePrefetch = (href: string, queryClient: QueryClient) => {
  if (href === "/raw-materials/purchases") {
    queryClient.prefetchQuery({
      queryKey: ["purchases"],
      queryFn: async () => {
        const res = await fetch("/api/raw-materials/purchases");
        return (await res.json()).purchases || [];
      }
    });
  } else if (href === "/raw-materials/stock") {
    queryClient.prefetchQuery({
      queryKey: ["stock", "summary", ""],
      queryFn: async () => {
        const res = await fetch("/api/raw-materials/stock?view=summary&godown_id=");
        return (await res.json()).stock || [];
      }
    });
  } else if (href === "/parties") {
    queryClient.prefetchQuery({
      queryKey: ["parties"],
      queryFn: async () => {
        const res = await fetch("/api/parties");
        return (await res.json()).parties || [];
      }
    });
  } else if (href === "/finance/cheques") {
    queryClient.prefetchQuery({
      queryKey: ["cheques", "received", "", "", 1],
      queryFn: async () => {
        const res = await fetch("/api/finance/cheques?direction=received&page=1&limit=10");
        return res.json();
      }
    });
  } else if (href === "/production/lots") {
    queryClient.prefetchQuery({
      queryKey: ["lots-list", "all", "all", "all", "", "", "", 1],
      queryFn: async () => {
        const res = await fetch("/api/production/lots?page=1&limit=10");
        return res.json();
      }
    });
  } else if (href === "/master-data/brands") {
    queryClient.prefetchQuery({
      queryKey: ["brands-list"],
      queryFn: async () => {
        const res = await fetch("/api/master-data/brands");
        return res.json();
      }
    });
  } else if (href === "/master-data/designs") {
    queryClient.prefetchQuery({
      queryKey: ["designs-list"],
      queryFn: async () => {
        const res = await fetch("/api/master-data/designs");
        return res.json();
      }
    });
  } else if (href === "/sales/bills") {
    queryClient.prefetchQuery({
      queryKey: ["sales-bills", 1],
      queryFn: async () => {
        const res = await fetch("/api/sales/bills?page=1&limit=10");
        return res.json();
      }
    });
  }
};

export const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home },
  {
    name: "Master Data",
    icon: Settings2,
    subItems: [
      { name: "Brands", href: "/master-data/brands" },
      { name: "Godowns", href: "/master-data/godowns" },
      { name: "Material Types", href: "/master-data/raw-materials" },
      { name: "Production Stages", href: "/master-data/production-stages/templates" },
      { name: "Size Sets", href: "/master-data/size-sets" },
      { name: "Designs", href: "/master-data/designs" },
      { name: "Expense Types", href: "/master-data/expense-types" },
      { name: "GST Rates", href: "/master-data/gst-rates" },
      { name: "Banks & UPI", href: "/master-data/banks-upi" },
      { name: "Units", href: "/master-data/units" },
      { name: "Garment Types", href: "/master-data/garment-types" },
      { name: "Barcode / QR", href: "/master-data/barcode-qr" },
    ],
  },
  { name: "Parties", href: "/parties", icon: Users },
  {
    name: "Raw Materials",
    icon: Package,
    subItems: [
      { name: "Purchases", href: "/raw-materials/purchases" },
      { name: "Raw Material Stock", href: "/raw-materials/stock" },
    ],
  },
  {
    name: "Production",
    icon: Factory,
    subItems: [
      { name: "Production Lots", href: "/production/lots" },
      { name: "Stage Entries", href: "/production/stage-entries" },
      { name: "Job Work", href: "/production/job-work" },
    ],
  },
  {
    name: "Finished Stock",
    icon: Boxes,
    subItems: [
      { name: "Overview", href: "/finished-stock" },
      { name: "Stock Operations", href: "/finished-stock/operations" },
    ],
  },
  { name: "Scan (PWA)", href: "/scan", icon: QrCode },
  {
    name: "Sales & Billing",
    icon: Receipt,
    subItems: [
      { name: "Sales", href: "/sales/bills" },
      { name: "Orders", href: "/sales/orders" },
      { name: "Cheques / PDC", href: "/finance/cheques" },
    ],
  },
  {
    name: "Payments & Finance",
    icon: Wallet,
    subItems: [
      {
        name: "Payments",
        subItems: [
          { name: "Receive Payment", href: "/payments/receive" },
          { name: "Make Payment", href: "/payments/make" },
          { name: "Advance Payments", href: "/payments/advances" },
          { name: "Direct Payment Linking", href: "/payments/direct-link" },
        ],
      },
      { name: "Write-offs", href: "/payments/write-offs" },
      { name: "Expenses", href: "/expenses" },
      { name: "Misc Income", href: "/misc-income" },
      { name: "Salary", href: "/salary" },
      {
        name: "Reports",
        subItems: [
          { name: "Balance Sheet", href: "/reports/balance-sheet" },
          { name: "Profit & Loss", href: "/reports/profit-loss" },
          { name: "GST Summary", href: "/reports/gst-summary" },
          { name: "Cash Flow", href: "/reports/cash-flow" },
          { name: "Stock Valuation", href: "/reports/stock-valuation" },
          { name: "Party Statement", href: "/reports/party-statement" },
        ],
      },
      { name: "Reminders & WhatsApp", href: "/reminders" },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    subItems: [
      { name: "General", href: "/settings/general" },
      { name: "Company Profile", href: "/settings/company-profile" },
      { name: "Users & Roles", href: "/settings/users-roles" },
      { name: "Financial", href: "/settings/financial" },
      { name: "Inventory", href: "/settings/inventory" },
      { name: "Production", href: "/settings/production" },
      { name: "Notifications", href: "/settings/notifications" },
      { name: "Backup & Restore", href: "/settings/backup-restore" },
      { name: "Audit Logs", href: "/settings/audit-logs" },
      { name: "Communication", href: "/settings/communication" },
    ],
  },
];
