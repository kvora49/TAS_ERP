"use client";

import React from "react";
import { Lightbulb } from "lucide-react";

interface InsightsCardProps {
  insights: string[];
}

export default function InsightsCard({ insights }: InsightsCardProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-[var(--shadow-sm)] flex gap-4">
      <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
        <Lightbulb className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-amber-900 mb-2">Key Insights & Observations</h3>
        <ul className="list-disc pl-4 space-y-1.5 text-xs text-amber-800 leading-relaxed font-medium">
          {insights.map((insight, index) => (
            <li key={index}>{insight}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
