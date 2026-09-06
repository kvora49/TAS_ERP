"use client";

import { useEffect, useRef } from "react";

export interface UseInfiniteScrollOptions {
  /**
   * Callback invoked whenever the sentinel intersects the viewport.
   */
  onIntersect: () => void;
  /**
   * Whether observer is actively listening (e.g. false when hasNextPage is false or isLoading is true).
   */
  enabled?: boolean;
  /**
   * Distance ahead of viewport before prefetching next page (defaults to 250px).
   */
  rootMargin?: string;
  /**
   * Intersection threshold (0.0 to 1.0).
   */
  threshold?: number | number[];
}

/**
 * Lightweight IntersectionObserver hook for high-volume mobile infinite scroll
 * without heavy DOM footprint or layout shifts.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  onIntersect,
  enabled = true,
  rootMargin = "250px",
  threshold = 0.1,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<T | null>(null);

  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;

    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        root: null,
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, rootMargin, threshold]);

  return { sentinelRef };
}
