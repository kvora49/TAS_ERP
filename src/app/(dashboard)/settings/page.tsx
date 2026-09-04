"use client";

import {
  Settings,
  IndianRupee,
  Boxes,
  Scissors,
  Building2,
  Shield,
  Bell,
  MessageSquare,
  FileText,
  Upload,
  HardDrive,
  Database,
} from "lucide-react";
import { ModuleHubPage } from "@/components/shared/ModuleHubPage";

export default function SettingsPage() {
  return (
    <ModuleHubPage
      title="Settings"
      subtitle="Configure your business preferences and system options"
      sections={[
        {
          title: "Business Configuration",
          items: [
            { label: "General", href: "/settings/general", icon: Settings, accent: "text-indigo-500" },
            { label: "Financial", href: "/settings/financial", icon: IndianRupee, accent: "text-emerald-500" },
            { label: "Inventory", href: "/settings/inventory", icon: Boxes, accent: "text-amber-500" },
            { label: "Production", href: "/settings/production", icon: Scissors, accent: "text-purple-500" },
          ],
        },
        {
          title: "Organization",
          items: [
            { label: "Company Profile", href: "/settings/company-profile", icon: Building2, accent: "text-blue-500" },
            { label: "Companies", href: "/settings/companies", icon: Building2, accent: "text-cyan-500" },
            { label: "Users & Roles", href: "/settings/users-roles", icon: Shield, accent: "text-rose-500" },
          ],
        },
        {
          title: "Communication",
          items: [
            { label: "Communication", href: "/settings/communication", icon: MessageSquare, accent: "text-teal-500" },
            { label: "Notifications", href: "/settings/notifications", icon: Bell, accent: "text-orange-500" },
          ],
        },
        {
          title: "Tools & Data",
          items: [
            { label: "Bill Builder", href: "/settings/bill-builder", icon: FileText, accent: "text-indigo-500" },
            { label: "Import Data", href: "/settings/import", icon: Upload, accent: "text-green-500" },
            { label: "Backup & Restore", href: "/settings/backup-restore", icon: HardDrive, accent: "text-slate-500" },
            { label: "Audit Logs", href: "/settings/audit-logs", icon: Database, accent: "text-violet-500" },
          ],
        },
      ]}
    />
  );
}
