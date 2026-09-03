"use client";

import React, { useState } from "react";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  bgClass: string; // e.g. "bg-red-600 text-white" or "bg-[var(--primary)] text-white"
  onAction: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction; // Revealed when swiping right ->
  rightAction?: SwipeAction; // Revealed when swiping left <-
  threshold?: number; // Distance in px to trigger action (default: 80)
  className?: string;
}

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  className = "",
}: SwipeableRowProps) {
  const controls = useAnimation();
  const [hasVibrated, setHasVibrated] = useState(false);

  const handleDrag = (_: any, info: PanInfo) => {
    const isPastThreshold = Math.abs(info.offset.x) >= threshold;
    if (isPastThreshold && !hasVibrated) {
      triggerHaptic("impactMedium");
      setHasVibrated(true);
    } else if (!isPastThreshold && hasVibrated) {
      setHasVibrated(false);
    }
  };

  const handleDragEnd = async (_: any, info: PanInfo) => {
    setHasVibrated(false);

    if (info.offset.x <= -threshold && rightAction) {
      // Swiped Left past threshold -> trigger right action
      triggerHaptic("impactHeavy");
      rightAction.onAction();
      await controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    } else if (info.offset.x >= threshold && leftAction) {
      // Swiped Right past threshold -> trigger left action
      triggerHaptic("impactHeavy");
      leftAction.onAction();
      await controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    } else {
      // Spring back
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 35 } });
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background Left Action (revealed on right swipe) */}
      {leftAction && (
        <div
          onClick={() => {
            triggerHaptic("impactLight");
            leftAction.onAction();
          }}
          className={`absolute inset-y-0 left-0 w-24 flex items-center justify-center gap-1.5 px-3 cursor-pointer select-none font-bold text-xs ${leftAction.bgClass}`}
        >
          {leftAction.icon}
          <span>{leftAction.label}</span>
        </div>
      )}

      {/* Background Right Action (revealed on left swipe) */}
      {rightAction && (
        <div
          onClick={() => {
            triggerHaptic("impactLight");
            rightAction.onAction();
          }}
          className={`absolute inset-y-0 right-0 w-24 flex items-center justify-center gap-1.5 px-3 cursor-pointer select-none font-bold text-xs ${rightAction.bgClass}`}
        >
          {rightAction.icon}
          <span>{rightAction.label}</span>
        </div>
      )}

      {/* Foreground Swipeable Content */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{
          left: rightAction ? -threshold - 20 : 0,
          right: leftAction ? threshold + 20 : 0,
        }}
        dragElastic={0.15}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 bg-[var(--card-bg)] w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
