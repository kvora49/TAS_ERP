"use client";

import { useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Switch } from "@/components/ui/switch";
import {
  Link2,
  Mail,
  MessageSquare,
  Cloud,
  CreditCard,
  CheckCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Connector {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "connected" | "not_connected";
  icon: any;
  iconBg: string;
  iconColor: string;
}

export default function IntegrationsSettingsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([
    {
      id: "cloudflare_r2",
      name: "Cloudflare R2 Storage",
      category: "Storage",
      description: "Direct connection to secure object storage for automated database backups.",
      status: "connected",
      icon: Cloud,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
    },
    {
      id: "sendgrid",
      name: "SendGrid SMTP",
      category: "Email",
      description: "Email API delivery service for transactional invoices and notification digests.",
      status: "connected",
      icon: Mail,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      id: "twilio_sms",
      name: "Twilio SMS",
      category: "SMS",
      description: "SMS delivery service for payment reminders and critical stock warnings.",
      status: "not_connected",
      icon: MessageSquare,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business API",
      category: "Chat",
      description: "Send automated updates and job orders directly to workers and customers via chat.",
      status: "not_connected",
      icon: MessageSquare,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      id: "stripe",
      name: "Stripe",
      category: "Payments",
      description: "Enable online credit card transactions and automated invoice settlements.",
      status: "not_connected",
      icon: CreditCard,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
    },
    {
      id: "razorpay",
      name: "Razorpay",
      category: "Payments",
      description: "Process payments via credit cards, net banking, UPI, and wallets in India.",
      status: "not_connected",
      icon: CreditCard,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
  ]);

  const handleToggle = (id: string, checked: boolean) => {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newStatus = checked ? ("connected" as const) : ("not_connected" as const);
          toast.success(checked ? `${c.name} connected successfully` : `${c.name} disconnected`);
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Integrations"
        title="Settings > Integrations"
        subtitle="Manage APIs and third-party integrations"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connectors.map((c) => {
          const IconComp = c.icon;
          const isConnected = c.status === "connected";

          return (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between hover:shadow-md transition-shadow select-none text-left"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
                    <IconComp className={`size-5 ${c.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        isConnected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isConnected ? "Active" : "Disabled"}
                    </span>
                    <Switch
                      checked={isConnected}
                      onCheckedChange={(checked) => handleToggle(c.id, checked)}
                      size="sm"
                      className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] leading-tight mb-1">
                    {c.name}
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-[#6366F1] tracking-wide block mb-2">
                    {c.category}
                  </span>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-[#F3F4F6] mt-4 pt-3 flex justify-between items-center text-xs">
                <span className="text-slate-400">API Connector v1.0</span>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info(`Documentation for ${c.name} coming soon`);
                  }}
                  className="text-[#6366F1] hover:underline font-semibold flex items-center gap-1"
                >
                  Configure docs <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <InfoBanner
        variant="info"
        text="All API integration connectors run client-to-server TLS encryption keys. Keys are stored securely in Supabase vault storage."
      />
    </div>
  );
}
