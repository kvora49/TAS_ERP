# TAS ERP — Global Experience Framework
**V4 Final | Applies to all phases | Zero performance cost**

> ⚠️ AGENT INSTRUCTION: This framework is purely additive. It wraps existing components — it does not replace, refactor, or block them. Every business module continues to work identically. The framework only adds perceived responsiveness, skeleton states, and micro-animations. No business logic lives here.

---

## Table of Contents
1. [Core Principle — Zero Cost UX](#1-core-principle--zero-cost-ux)
2. [Directory Structure](#2-directory-structure)
3. [Experience Configuration](#3-experience-configuration)
4. [CSS Additions](#4-css-additions)
5. [Component Specifications](#5-component-specifications)
6. [Layout Integration](#6-layout-integration)
7. [Module Progressive Loading](#7-module-progressive-loading)
8. [Network-Adaptive Behaviour](#8-network-adaptive-behaviour)
9. [Implementation Order](#9-implementation-order)
10. [Verification Plan](#10-verification-plan)

---

## 1. Core Principle — Zero Cost UX

### The Rule
The experience framework must never add to actual loading time. It only changes what the user *perceives* during the time that is already being spent loading.

```
WITHOUT framework:  [blank screen 600ms] → content appears
WITH framework:     [skeleton 600ms]     → content appears
Actual load time:   identical
Perceived time:     dramatically shorter
```

### How It Stays Zero Cost

| Technique | Why It's Free |
|---|---|
| Skeletons render immediately | They are static HTML — no API call needed |
| Animations are CSS-only | GPU-composited, never blocks JS thread |
| Route progress bar uses Zustand | Already in the app, no extra bundle |
| Network adaptation reads `navigator.connection` | Synchronous, no async call |
| Skeleton variants are conditional renders | Tree-shaken in production |
| Framer Motion animations skip if < 150ms | No animation shown for fast loads |

### What This Framework Does NOT Do
- Does not delay any API call
- Does not add middleware to request chains
- Does not block renders waiting for animation state
- Does not replace TanStack Query or any data-fetching logic
- Does not add new network requests

---

## 2. Directory Structure

```
src/
└── components/
    └── experience/
        ├── index.ts                        ← barrel export
        ├── LoadingExperienceConfig.ts      ← all animation tokens + profiles
        ├── Skeleton.tsx                    ← unified skeleton component
        ├── PageState.tsx                   ← page state orchestrator
        ├── state/
        │   ├── LoadingState.tsx
        │   ├── ErrorState.tsx
        │   ├── EmptyState.tsx
        │   ├── PermissionState.tsx
        │   ├── OfflineState.tsx
        │   └── ReadOnlyState.tsx
        ├── AsyncButton.tsx                 ← button with inline states
        ├── MotionProvider.tsx              ← framer-motion wrapper
        ├── RouteProgressBar.tsx            ← top-edge progress bar
        ├── NavigationExperienceProvider.tsx ← global nav state manager
        └── useNavigation.ts                ← router hook with intent tracking
```

---

## 3. Experience Configuration

### `LoadingExperienceConfig.ts`

```ts
// src/components/experience/LoadingExperienceConfig.ts

export type ExperienceLevel = 'ultraFast' | 'balanced' | 'premium'

export interface ExperienceProfile {
  level: ExperienceLevel
  // Durations in ms
  navigation: number
  dialog: number
  page: number
  drawer: number
  button: number
  hover: number
  shimmerSpeed: number
  // Whether to show translate animations
  useTranslations: boolean
  // Minimum load time before showing skeleton (prevents flash on fast connections)
  skeletonMinShowMs: number
  // Skip animation entirely if render completes faster than this
  animationSkipThresholdMs: number
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
}

// Default: balanced for most users
export const DEFAULT_EXPERIENCE: ExperienceLevel = 'balanced'

// CSS variable map — injected into :root by NavigationExperienceProvider
export function buildCSSTokens(profile: ExperienceProfile): Record<string, string> {
  return {
    '--exp-nav-duration':    `${profile.navigation}ms`,
    '--exp-dialog-duration': `${profile.dialog}ms`,
    '--exp-page-duration':   `${profile.page}ms`,
    '--exp-drawer-duration': `${profile.drawer}ms`,
    '--exp-btn-duration':    `${profile.button}ms`,
    '--exp-hover-duration':  `${profile.hover}ms`,
    '--exp-shimmer-speed':   `${profile.shimmerSpeed}ms`,
  }
}
```

---

## 4. CSS Additions

### Add to `styles/globals.css`

```css
/* ─── Experience Framework Animations ─────────────────────────────── */

/* Shimmer keyframe — GPU composited (transform + opacity only) */
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes shimmer-dark {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Shimmer utility classes */
.animate-shimmer {
  position: relative;
  overflow: hidden;
  background: #F1F5F9;
}
.animate-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.6) 50%,
    transparent 100%
  );
  animation: shimmer var(--exp-shimmer-speed, 1600ms) ease-in-out infinite;
  will-change: transform;
}

/* Dark mode shimmer */
.dark .animate-shimmer {
  background: #1E293B;
}
.dark .animate-shimmer::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.08) 50%,
    transparent 100%
  );
}

/* Route progress bar */
.route-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: #6366F1;
  z-index: 9999;
  transition: width var(--exp-nav-duration, 200ms) ease-out,
              opacity 150ms ease;
  pointer-events: none;
  will-change: width, opacity;
}

/* Page transition wrapper */
.page-transition-enter {
  opacity: 0;
  transform: translateY(4px);
}
.page-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity var(--exp-page-duration, 160ms) ease-out,
              transform var(--exp-page-duration, 160ms) ease-out;
}

/* Instant variant — no animation (ultraFast mode) */
.page-transition-instant {
  opacity: 1;
  transform: none;
  transition: none;
}

/* Button state transitions */
.async-btn-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity var(--exp-btn-duration, 120ms) ease;
  white-space: nowrap;
}
```

---

## 5. Component Specifications

---

### 5.1 `Skeleton.tsx`

```tsx
// src/components/experience/Skeleton.tsx
'use client'

export type SkeletonVariant = 'card' | 'table' | 'chart' | 'form' | 'stats' | 'list'
export type SkeletonDensity = 'compact' | 'comfortable' | 'spacious'

interface SkeletonProps {
  variant: SkeletonVariant
  density?: SkeletonDensity
  // For 'stats': number of stat cards
  count?: number
  // For 'table': rows and columns
  rows?: number
  columns?: number
  // For 'chart': height in px
  chartHeight?: number
  className?: string
}

export function Skeleton({
  variant,
  density = 'comfortable',
  count = 5,
  rows = 8,
  columns = 6,
  chartHeight = 200,
  className,
}: SkeletonProps) {
  const gap = density === 'compact' ? 'gap-2' : density === 'spacious' ? 'gap-6' : 'gap-4'
  const rowH = density === 'compact' ? 'h-12' : density === 'spacious' ? 'h-20' : 'h-16'

  if (variant === 'stats') {
    return (
      <div className={`grid grid-cols-${count} ${gap} ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-7 animate-shimmer rounded w-20" />
                <div className="h-3 animate-shimmer rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-[#F9FAFB] h-11 flex items-center gap-4 px-6">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-3 animate-shimmer rounded flex-1" style={{ maxWidth: i === 0 ? '40px' : undefined }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${rowH} flex items-center gap-4 px-6 border-b border-[#E5E7EB] last:border-0`}>
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                className="h-3 animate-shimmer rounded flex-1"
                style={{ maxWidth: j === 0 ? '40px' : j === columns - 1 ? '80px' : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-5 ${className}`}>
        <div className="h-4 animate-shimmer rounded w-32 mb-4" />
        <div className="animate-shimmer rounded-lg" style={{ height: chartHeight }} />
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4 ${className}`}>
        <div className="h-5 animate-shimmer rounded w-40" />
        <div className="space-y-3">
          {Array.from({ length: count || 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div className={`bg-white rounded-xl border border-[#E5E7EB] p-6 ${className}`}>
        <div className="h-5 animate-shimmer rounded w-32 mb-6" />
        <div className={`grid grid-cols-4 ${gap} mb-4`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 animate-shimmer rounded w-20" />
              <div className="h-10 animate-shimmer rounded-lg" />
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-4 ${gap}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 animate-shimmer rounded w-16" />
              <div className="h-10 animate-shimmer rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg animate-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 animate-shimmer rounded w-48" />
              <div className="h-3 animate-shimmer rounded w-32" />
            </div>
            <div className="h-8 w-20 animate-shimmer rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return null
}
```

---

### 5.2 `PageState.tsx` + State Components

```tsx
// src/components/experience/PageState.tsx
'use client'
import { LoadingState } from './state/LoadingState'
import { ErrorState } from './state/ErrorState'
import { EmptyState } from './state/EmptyState'
import { PermissionState } from './state/PermissionState'
import { OfflineState } from './state/OfflineState'
import { SkeletonVariant, SkeletonDensity } from './Skeleton'

interface PageStateProps {
  // State flags
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  hasPermission?: boolean
  isOffline?: boolean

  // Loading config
  skeletonVariant?: SkeletonVariant
  skeletonCount?: number
  skeletonRows?: number
  skeletonColumns?: number
  skeletonDensity?: SkeletonDensity

  // Error config
  error?: Error | null
  onRetry?: () => void

  // Empty config
  emptyIcon?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode

  // Children shown when all states are clear
  children: React.ReactNode
}

export function PageState({
  isLoading, isError, isEmpty, hasPermission = true, isOffline,
  skeletonVariant = 'table', skeletonCount, skeletonRows, skeletonColumns, skeletonDensity,
  error, onRetry,
  emptyIcon, emptyTitle, emptyDescription, emptyAction,
  children,
}: PageStateProps) {
  if (isOffline) return <OfflineState />
  if (!hasPermission) return <PermissionState />
  if (isLoading) return (
    <LoadingState
      variant={skeletonVariant}
      count={skeletonCount}
      rows={skeletonRows}
      columns={skeletonColumns}
      density={skeletonDensity}
    />
  )
  if (isError) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) return (
    <EmptyState
      icon={emptyIcon}
      title={emptyTitle}
      description={emptyDescription}
      action={emptyAction}
    />
  )
  return <>{children}</>
}
```

```tsx
// src/components/experience/state/ErrorState.tsx
'use client'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function ErrorState({ error, onRetry }: { error?: Error | null, onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
        <AlertCircle className="size-7 text-[#DC2626]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">Something went wrong</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
        >
          <RefreshCw className="size-4" />
          Try Again
        </button>
      )}
    </div>
  )
}
```

```tsx
// src/components/experience/state/EmptyState.tsx
'use client'
import { Inbox } from 'lucide-react'

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        {icon || <Inbox className="size-7 text-[#94A3B8]" />}
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">
        {title || 'No data found'}
      </h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        {description || 'No records match your current filters or nothing has been added yet.'}
      </p>
      {action}
    </div>
  )
}
```

```tsx
// src/components/experience/state/PermissionState.tsx
'use client'
import { ShieldAlert } from 'lucide-react'

export function PermissionState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-4">
        <ShieldAlert className="size-7 text-[#D97706]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">Access Restricted</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm">
        You don't have permission to view this section. Contact your administrator.
      </p>
    </div>
  )
}
```

```tsx
// src/components/experience/state/OfflineState.tsx
'use client'
import { WifiOff, RefreshCw } from 'lucide-react'

export function OfflineState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <WifiOff className="size-7 text-[#94A3B8]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">You're offline</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        Check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
      >
        <RefreshCw className="size-4" />
        Retry Connection
      </button>
    </div>
  )
}
```

```tsx
// src/components/experience/state/ReadOnlyState.tsx
'use client'
import { Lock } from 'lucide-react'

export function ReadOnlyState({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#FEF9C3] border border-[#FDE68A] rounded-lg">
      <Lock className="size-4 text-[#D97706] flex-shrink-0" />
      <p className="text-sm text-[#92400E]">
        {message || 'This record is in read-only mode and cannot be edited.'}
      </p>
    </div>
  )
}
```

---

### 5.3 `AsyncButton.tsx`

Preserves exact button width through all state transitions — no layout shift.

```tsx
// src/components/experience/AsyncButton.tsx
'use client'
import { useState, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

type ButtonStatus = 'idle' | 'loading' | 'success' | 'failed'

interface AsyncButtonProps {
  onClick: () => Promise<void>
  children: React.ReactNode
  className?: string
  disabled?: boolean
  successDuration?: number   // ms to show success state (default 1500)
  failedDuration?: number    // ms to show failed state (default 2000)
  loadingText?: string
  successText?: string
  failedText?: string
  variant?: 'primary' | 'outline' | 'danger'
}

const VARIANT_CLASSES = {
  primary: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white',
  outline: 'border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F8FAFC]',
  danger:  'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
}

export function AsyncButton({
  onClick,
  children,
  className = '',
  disabled,
  successDuration = 1500,
  failedDuration = 2000,
  loadingText,
  successText,
  failedText,
  variant = 'primary',
}: AsyncButtonProps) {
  const [status, setStatus] = useState<ButtonStatus>('idle')

  const handleClick = useCallback(async () => {
    if (status !== 'idle') return
    setStatus('loading')

    try {
      await onClick()
      setStatus('success')
      setTimeout(() => setStatus('idle'), successDuration)
    } catch {
      setStatus('failed')
      setTimeout(() => setStatus('idle'), failedDuration)
    }
  }, [onClick, status, successDuration, failedDuration])

  const isDisabled = disabled || status === 'loading'

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        relative h-10 px-4 rounded-lg text-sm font-medium
        flex items-center justify-center
        transition-all duration-[var(--exp-btn-duration,120ms)]
        disabled:opacity-70 disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]}
        ${className}
      `}
    >
      {/* All states rendered simultaneously — only opacity changes */}
      {/* This preserves button width through all transitions */}

      {/* Idle */}
      <span className={`async-btn-content ${status === 'idle' ? 'opacity-100' : 'opacity-0 absolute'}`}>
        {children}
      </span>

      {/* Loading */}
      <span className={`async-btn-content ${status === 'loading' ? 'opacity-100' : 'opacity-0 absolute'}`}>
        <Loader2 className="size-4 animate-spin" />
        {loadingText || 'Saving...'}
      </span>

      {/* Success */}
      <span className={`async-btn-content ${status === 'success' ? 'opacity-100' : 'opacity-0 absolute'}`}>
        <CheckCircle2 className="size-4" />
        {successText || 'Saved!'}
      </span>

      {/* Failed */}
      <span className={`async-btn-content ${status === 'failed' ? 'opacity-100' : 'opacity-0 absolute'}`}>
        <XCircle className="size-4" />
        {failedText || 'Failed'}
      </span>
    </button>
  )
}
```

---

### 5.4 `MotionProvider.tsx`

```tsx
// src/components/experience/MotionProvider.tsx
'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useExperienceProfile } from './NavigationExperienceProvider'

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const profile = useExperienceProfile()

  // ultraFast mode: skip all animations entirely
  if (profile.level === 'ultraFast') {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: profile.useTranslations ? 4 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: profile.page / 1000,
          ease: 'easeOut',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

---

### 5.5 `RouteProgressBar.tsx`

```tsx
// src/components/experience/RouteProgressBar.tsx
'use client'
import { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation'

export function RouteProgressBar() {
  const { isNavigating } = useNavigationStore()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isNavigating) {
      setVisible(true)
      setWidth(0)

      // Fast initial jump to 30%
      const t1 = setTimeout(() => setWidth(30), 10)
      // Slow crawl to 70%
      const t2 = setTimeout(() => setWidth(70), 150)
      // Hold at 90% — waiting for route to complete
      const t3 = setTimeout(() => setWidth(90), 500)

      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      // Route completed — snap to 100% then fade out
      setWidth(100)
      const t = setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [isNavigating])

  if (!visible) return null

  return (
    <div
      className="route-progress-bar"
      style={{ width: `${width}%` }}
      aria-hidden="true"
    />
  )
}
```

---

### 5.6 `NavigationExperienceProvider.tsx`

```tsx
// src/components/experience/NavigationExperienceProvider.tsx
'use client'
import { useEffect, createContext, useContext, useState, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationStore } from '@/store/navigation'
import {
  EXPERIENCE_PROFILES,
  DEFAULT_EXPERIENCE,
  ExperienceProfile,
  buildCSSTokens,
} from './LoadingExperienceConfig'

const ExperienceContext = createContext<ExperienceProfile>(
  EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE]
)

export function useExperienceProfile() {
  return useContext(ExperienceContext)
}

export function NavigationExperienceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setNavigating, setNavigatingTo } = useNavigationStore()

  // Detect network and pick profile
  const profile = useMemo(() => {
    if (typeof navigator === 'undefined') return EXPERIENCE_PROFILES[DEFAULT_EXPERIENCE]

    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
    const effectiveType = conn?.effectiveType

    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return EXPERIENCE_PROFILES.ultraFast   // minimal animations on slow connections
    }
    if (effectiveType === '4g') {
      return EXPERIENCE_PROFILES.balanced    // standard on 4G
    }
    return EXPERIENCE_PROFILES.balanced      // default
  }, [])

  // Inject CSS tokens into :root
  useEffect(() => {
    const tokens = buildCSSTokens(profile)
    const root = document.documentElement
    Object.entries(tokens).forEach(([key, val]) => root.style.setProperty(key, val))
  }, [profile])

  // Reset navigation state when route changes
  useEffect(() => {
    setNavigating(false)
    setNavigatingTo(null)
  }, [pathname, searchParams, setNavigating, setNavigatingTo])

  // Intercept all local anchor clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return

      setNavigating(true)
      setNavigatingTo(href)
    }

    // Capture phase — fires before React's synthetic events
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [setNavigating, setNavigatingTo])

  // Handle browser back/forward
  useEffect(() => {
    function handlePopState() {
      setNavigating(true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setNavigating])

  return (
    <ExperienceContext.Provider value={profile}>
      {children}
    </ExperienceContext.Provider>
  )
}
```

---

### 5.7 `useNavigation.ts`

```ts
// src/components/experience/useNavigation.ts
'use client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useNavigationStore } from '@/store/navigation'

export function useNavigation() {
  const router = useRouter()
  const { setNavigating, setNavigatingTo } = useNavigationStore()

  const navigate = useCallback((href: string) => {
    setNavigating(true)
    setNavigatingTo(href)
    router.push(href)
  }, [router, setNavigating, setNavigatingTo])

  const replace = useCallback((href: string) => {
    setNavigating(true)
    setNavigatingTo(href)
    router.replace(href)
  }, [router, setNavigating, setNavigatingTo])

  return { navigate, replace, back: router.back }
}
```

---

### 5.8 Zustand Navigation Store Update

```ts
// store/navigation.ts — add these fields to existing Zustand store
import { create } from 'zustand'

interface NavigationStore {
  isNavigating: boolean
  navigatingTo: string | null
  setNavigating: (val: boolean) => void
  setNavigatingTo: (href: string | null) => void
  // ... existing sidebar state below
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  isNavigating: false,
  navigatingTo: null,
  setNavigating: (val) => set({ isNavigating: val }),
  setNavigatingTo: (href) => set({ navigatingTo: href }),
}))
```

---

## 6. Layout Integration

### `app/(dashboard)/layout.tsx`

```tsx
import { NavigationExperienceProvider } from '@/components/experience/NavigationExperienceProvider'
import { MotionProvider } from '@/components/experience/MotionProvider'
import { RouteProgressBar } from '@/components/experience/RouteProgressBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationExperienceProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden ml-[232px]">
          <RouteProgressBar />
          <Header />
          <main className="flex-1 overflow-y-auto bg-[#F1F5F9] p-8">
            <MotionProvider>
              {children}
            </MotionProvider>
          </main>
        </div>
      </div>
    </NavigationExperienceProvider>
  )
}
```

### `components/layout/Header.tsx` — Optimistic Breadcrumbs

```tsx
// Build breadcrumbs optimistically from navigatingTo OR current pathname
// No waiting for route to mount — breadcrumb updates instantly on click

const ROUTE_METADATA: Record<string, { title: string; parent?: string }> = {
  '/':                              { title: 'Dashboard' },
  '/master-data/brands':            { title: 'Brands',            parent: 'Master Data' },
  '/master-data/godowns':           { title: 'Godowns',           parent: 'Master Data' },
  '/master-data/parties':           { title: 'Parties',           parent: 'Master Data' },
  '/raw-materials/purchases':       { title: 'Purchases',         parent: 'Raw Materials' },
  '/raw-materials/purchase-returns':{ title: 'Purchase Returns',  parent: 'Raw Materials' },
  '/raw-materials/stock':           { title: 'Stock Overview',    parent: 'Raw Materials' },
  '/production/lots':               { title: 'Production Lots',   parent: 'Production' },
  '/production/stage-entries':      { title: 'Stage Entries',     parent: 'Production' },
  '/production/job-work/list':      { title: 'Job Work List',     parent: 'Job Work' },
  '/finished-stock':                { title: 'Overview',          parent: 'Finished Stock' },
  '/finished-stock/adjustments':    { title: 'Adjustments',       parent: 'Finished Stock' },
  '/finished-stock/challans':       { title: 'Challans',          parent: 'Finished Stock' },
  // Add all routes as phases complete
}

export function Header() {
  const pathname = usePathname()
  const { navigatingTo } = useNavigationStore()

  // Use navigatingTo if present (optimistic) — falls back to current pathname
  const activePath = navigatingTo || pathname
  const meta = ROUTE_METADATA[activePath] ?? { title: activePath.split('/').pop() || '' }

  // Breadcrumb updates instantly when user clicks nav — before route mounts
  return (
    <header>
      <Breadcrumb title={meta.title} parent={meta.parent} />
    </header>
  )
}
```

---

## 7. Module Progressive Loading

### Pattern — Apply to Every Page

```tsx
// Standard progressive loading pattern — use this in EVERY page component

export default function PurchasesPage() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: retryStats } = usePurchaseStats()
  const { data: purchases, isLoading: tableLoading, error: tableError, refetch: retryTable } = usePurchases()

  return (
    <div>
      {/* Shell — ALWAYS renders immediately, no state check */}
      <PageHeader title="Purchases" ... />
      <FilterBar ... />

      {/* Priority 1: Stat cards */}
      <PageState
        isLoading={statsLoading}
        isError={!!statsError}
        isEmpty={false}
        skeletonVariant="stats"
        skeletonCount={5}
        error={statsError}
        onRetry={retryStats}
      >
        <StatCards data={stats!} />
      </PageState>

      {/* Priority 2: Data table */}
      <PageState
        isLoading={tableLoading}
        isError={!!tableError}
        isEmpty={purchases?.length === 0}
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={10}
        error={tableError}
        onRetry={retryTable}
        emptyTitle="No purchases yet"
        emptyDescription="Add your first purchase to get started."
        emptyAction={<Button onClick={() => router.push('/raw-materials/purchases/new')}>+ Add Purchase</Button>}
      >
        <PurchasesTable data={purchases!} />
      </PageState>

      {/* Priority 3: Charts — non-critical, loads last */}
      <Suspense fallback={<Skeleton variant="chart" chartHeight={200} />}>
        <PurchaseCharts />
      </Suspense>
    </div>
  )
}
```

### Priority Levels Per Page

| Priority | Content | Loading Behavior |
|---|---|---|
| 1 | Stat cards, KPI numbers | Skeleton shown, loads with main query |
| 2 | Main data table | Skeleton shown, loads with main query (parallel) |
| 3 | Charts, graphs | Suspense fallback, loads client-side after table |
| 4 | Secondary widgets | Suspense fallback, lowest priority |

### Delete / Destructive Actions — Always AsyncButton

```tsx
// Replace all delete buttons with AsyncButton
<AsyncButton
  variant="danger"
  onClick={async () => {
    await deletePurchase(purchase.id)
    queryClient.invalidateQueries({ queryKey: queryKeys.purchases(businessId) })
  }}
  loadingText="Deleting..."
  successText="Deleted"
  failedText="Failed"
>
  Delete
</AsyncButton>
```

### Save Actions — Always AsyncButton

```tsx
// Replace all save/submit buttons with AsyncButton
<AsyncButton
  variant="primary"
  onClick={handleSave}
  loadingText="Saving..."
  successText="Saved!"
  failedText="Try Again"
>
  Save Purchase
</AsyncButton>
```

---

## 8. Network-Adaptive Behaviour

The `NavigationExperienceProvider` reads `navigator.connection.effectiveType` and selects the profile automatically:

| Connection | Profile Selected | Effect |
|---|---|---|
| `slow-2g` or `2g` | `ultraFast` | No animations, immediate render, short shimmer |
| `3g` | `balanced` | Standard shimmer, brief page transition |
| `4g` or WiFi | `balanced` | Standard animations |
| Unknown | `balanced` | Default |

The profile injects CSS tokens into `:root` — all animation durations update globally. No component re-renders. Pure CSS variable change.

---

## 9. Implementation Order

This framework is built once in Phase 1 (Day 1) and extended incrementally. Do not wait until later phases.

### Day 1 — Foundation (Do This First, Before Any Business Components)
1. Add CSS additions to `globals.css`
2. Create `LoadingExperienceConfig.ts`
3. Add `navigationIntent` + `navigatingTo` to Zustand navigation store
4. Create `Skeleton.tsx`
5. Create all 5 state components (`LoadingState`, `ErrorState`, `EmptyState`, `PermissionState`, `OfflineState`, `ReadOnlyState`)
6. Create `PageState.tsx`
7. Create `AsyncButton.tsx`
8. Create `RouteProgressBar.tsx`
9. Create `NavigationExperienceProvider.tsx`
10. Create `useNavigation.ts`
11. Create `MotionProvider.tsx`
12. Create barrel `index.ts`
13. Integrate all into `layout.tsx`
14. Update `Header.tsx` with optimistic breadcrumbs + ROUTE_METADATA map

### Every New Page (Phase 2 Onwards)
- Use `PageState` for every loading/error/empty surface
- Use `AsyncButton` for every save/delete button
- Use `useNavigation` hook instead of `router.push`
- Add route to `ROUTE_METADATA` in `Header.tsx`

---

## 10. Verification Plan

### Automated
```bash
npm run build   # zero TypeScript errors, zero linter warnings
npx tsc --noEmit
```

### Manual Checklist

| Test | Expected Result |
|---|---|
| Click any sidebar nav item | Breadcrumb updates < 50ms (before route mounts) |
| Click any nav item | Progress bar appears at top edge immediately |
| Navigate to Purchases | Stat cards show shimmer skeleton, then real data |
| Navigate to Production Lots | Table shows shimmer skeleton, then real data |
| Click Save Purchase | Button shows spinner → "Saved!" → returns to idle |
| Click Delete | Button shows spinner → "Deleted" → row removed |
| Resize to mobile | Skeletons adapt correctly |
| Simulate 3G (DevTools throttle) | ultraFast profile activates, no heavy animations |
| Simulate offline | OfflineState renders |
| Navigate back with browser button | Progress bar fires, breadcrumb updates |
| Open page for first time | No blank screen — skeleton visible within 16ms |

### Performance Budget Check
After framework integration, re-measure these on Purchases page:
- Time to first skeleton visible: target < 16ms (one frame)
- Time to meaningful content: same as before ± 20ms (framework adds zero)
- Bundle size increase: < 15 KB gzipped (Framer Motion tree-shaken + Skeleton components)

---

## 11. Barrel Export

```ts
// src/components/experience/index.ts
export { Skeleton } from './Skeleton'
export { PageState } from './PageState'
export { AsyncButton } from './AsyncButton'
export { MotionProvider } from './MotionProvider'
export { RouteProgressBar } from './RouteProgressBar'
export { NavigationExperienceProvider, useExperienceProfile } from './NavigationExperienceProvider'
export { useNavigation } from './useNavigation'
export { ReadOnlyState } from './state/ReadOnlyState'
export type { SkeletonVariant, SkeletonDensity } from './Skeleton'
export type { ExperienceLevel, ExperienceProfile } from './LoadingExperienceConfig'
```

---

*TAS ERP Global Experience Framework | V4 Final | June 2026*
