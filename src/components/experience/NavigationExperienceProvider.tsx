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
    try {
      const targetProfile = EXPERIENCE_PROFILES[level] || EXPERIENCE_PROFILES.balanced;
      React.startTransition(() => {
        setProfileState(targetProfile);
      });
      if (typeof document !== 'undefined') {
        document.cookie = `tas-motion-profile=${targetProfile.level}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch (err) {
      console.error("Failed to update motion profile:", err);
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
    try {
      const currentProfile = profile || EXPERIENCE_PROFILES.balanced;
      const tokens = buildCSSTokens(currentProfile);
      const root = document.documentElement;
      if (root) {
        Object.entries(tokens).forEach(([key, val]) => {
          root.style.setProperty(key, val);
        });
      }
    } catch (err) {
      console.error("Failed to apply CSS tokens for motion profile:", err);
    }
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
