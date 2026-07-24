'use client';

import React from 'react';

export type SkeletonVariant = 'card' | 'table' | 'chart' | 'form' | 'stats' | 'list';
export type SkeletonDensity = 'compact' | 'comfortable' | 'spacious';

interface SkeletonProps {
  variant: SkeletonVariant;
  density?: SkeletonDensity;
  count?: number;
  rows?: number;
  columns?: number;
  chartHeight?: number;
  className?: string;
}

export function Skeleton({
  variant,
  density = 'comfortable',
  count = 5,
  rows = 8,
  columns = 6,
  chartHeight = 200,
  className = '',
}: SkeletonProps) {
  const gap = density === 'compact' ? 'gap-2' : density === 'spacious' ? 'gap-6' : 'gap-4';
  const rowH = density === 'compact' ? 'h-12' : density === 'spacious' ? 'h-20' : 'h-16';

  if (variant === 'stats') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-${count} ${gap} ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-7 animate-shimmer rounded w-20" />
                <div className="h-3 animate-shimmer rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] overflow-hidden ${className}`}>
        <div className="bg-[#F9FAFB] h-11 flex items-center gap-4 px-6 border-b border-[#E5E7EB]">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-3 animate-shimmer rounded flex-1" style={{ maxWidth: i === 0 ? '40px' : undefined }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${rowH} flex items-center gap-4 px-6 border-b border-[#E5E7EB] last:border-0`}>
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                className="h-3 animate-shimmer rounded flex-1"
                style={{ maxWidth: j === 0 ? '40px' : j === columns - 1 ? '80px' : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-5 ${className}`}>
        <div className="h-4 animate-shimmer rounded w-32 mb-4" />
        <div className="animate-shimmer rounded-lg" style={{ height: chartHeight }} />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4 ${className}`}>
        <div className="h-5 animate-shimmer rounded w-40" />
        <div className="space-y-3">
          {Array.from({ length: count || 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-6 ${className}`}>
        <div className="h-5 animate-shimmer rounded w-32 mb-6" />
        <div className={`grid grid-cols-1 md:grid-cols-4 ${gap} mb-4`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 animate-shimmer rounded w-20" />
              <div className="h-10 animate-shimmer rounded-lg" />
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-4 ${gap}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 animate-shimmer rounded w-16" />
              <div className="h-10 animate-shimmer rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg animate-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 animate-shimmer rounded w-48" />
              <div className="h-3 animate-shimmer rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
