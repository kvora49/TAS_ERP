'use client';

import React from 'react';
import { useExperienceProfile } from './NavigationExperienceProvider';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const profile = useExperienceProfile();

  if (profile?.level === 'ultraFast') {
    return <>{children}</>;
  }

  return (
    <div className="animate-fadeIn transition-all duration-150">
      {children}
    </div>
  );
}
