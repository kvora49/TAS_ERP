"use client";

import {
  Tag,
  Palette,
  Warehouse,
  Shirt,
  Percent,
  Ruler,
  Scale,
  UserCheck,
  ClipboardList,
  Receipt,
  Package,
  Banknote,
  Barcode,
  Users,
} from "lucide-react";
import { ModuleHubPage } from "@/components/shared/ModuleHubPage";

export default function MasterDataPage() {
  return (
    <ModuleHubPage
      title="Master Data"
      subtitle="Configure core business data and setup"
      sections={[
        {
          title: "Product Setup",
          items: [
            { label: "Brands", href: "/master-data/brands", icon: Tag, accent: "text-indigo-500" },
            { label: "Designs", href: "/master-data/designs", icon: Palette, accent: "text-pink-500" },
            { label: "Garment Types", href: "/master-data/garment-types", icon: Shirt, accent: "text-violet-500" },
            { label: "Size Sets", href: "/master-data/size-sets", icon: Ruler, accent: "text-cyan-500" },
            { label: "Units", href: "/master-data/units", icon: Scale, accent: "text-teal-500" },
          ],
        },
        {
          title: "Warehousing & Materials",
          items: [
            { label: "Godowns", href: "/master-data/godowns", icon: Warehouse, accent: "text-amber-500" },
            { label: "Raw Materials", href: "/master-data/raw-materials", icon: Package, accent: "text-orange-500" },
            { label: "Barcode / QR", href: "/master-data/barcode-qr", icon: Barcode, accent: "text-slate-500" },
          ],
        },
        {
          title: "People & Finance",
          items: [
            { label: "Parties", href: "/master-data/parties", icon: Users, accent: "text-blue-500" },
            { label: "Workers", href: "/master-data/workers", icon: UserCheck, accent: "text-emerald-500" },
            { label: "Banks & UPI", href: "/master-data/banks-upi", icon: Banknote, accent: "text-green-500" },
            { label: "Expense Types", href: "/master-data/expense-types", icon: Receipt, accent: "text-rose-500" },
          ],
        },
        {
          title: "Production Setup",
          items: [
            { label: "GST Rates", href: "/master-data/gst-rates", icon: Percent, accent: "text-purple-500" },
            { label: "Prod. Stages", href: "/master-data/production-stages", icon: ClipboardList, accent: "text-indigo-500" },
          ],
        },
      ]}
    />
  );
}
