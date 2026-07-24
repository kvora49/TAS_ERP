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
  },
  premium: {
    level: 'premium',
    navigation: 300,
    dialog: 250,
    page: 240,
    drawer: 280,
    button: 160,
    hover: 120,
    shimmerSpeed: 2000,
    useTranslations: true,
    skeletonMinShowMs: 150,
    animationSkipThresholdMs: 300,
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
  };
}
