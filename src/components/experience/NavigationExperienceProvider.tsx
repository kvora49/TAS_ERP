'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ExperienceProfile,
  EXPERIENCE_PROFILES,
  DEFAULT_EXPERIENCE,
  buildCSSTokens,
} from './LoadingExperienceConfig';

const ExperienceContext = createContext<ExperienceProfile>(EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE]);

export function NavigationExperienceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ExperienceProfile>(EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE]);
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Network adaptive check synchronously
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
        setProfile(EXPERIENCE_PROFILES.ultraFast);
      }
    }
  }, []);

  useEffect(() => {
    const tokens = buildCSSTokens(profile);
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, [profile]);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <ExperienceContext.Provider value={profile}>
      <div className={isNavigating ? 'route-navigating' : ''}>
        {children}
      </div>
    </ExperienceContext.Provider>
  );
}

export function useExperienceProfile() {
  return useContext(ExperienceContext);
}
