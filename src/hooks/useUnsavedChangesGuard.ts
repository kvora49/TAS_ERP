"use client";

import { useEffect, useCallback } from "react";

interface UnsavedChangesGuardOptions {
  message?: string;
  enabled?: boolean;
}

/**
 * Hook to guard against losing unsaved form changes on page refresh, tab close, or internal link navigation.
 *
 * @param isDirty boolean indicating if the form or page currently has unsaved modifications
 * @param options optional custom message or conditional enabled toggle
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  options: UnsavedChangesGuardOptions = {}
) {
  const {
    message = "You have unsaved changes. Are you sure you want to leave this page?",
    enabled = true,
  } = options;

  const shouldGuard = enabled && isDirty;

  // 1. Guard browser refresh, tab close, or URL entry
  useEffect(() => {
    if (!shouldGuard) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome, Safari, and standard modern browsers
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldGuard, message]);

  // 2. Guard in-app link clicks (Next.js client-side navigation)
  useEffect(() => {
    if (!shouldGuard) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      // Ignore links opened in new tabs / with modifier keys
      if (target.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        return;
      }

      // Determine if destination is different from current location
      try {
        const targetUrl = new URL(target.href, window.location.origin);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.origin === currentUrl.origin &&
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          // Same page, ignore
          return;
        }

        // Prevent immediate navigation
        e.preventDefault();
        e.stopPropagation();

        const confirmed = window.confirm(message);
        if (confirmed) {
          window.location.href = target.href;
        }
      } catch (_err) {
        // Fallback: proceed if URL parsing fails
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [shouldGuard, message]);

  const confirmDiscard = useCallback(
    (onProceed: () => void) => {
      if (!shouldGuard) {
        onProceed();
        return;
      }
      if (window.confirm(message)) {
        onProceed();
      }
    },
    [shouldGuard, message]
  );

  return { isDirty, confirmDiscard };
}
