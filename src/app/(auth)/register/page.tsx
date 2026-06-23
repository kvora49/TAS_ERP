"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Mail,
  User,
  Building,
  Phone,
  Briefcase,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  Boxes,
  Receipt,
  Wallet,
  Users,
  BarChart2,
  CheckCircle,
  Sun,
  Moon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    businessName: z.string().min(2, "Business name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().optional(),
    industryType: z.string().min(1, "Select your industry type"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Terms and Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

const INDUSTRIES = [
  "Apparel & Garment Manufacturing",
  "Textile Processing",
  "Fashion Brand / Retail",
  "Apparel Sourcing / Buying Agency",
  "Wholesale Garments",
  "Other",
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Real-Time Production Tracking",
    desc: "Monitor cut-to-pack stages and lot progress on the go.",
  },
  {
    icon: Boxes,
    title: "Inventory & Stock Control",
    desc: "Manage raw fabrics, trims, and finished goods by godowns.",
  },
  {
    icon: Receipt,
    title: "Sales, Billing & Payments",
    desc: "Handle pakka/kacha bills, GST tiers, returns and credit notes.",
  },
  {
    icon: Wallet,
    title: "Finance & Expense Management",
    desc: "Audit job-work ledgers, salaries, and daily operational costs.",
  },
  {
    icon: Users,
    title: "Workforce & Productivity",
    desc: "Track worker assignments, rates, and individual piece production.",
  },
  {
    icon: BarChart2,
    title: "Reports & Business Insights",
    desc: "Analyze margins, P&L, balance sheets and GST summaries.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("auth-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("auth-theme", nextTheme);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agreeTerms: false,
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
          },
        },
      });

      if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error("Auth registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Call transactional endpoint to set up business and owner profiles
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          businessName: values.businessName,
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to set up workspace profiles");
        setLoading(false);
        return;
      }

      setIsWorkspaceLoading(true);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  if (isWorkspaceLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050B1A] text-white">
        <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#6366F1] flex items-center justify-center shadow-lg shadow-[#6366F1]/30 animate-pulse">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 11.51l3.17 3.17a1 1 0 001.42 0L20 8M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 16H3a1 1 0 01-1-1v-2.5a1 1 0 011-1h1M21 16h1a1 1 0 001-1v-2.5a1 1 0 00-1-1h-1M4 16h16M4 12V8a4 4 0 018 0v4M12 2v2"
                />
              </svg>
            </div>
            <span className="font-bold text-2xl tracking-wider">TAS ERP</span>
          </div>

          <div className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-white">Signing you in...</h2>
            <p className="text-sm text-[#94A3B8] animate-pulse">Loading your workspace...</p>
            <p className="text-xs text-[#64748B]">Please wait...</p>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F1F5F9]">
      {/* Left Panel - 45% Width */}
      <div
        className="hidden md:flex md:w-[45%] flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #050B1A 0%, #0A1430 50%, #111C45 100%)",
        }}
      >
        {/* Plain Premium Background (Grid Removed) */}

        {/* Top: Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-[#6366F1] flex items-center justify-center shadow-lg shadow-[#6366F1]/30">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 11.51l3.17 3.17a1 1 0 001.42 0L20 8M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 16H3a1 1 0 01-1-1v-2.5a1 1 0 011-1h1M21 16h1a1 1 0 001-1v-2.5a1 1 0 00-1-1h-1M4 16h16M4 12V8a4 4 0 018 0v4M12 2v2"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-lg tracking-wider">TAS ERP</span>
            <p className="text-xs text-[#94A3B8] font-medium leading-none mt-0.5">
              Garment Manufacturing Intelligence
            </p>
          </div>
        </div>

        {/* Middle: Hero and Illustration */}
        <div className="my-auto relative z-10 flex flex-col items-start w-full max-w-[95%]">
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Start Your Digital <br />
            Manufacturing <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F7CFF] to-[#7C5CFF]">
              Journey
            </span>
          </h1>
          <p className="text-sm lg:text-base text-[#94A3B8] mt-5 max-w-xl leading-relaxed">
            A complete ERP solution for Garment Manufacturing, Inventory
            Management, and Business Intelligence. Designed for modern garment
            enterprises.
          </p>

          {/* Feature List */}
          <div className="mt-6 flex flex-col gap-2.5 text-sm font-medium text-[#E2E8F0] select-none">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Setup in Minutes</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Multi-Factory Support</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Payroll Automation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Inventory Tracking</span>
            </div>
          </div>

          <div 
            className="mt-6 overflow-hidden border border-[#1E293B]/40 shadow-2xl relative group shrink-0 w-full"
            style={{
              height: "320px",
              borderRadius: "20px"
            }}
          >
            <img
              src="/garment_workspace.png"
              alt="TAS ERP Garment Studio"
              className="transform group-hover:scale-105 transition-transform duration-500 w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: "center"
              }}
            />
          </div>
        </div>

        {/* Bottom: Footer */}
        <div className="text-xs text-[#94A3B8] flex items-center justify-between relative z-10 border-t border-[#1E293B] pt-4">
          <span>&copy; 2026 TAS ERP. All rights reserved.</span>
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-[#6366F1]" /> Enterprise Grade
          </span>
        </div>
      </div>

      {/* Right Panel - 55% Width */}
      <div className={cn(
        "flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto relative transition-colors duration-300",
        theme === "dark" ? "bg-[#0B0F19]" : "bg-[#F8FAFC]"
      )}>
        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "absolute top-6 right-6 w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-all duration-200 z-20",
            theme === "dark"
              ? "bg-[#111827] border-[#1F2937] text-yellow-400 hover:bg-[#1F2937]"
              : "bg-white border-[#E5E7EB] text-gray-500 hover:bg-slate-50"
          )}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div 
          className={cn(
            "shadow-xl border transition-all duration-300",
            theme === "dark"
              ? "bg-[#111827] border-[#1F2937] text-white"
              : "bg-white border-[#E5E7EB] text-[#0F172A]"
          )}
          style={{
            width: "600px",
            maxWidth: "600px",
            minWidth: "600px",
            padding: "48px",
            borderRadius: "24px"
          }}
        >
          {/* User Icon */}
          <div className="flex justify-center mb-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-inner",
              theme === "dark" ? "bg-[#1E1B4B]/50" : "bg-[#EEF2FF]"
            )}>
              <svg
                className="w-5 h-5 text-[#6366F1]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
          </div>

          <h2 className={cn(
            "text-2xl font-bold text-center tracking-tight",
            theme === "dark" ? "text-white" : "text-[#0F172A]"
          )}>
            Create Your Account
          </h2>
          <p className={cn(
            "text-sm text-center mt-1 mb-8",
            theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
          )}>
            Join TAS ERP and grow your business smarter
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Full Name *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <User className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("fullName")}
                    disabled={loading}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Business Name */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Business Name *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Building className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="text"
                    placeholder="Acme Garments Ltd"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("businessName")}
                    disabled={loading}
                  />
                </div>
                {errors.businessName && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.businessName.message}
                  </p>
                )}
              </div>

              {/* Email (Full Width in Grid span-2) */}
              <div className="space-y-1 sm:col-span-2">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Email Address *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Mail className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("email")}
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Phone Number
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Phone className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("phone")}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Industry Type */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Industry Type *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Briefcase className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <select
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all appearance-none cursor-pointer",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("industryType")}
                    disabled={loading}
                  >
                    <option value="">Select Industry Type</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.industryType && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.industryType.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Password *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Lock className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("password")}
                    disabled={loading}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  Confirm Password *
                </label>
                <div className="relative">
                  <InputIconWrapper>
                    <Lock className="h-4 w-4 text-[#94A3B8]" />
                  </InputIconWrapper>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                      theme === "dark"
                        ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                        : "bg-white border-[#D1D5DB] text-[#0F172A]"
                    )}
                    {...register("confirmPassword")}
                    disabled={loading}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* Security Badge */}
            <div className={cn(
              "border rounded-xl p-3 flex items-start gap-3 mt-4",
              theme === "dark"
                ? "bg-[#1E1B4B]/30 border-[#312E81]/50 text-[#E2E8F0]"
                : "bg-[#EFF6FF] border-[#DBEAFE] text-[#1E293B]"
            )}>
              <svg
                className="w-5 h-5 text-[#6366F1] shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <div>
                <h4 className={cn(
                  "text-xs font-bold",
                  theme === "dark" ? "text-white" : "text-[#1E293B]"
                )}>
                  Your data is 100% secure
                </h4>
                <p className={cn(
                  "text-[11px] mt-0.5 leading-relaxed",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}>
                  We use industry-standard SSL encryption and multi-tenant row-level
                  security to guarantee the absolute confidentiality of your data.
                </p>
              </div>
            </div>

            {/* Terms and conditions checkbox */}
            <div className="flex items-start mt-2">
              <input
                id="agreeTerms"
                type="checkbox"
                className={cn(
                  "h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer mt-0.5",
                  theme === "dark" ? "bg-[#0F1729] border-[#334155]" : ""
                )}
                {...register("agreeTerms")}
                disabled={loading}
              />
              <label
                htmlFor="agreeTerms"
                className={cn(
                  "ml-2 block text-xs select-none cursor-pointer",
                  theme === "dark" ? "text-[#E2E8F0]" : "text-[#374151]"
                )}
              >
                I agree to the{" "}
                <Link href="#" className={cn("hover:underline font-semibold", theme === "dark" ? "text-[#818CF8]" : "text-[#6366F1]")}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className={cn("hover:underline font-semibold", theme === "dark" ? "text-[#818CF8]" : "text-[#6366F1]")}>
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-xs font-semibold text-[#DC2626]">
                {errors.agreeTerms.message}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-lg shadow-lg shadow-[#6366F1]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className={cn(
            "text-center text-xs mt-6",
            theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
          )}>
            Already have an account?{" "}
            <Link
              href="/login"
              className={cn(
                "font-semibold hover:underline",
                theme === "dark" ? "text-[#818CF8] hover:text-[#A5B4FC]" : "text-[#6366F1]"
              )}
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputIconWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
      {children}
    </div>
  );
}
