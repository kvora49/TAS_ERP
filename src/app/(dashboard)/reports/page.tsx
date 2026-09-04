"use client";

import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  Boxes,
  CreditCard,
  Scissors,
  Users,
  BookOpen,
  Scale,
  Wallet,
  Percent,
  IndianRupee,
  PieChart,
} from "lucide-react";
import { ModuleHubPage } from "@/components/shared/ModuleHubPage";

export default function ReportsPage() {
  return (
    <ModuleHubPage
      title="Reports"
      subtitle="Business intelligence and financial analytics"
      sections={[
        {
          title: "Financial Statements",
          items: [
            { label: "Financial", href: "/reports/financial", icon: TrendingUp, accent: "text-indigo-500" },
            { label: "Profit & Loss", href: "/reports/profit-loss", icon: TrendingUp, accent: "text-emerald-500" },
            { label: "Balance Sheet", href: "/reports/balance-sheet", icon: Scale, accent: "text-blue-500" },
            { label: "Cash Flow", href: "/reports/cash-flow", icon: Wallet, accent: "text-cyan-500" },
            { label: "GST Summary", href: "/reports/gst-summary", icon: Percent, accent: "text-purple-500" },
          ],
        },
        {
          title: "Operations",
          items: [
            { label: "Sales", href: "/reports/sales", icon: ShoppingBag, accent: "text-pink-500" },
            { label: "Purchases", href: "/reports/purchases", icon: Receipt, accent: "text-orange-500" },
            { label: "Inventory", href: "/reports/inventory", icon: Boxes, accent: "text-amber-500" },
            { label: "Stock Valuation", href: "/reports/stock-valuation", icon: IndianRupee, accent: "text-green-500" },
            { label: "Production", href: "/reports/production", icon: Scissors, accent: "text-violet-500" },
          ],
        },
        {
          title: "Parties & Payments",
          items: [
            { label: "Party Reports", href: "/reports/party-reports", icon: Users, accent: "text-blue-500" },
            { label: "Party Ledger", href: "/reports/party-statement", icon: BookOpen, accent: "text-teal-500" },
            { label: "Payments", href: "/reports/payments", icon: CreditCard, accent: "text-rose-500" },
          ],
        },
        {
          title: "Analysis",
          items: [
            { label: "Executive Analysis", href: "/reports/analysis", icon: PieChart, accent: "text-indigo-500" },
          ],
        },
      ]}
    />
  );
}
