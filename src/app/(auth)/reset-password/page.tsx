"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff, ShieldCheck, ShieldAlert, Sun, Moon, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [verifying, setVerifying] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("auth-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    async function exchangeCode() {
      if (!code) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setErrorMsg("No active recovery session found. Please request a new recovery link.");
        }
        setVerifying(false);
        return;
      }

      const supabase = createClient();
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Exchange error:", error);
          setErrorMsg(
            error.message.includes("expired") || error.message === "Hash mismatch"
              ? "The password reset link is invalid or has expired. Please request a new one."
              : error.message
          );
        }
      } catch (err: any) {
        setErrorMsg("Failed to verify recovery session. Please try again.");
      } finally {
        setVerifying(false);
      }
    }

    exchangeCode();
  }, [code]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("auth-theme", nextTheme);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully! Please sign in with your new password.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F1F5F9]">
      {/* Left Panel - 45% Width */}
      <div
        className="hidden md:flex md:w-[45%] flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #050B1A 0%, #0A1430 50%, #111C45 100%)",
        }}
      >
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
            Almost There
          </h1>
          <p className="text-sm lg:text-base text-[#94A3B8] mt-4 max-w-xl leading-relaxed">
            Create a strong password to protect your organization.
          </p>

          {/* Feature List */}
          <div className="mt-6 flex flex-col gap-2.5 text-sm font-medium text-[#E2E8F0] select-none">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Encrypted Passwords</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Secure Recovery Links</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center text-[#6366F1] font-bold text-xs shrink-0 border border-[#312E81]/30">✓</span>
              <span>Session Protection</span>
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
              src="/security_shield.png"
              alt="TAS ERP Reset Password"
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
          }}>
          {verifying ? (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#6366F1]" />
              <p className={cn(
                "text-sm font-medium",
                theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
              )}>
                Verifying recovery session...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  theme === "dark" ? "bg-red-500/20" : "bg-red-100"
                )}>
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">Verification Failed</h2>
              <p className={cn(
                "text-sm leading-relaxed",
                theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
              )}>
                {errorMsg}
              </p>
              <div className="pt-4 flex flex-col gap-3">
                <Link
                  href="/forgot-password"
                  className="w-full h-10 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-lg flex items-center justify-center transition-all"
                >
                  Request New Link
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    "inline-flex items-center justify-center text-sm font-semibold hover:underline gap-1.5",
                    theme === "dark" ? "text-[#818CF8] hover:text-[#A5B4FC]" : "text-[#6366F1]"
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Lock Icon */}
              <div className="flex justify-center mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-inner",
                  theme === "dark" ? "bg-[#1E1B4B]/50" : "bg-[#EEF2FF]"
                )}>
                  <Lock className="h-5 w-5 text-[#6366F1]" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center tracking-tight">
                Create New Password
              </h2>
              <p className={cn(
                "text-sm text-center mt-1.5 mb-8",
                theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
              )}>
                Please set a strong password for your account
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                    )}
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-[#94A3B8]" />
                    </div>
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

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      theme === "dark" ? "text-[#94A3B8]" : "text-[#64748B]"
                    )}
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-[#94A3B8]" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={cn(
                        "w-full h-11 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all",
                        theme === "dark"
                          ? "bg-[#0F1729] border-[#334155] text-white focus:ring-[#6366F1]"
                          : "bg-white border-[#D1D5DB] text-[#0F172A]"
                      )}
                      {...register("confirmPassword")}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs font-medium text-[#DC2626] mt-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
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
                      Updating Password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>

              {/* Footer note */}
              <div className="text-center pt-4">
                <Link
                  href="/login"
                  className={cn(
                    "inline-flex items-center text-xs font-semibold hover:underline gap-1.5",
                    theme === "dark" ? "text-[#818CF8] hover:text-[#A5B4FC]" : "text-[#6366F1]"
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
