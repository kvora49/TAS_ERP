"use client";

import React from "react";
import { Toaster } from "sonner";
import { useExperienceProfile } from "./NavigationExperienceProvider";

export function ToasterWrapper() {
  const profile = useExperienceProfile();
  const isPremium = profile?.level === "premium";

  return (
    <Toaster
      richColors
      position="top-right"
      toastOptions={{
        className: isPremium ? "ease-premium transition-all duration-300" : "",
        style: {
          background: "var(--card-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}
