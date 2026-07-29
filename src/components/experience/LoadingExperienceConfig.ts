export type ExperienceLevel = 'ultraFast' | 'balanced' | 'premium';

export interface ExperienceProfile {
  level: ExperienceLevel;
  navigation: number;
  dialog: number;
  page: number;
  drawer: number;
  button: number;
  hover: number;
  shimmerSpeed: number;
  useTranslations: boolean;
  skeletonMinShowMs: number;
  animationSkipThresholdMs: number;
  // Extended motion parameters
  easing: string;
  staggerDelayMs: number;
  hoverScale: number;
  activeScale: number;
  entranceOffsetPx: number;
  entranceScaleFrom: number;
}

export const EXPERIENCE_PROFILES: Record<ExperienceLevel, ExperienceProfile> = {
  ultraFast: {
    level: 'ultraFast',
    navigation: 120,
    dialog: 100,
    page: 80,
    drawer: 100,
    button: 80,
    hover: 60,
    shimmerSpeed: 1200,
    useTranslations: false,
    skeletonMinShowMs: 0,
    animationSkipThresholdMs: 150,
    easing: 'linear',
    staggerDelayMs: 0,
    hoverScale: 1,
    activeScale: 1,
    entranceOffsetPx: 0,
    entranceScaleFrom: 1,
  },
  balanced: {
    level: 'balanced',
    navigation: 200,
    dialog: 180,
    page: 160,
    drawer: 200,
    button: 120,
    hover: 100,
    shimmerSpeed: 1600,
    useTranslations: true,
    skeletonMinShowMs: 100,
    animationSkipThresholdMs: 200,
    easing: 'ease-out',
    staggerDelayMs: 20,
    hoverScale: 1.01,
    activeScale: 0.99,
    entranceOffsetPx: 8,
    entranceScaleFrom: 0.99,
  },
  premium: {
    level: 'premium',
    navigation: 400,
    dialog: 400,
    page: 400,
    drawer: 400,
    button: 300,
    hover: 300,
    shimmerSpeed: 2500,
    useTranslations: true,
    skeletonMinShowMs: 150,
    animationSkipThresholdMs: 300,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    staggerDelayMs: 40,
    hoverScale: 1.02,
    activeScale: 0.97,
    entranceOffsetPx: 24,
    entranceScaleFrom: 0.98,
  },
};

export const DEFAULT_EXPERIENCE: ExperienceLevel = 'balanced';

export function buildCSSTokens(profile: ExperienceProfile): Record<string, string> {
  return {
    '--exp-nav-duration': `${profile.navigation}ms`,
    '--exp-dialog-duration': `${profile.dialog}ms`,
    '--exp-page-duration': `${profile.page}ms`,
    '--exp-drawer-duration': `${profile.drawer}ms`,
    '--exp-btn-duration': `${profile.button}ms`,
    '--exp-hover-duration': `${profile.hover}ms`,
    '--exp-shimmer-speed': `${profile.shimmerSpeed}ms`,
    '--exp-easing': profile.easing,
    '--exp-stagger': `${profile.staggerDelayMs}ms`,
    '--exp-hover-scale': `${profile.hoverScale}`,
    '--exp-active-scale': `${profile.activeScale}`,
    '--exp-entrance-offset': `${profile.entranceOffsetPx}px`,
    '--exp-entrance-scale': `${profile.entranceScaleFrom}`,
  };
}
