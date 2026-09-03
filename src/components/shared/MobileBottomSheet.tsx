"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface MobileBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  showClose?: boolean;
  maxHeight?: string; // default max-h-[88dvh]
}

export function MobileBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  showClose = true,
  maxHeight = "max-h-[88dvh]",
}: MobileBottomSheetProps) {
  // Trigger light haptic when opening
  useEffect(() => {
    if (open) {
      triggerHaptic("selection");
      // Prevent background scrolling when sheet is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle drag dismiss
  const handleDragEnd = (_: any, info: PanInfo) => {
    // If swiped down fast enough or pulled down past threshold, close sheet
    if (info.velocity.y > 350 || info.offset.y > 100) {
      triggerHaptic("impactLight");
      onOpenChange(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => {
              triggerHaptic("selection");
              onOpenChange(false);
            }}
            className="fixed inset-0 bg-[var(--modal-backdrop)] backdrop-blur-xs cursor-pointer"
          />

          {/* Swipeable Sheet Container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 w-full max-w-lg ${maxHeight} rounded-t-3xl border-t border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] shadow-2xl flex flex-col pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] overflow-hidden`}
          >
            {/* Grab Handle Header Bar */}
            <div className="pt-3 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 touch-none">
              <div className="w-12 h-1.5 rounded-full bg-[var(--border)] transition-colors hover:bg-[var(--text-muted)]" />
            </div>

            {/* Title / Description Row */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-5 pb-3 border-b border-[var(--border-light)] shrink-0">
                <div className="min-w-0 flex-1 pr-2">
                  {title && (
                    <div className="text-base font-bold text-[var(--text-primary)] truncate">
                      {title}
                    </div>
                  )}
                  {description && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                      {description}
                    </p>
                  )}
                </div>

                {showClose && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      onOpenChange(false);
                    }}
                    className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                  >
                    <X size={15} />
                    <span className="sr-only">Close</span>
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
