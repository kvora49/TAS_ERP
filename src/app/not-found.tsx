"use client";

import React from "react";
import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-8 shadow-[var(--shadow-md)] text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mx-auto shadow-lg shadow-[var(--primary)]/10">
          <HelpCircle size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Page Not Found</h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            The workspace panel or resource you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-sm h-10 rounded-xl transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
