"use client";

import React, { useState, useRef } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<any>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 70,
  className = "",
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [passedThreshold, setPassedThreshold] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0 && window.scrollY <= 0) {
      // Apply quadratic dampening
      const distance = Math.min(diff * 0.45, threshold * 1.5);
      setPullDistance(distance);

      if (distance >= threshold && !passedThreshold) {
        triggerHaptic("impactMedium");
        setPassedThreshold(true);
      } else if (distance < threshold && passedThreshold) {
        setPassedThreshold(false);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.8);
      triggerHaptic("success");

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setPassedThreshold(false);
      }
    } else {
      setPullDistance(0);
      setPassedThreshold(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative ${className}`}
    >
      {/* Pull Indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-12 z-30 flex items-center justify-center transition-transform pointer-events-none"
        style={{
          transform: `translate(-50%, ${pullDistance}px)`,
          opacity: pullDistance > 10 ? Math.min(pullDistance / threshold, 1) : 0,
        }}
      >
        <div className="w-10 h-10 rounded-full bg-[var(--card-bg)] border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--primary)]">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowDown
              className="h-5 w-5 transition-transform"
              style={{ transform: `rotate(${passedThreshold ? 180 : 0}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 ? pullDistance * 0.6 : 0}px)`,
          transition: isPullingRef.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
