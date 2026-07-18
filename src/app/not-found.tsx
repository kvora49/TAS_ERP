"use client";

import React from "react";
import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E2E8F0] p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center mx-auto shadow-lg shadow-[#3B82F6]/10">
          <HelpCircle size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Page Not Found</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The workspace panel or resource you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button className="w-full flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white">
              <ArrowLeft size={16} />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
