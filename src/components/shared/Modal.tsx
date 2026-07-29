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
  const isPremium = profile?.level === "premium";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 transition-opacity duration-200"
          style={{
            backgroundColor: "var(--modal-backdrop)",
            backdropFilter: "blur(4px)",
          }}
        />

        {/* Content Box */}
        <DialogPrimitive.Popup
          className={`fixed left-[50%] top-[50%] z-50 w-full ${maxWidth} translate-x-[-50%] translate-y-[-50%] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 text-[var(--text-primary)] shadow-[var(--modal-shadow)] outline-none transition-all ${
            isPremium ? "premium-reveal" : "animate-fadeIn"
          }`}
        >
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
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
