"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Eye, EyeOff, ShieldCheck, Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("auth-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (error || errorCode || errorDescription) {
      let msg = "An authentication error occurred.";
      if (errorCode === "otp_expired" || (errorDescription && errorDescription.toLowerCase().includes("expired"))) {
        msg = "The password recovery link has expired or has already been used. Please request a new link.";
      } else if (errorDescription) {
        msg = errorDescription;
      }
      toast.error(msg, { duration: 6000 });
    }
  }, [searchParams]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("auth-theme", nextTheme);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
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
            Manage Your <br />
            Garment Business <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F7CFF] to-[#7C5CFF]">
              Smarter
            </span>
          </h1>
          <p className="text-sm lg:text-base text-[#94A3B8] mt-5 max-w-xl leading-relaxed">
            Manage production, inventory, financial accounting, and operational workflows from a single platform built for modern garment manufacturers.
          </p>

          {/* Feature List */}
          <div className="mt-6 flex flex-col gap-2.5 text-sm font-medium text-[#E2E8F0] select-none">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Production Management</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Inventory Control</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Financial Accounting</span>
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
        "flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative transition-colors duration-300",
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
          {/* Lock Badge */}
          <div className="flex justify-center mb-6">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-inner",
              theme === "dark" ? "bg-[#1E1B4B]/50" : "bg-[#EEF2FF]"
            )}>
              <Lock className="h-5 w-5 text-[#6366F1]" />
            </div>
          </div>

          <h2 className={cn(
            "text-2xl font-bold text-center tracking-tight",
            theme === "dark" ? "text-white" : "text-[#0F172A]"
          )}>
            Welcome Back
          </h2>
          <p className={cn(
            "text-sm text-center mt-1.5 mb-8",
            theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
          )}>
            Sign in to access TAS ERP
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                )}
              >
                Email Address
              </label>
              <div className="relative">
                <InputIconWrapper>
                  <Mail className="h-4 w-4 text-[#94A3B8]" />
                </InputIconWrapper>
                <input
                  id="email"
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
                <p className="text-xs font-medium text-[#DC2626] mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                  )}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className={cn(
                    "text-xs font-semibold hover:underline",
                    theme === "dark" ? "text-[#818CF8] hover:text-[#A5B4FC]" : "text-[#6366F1]"
                  )}
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <InputIconWrapper>
                  <Lock className="h-4 w-4 text-[#94A3B8]" />
                </InputIconWrapper>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "w-full h-11 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                    theme === "dark"
                      ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                      : "bg-white border-[#D1D5DB] text-[#0F172A]"
                  )}
                  {...register("password")}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-[#DC2626] mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                className={cn(
                  "h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer",
                  theme === "dark" ? "bg-[#0F1729] border-[#334155]" : ""
                )}
                {...register("rememberMe")}
                disabled={loading}
              />
              <label
                htmlFor="rememberMe"
                className={cn(
                  "ml-2 block text-xs font-medium select-none cursor-pointer",
                  theme === "dark" ? "text-[#E2E8F0]" : "text-[#374151]"
                )}
              >
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-lg shadow-lg shadow-[#6366F1]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className={cn(
            "text-center text-xs mt-8",
            theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
          )}>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className={cn(
                "font-semibold hover:underline",
                theme === "dark" ? "text-[#818CF8] hover:text-[#A5B4FC]" : "text-[#6366F1]"
              )}
            >
              Create Account
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
