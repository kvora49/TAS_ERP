'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useExperienceProfile } from './NavigationExperienceProvider';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useExperienceProfile();

  // Ultra-fast mode: skip all animation entirely for maximum throughput
  if (profile?.level === 'ultraFast') {
    return <>{children}</>;
  }

  const durationSec = (profile?.page || 200) / 1000;
  const useTranslations = profile?.useTranslations ?? true;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: useTranslations ? 6 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: useTranslations ? -6 : 0 }}
        transition={{
          duration: durationSec,
          ease: profile?.level === 'premium' ? [0.34, 1.56, 0.64, 1] : 'easeOut',
        }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
