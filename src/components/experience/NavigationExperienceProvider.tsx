'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ExperienceProfile,
  ExperienceLevel,
  EXPERIENCE_PROFILES,
  DEFAULT_EXPERIENCE,
  buildCSSTokens,
} from './LoadingExperienceConfig';

interface ExperienceContextType {
  profile: ExperienceProfile;
  setMotionProfile: (level: ExperienceLevel) => void;
}

const ExperienceContext = createContext<ExperienceContextType>({
  profile: EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE],
  setMotionProfile: () => {},
});

export function NavigationExperienceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ExperienceProfile>(EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE]);
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  const setMotionProfile = (level: ExperienceLevel) => {
    if (EXPERIENCE_PROFILES[level]) {
      setProfileState(EXPERIENCE_PROFILES[level]);
      if (typeof document !== 'undefined') {
        document.cookie = `tas-motion-profile=${level}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  };

  useEffect(() => {
    // 1. Check cookies for zero-flash stored preference
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )tas-motion-profile=([^;]*)/);
      const savedLevel = match ? (match[1] as ExperienceLevel) : null;
      if (savedLevel && EXPERIENCE_PROFILES[savedLevel]) {
        setProfileState(EXPERIENCE_PROFILES[savedLevel]);
      }
    }

    // 2. Network adaptive check (forces ultraFast on slow connections)
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
        setProfileState(EXPERIENCE_PROFILES.ultraFast);
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
    <ExperienceContext.Provider value={{ profile, setMotionProfile }}>
      <div className={isNavigating ? 'route-navigating' : ''}>
        {children}
      </div>
    </ExperienceContext.Provider>
  );
}

export function useExperienceProfile(): ExperienceProfile {
  const context = useContext(ExperienceContext);
  return context.profile;
}

export function useExperienceController() {
  return useContext(ExperienceContext);
}
