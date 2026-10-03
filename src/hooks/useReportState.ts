"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

const valid = (key: string, value: string) => {
  if (key === "from" || key === "to") {
    const parsed = new Date(`${value}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  if (key.endsWith("_id")) return value === "all" || /^[0-9a-f-]{36}$/i.test(value);
  return /^[a-zA-Z0-9_+ -]{1,60}$/.test(value);
};

/** URL-backed filters restore saved report links and browser back/forward navigation. */
export function useReportState<T extends string>(initial: T | (() => T), key: string, allowed?: readonly string[]): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const fallback = useRef(value);
  useEffect(() => {
    const restore = (initial = false) => {
      const candidate = new URLSearchParams(window.location.search).get(key);
      if (!candidate) { setValue(fallback.current); if (initial) { const url = new URL(window.location.href); url.searchParams.set(key, fallback.current); window.history.replaceState(window.history.state, "", url); } return; }
      if (candidate && valid(key, candidate) && (!allowed || allowed.includes(candidate))) setValue(candidate as T);
    };
    restore(true);
    const changed = () => restore();
    window.addEventListener("popstate", changed);
    window.addEventListener("report-url-change", changed);
    return () => { window.removeEventListener("popstate", changed); window.removeEventListener("report-url-change", changed); };
  // Allowed options are fixed for a page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update: Dispatch<SetStateAction<T>> = next => {
    // Resolve functional updates against the current value, outside React's updater.
    const result = typeof next === "function" ? next(value) : next;
    setValue(result);
    const url = new URL(window.location.href);
    url.searchParams.set(key, result);
    window.history.replaceState(window.history.state, "", url);
  };
  return [value, update];
}
