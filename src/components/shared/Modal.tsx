"use client";

import React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useExperienceProfile } from "@/components/experience/NavigationExperienceProvider";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-lg', 'max-w-2xl'
  showClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
  showClose = true,
}: ModalProps) {
  const profile = useExperienceProfile();
  const isUltraFast = profile?.level === "ultraFast";
  const isPremium = profile?.level === "premium";

  const animationClass = isUltraFast
    ? ""
    : isPremium
    ? "premium-reveal"
    : "animate-fadeIn";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 transition-opacity duration-200 animate-fadeIn"
          style={{
            backgroundColor: "var(--modal-backdrop)",
            backdropFilter: "blur(4px)",
          }}
        />

        {/* Centered Viewport Wrapper */}
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
          {/* Content Box */}
          <DialogPrimitive.Popup
            className={`pointer-events-auto w-full ${maxWidth} max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-t sm:border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-[var(--text-primary)] shadow-[var(--modal-shadow)] outline-none ${animationClass}`}
          >
            {/* Mobile Drag Handle Bar */}
            <div className="w-12 h-1 bg-[var(--border)] rounded-full mx-auto mb-3 sm:hidden shrink-0" />
            {(title || description || showClose) && (
              <div className="flex items-start justify-between gap-4 pb-4">
                <div>
                  {title && (
                    <DialogPrimitive.Title className="text-lg font-bold text-[var(--text-primary)]">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>

                {showClose && (
                  <DialogPrimitive.Close className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)] transition-colors focus:outline-none cursor-pointer">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                )}
              </div>
            )}

            <div>{children}</div>
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
