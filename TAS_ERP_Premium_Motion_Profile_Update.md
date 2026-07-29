# TAS ERP — Premium Motion Profile Update
**Addendum to Global Experience Framework (Section 3 — LoadingExperienceConfig.ts)**

> This replaces the placeholder `premium` profile values in the Experience Framework with the Kinetic Enterprise "soft-overshoot" spec. `ultraFast` and `balanced` profiles are unchanged. This only affects businesses/users who opt into the Premium experience tier.

---

## 1. What Changes

The original `EXPERIENCE_PROFILES.premium` object used generic values (300ms, standard easing). Replace it with:

```ts
// src/components/experience/LoadingExperienceConfig.ts — UPDATED premium profile

export interface ExperienceProfile {
  level: ExperienceLevel
  navigation: number
  dialog: number
  page: number
  drawer: number
  button: number
  hover: number
  shimmerSpeed: number
  useTranslations: boolean
  skeletonMinShowMs: number
  animationSkipThresholdMs: number
  // NEW fields for premium profile support
  easing: string
  staggerDelayMs: number
  hoverScale: number
  activeScale: number
  entranceOffsetPx: number
  entranceScaleFrom: number
}

export const EXPERIENCE_PROFILES: Record<ExperienceLevel, ExperienceProfile> = {
  ultraFast: {
    level: 'ultraFast',
    navigation: 120, dialog: 100, page: 80, drawer: 100, button: 80, hover: 60,
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
    navigation: 200, dialog: 180, page: 160, drawer: 200, button: 120, hover: 100,
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
    button: 300,           // hover transition duration specifically
    hover: 300,
    shimmerSpeed: 2500,     // slower, fluid sweep per spec
    useTranslations: true,
    skeletonMinShowMs: 150,
    animationSkipThresholdMs: 300,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // "soft-overshoot"
    staggerDelayMs: 40,
    hoverScale: 1.02,
    activeScale: 0.97,
    entranceOffsetPx: 24,
    entranceScaleFrom: 0.98,
  },
}
```

---

## 2. CSS Additions — Premium Easing + Keyframes

Add to `globals.css`, alongside the existing shimmer keyframes:

```css
/* ─── Premium Motion Profile ──────────────────────────────────────── */

.ease-premium {
  transition-timing-function: var(--exp-easing, cubic-bezier(0.34, 1.56, 0.64, 1));
  transition-duration: var(--exp-page-duration, 400ms);
}

/* Entrance animation — modals, dialogs, dropdowns, cards appearing */
@keyframes premium-reveal {
  from {
    opacity: 0;
    transform: translateY(var(--exp-entrance-offset, 24px)) scale(var(--exp-entrance-scale, 0.98));
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.premium-reveal {
  animation: premium-reveal var(--exp-page-duration, 400ms) var(--exp-easing, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
}

/* Stagger children — list items, table rows entering, form fields */
.premium-stagger > * {
  opacity: 0;
  animation: premium-reveal var(--exp-page-duration, 400ms) var(--exp-easing) forwards;
}
.premium-stagger > *:nth-child(1) { animation-delay: calc(var(--exp-stagger, 40ms) * 0); }
.premium-stagger > *:nth-child(2) { animation-delay: calc(var(--exp-stagger, 40ms) * 1); }
.premium-stagger > *:nth-child(3) { animation-delay: calc(var(--exp-stagger, 40ms) * 2); }
.premium-stagger > *:nth-child(4) { animation-delay: calc(var(--exp-stagger, 40ms) * 3); }
.premium-stagger > *:nth-child(5) { animation-delay: calc(var(--exp-stagger, 40ms) * 4); }
.premium-stagger > *:nth-child(n+6) { animation-delay: calc(var(--exp-stagger, 40ms) * 5); }
/* For dynamic lists beyond 6 items, apply inline style="animation-delay: Nms" via JS instead of relying on nth-child */

/* Premium shimmer — slower, softer gradient per spec */
[data-theme] .animate-shimmer[data-profile="premium"]::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--card-bg) 15%,
    rgba(255,255,255,0.8) 50%,
    var(--card-bg) 85%,
    transparent 100%
  );
  animation-duration: var(--exp-shimmer-speed, 2500ms);
}

/* Hover micro-interaction — buttons and cards */
.premium-hoverable {
  transition: transform var(--exp-hover-duration, 300ms) ease-out,
              box-shadow var(--exp-hover-duration, 300ms) ease-out;
}
.premium-hoverable:hover {
  transform: scale(var(--exp-hover-scale, 1.02));
  box-shadow: var(--shadow-md);
}
.premium-hoverable:active {
  transform: scale(var(--exp-active-scale, 0.97));
  transition-duration: 60ms; /* instant snap on click, per spec */
}
```

---

## 3. Updated `buildCSSTokens()` Function

```ts
// src/components/experience/LoadingExperienceConfig.ts

export function buildCSSTokens(profile: ExperienceProfile): Record<string, string> {
  return {
    '--exp-nav-duration':     `${profile.navigation}ms`,
    '--exp-dialog-duration':  `${profile.dialog}ms`,
    '--exp-page-duration':    `${profile.page}ms`,
    '--exp-drawer-duration':  `${profile.drawer}ms`,
    '--exp-btn-duration':     `${profile.button}ms`,
    '--exp-hover-duration':   `${profile.hover}ms`,
    '--exp-shimmer-speed':    `${profile.shimmerSpeed}ms`,
    // NEW tokens for premium profile
    '--exp-easing':           profile.easing,
    '--exp-stagger':          `${profile.staggerDelayMs}ms`,
    '--exp-hover-scale':      `${profile.hoverScale}`,
    '--exp-active-scale':     `${profile.activeScale}`,
    '--exp-entrance-offset':  `${profile.entranceOffsetPx}px`,
    '--exp-entrance-scale':   `${profile.entranceScaleFrom}`,
  }
}
```

This means **zero component code changes are needed** — the same CSS variable injection mechanism from the original framework (Section 5.6 `NavigationExperienceProvider`) now also carries the premium-specific tokens. Components that already use `var(--exp-page-duration)` etc. automatically pick up the new premium behavior when that profile is active.

---

## 4. Component-Specific Wiring

### 4.1 Modals / Dialogs / Dropdowns (Entrance Animation)
Every modal, dialog, and popover across the app (Add User, Record Payment, Add Adjustment, Settle Advance, Confirm Dialogs, dropdown menus) gets the `premium-reveal` class conditionally applied:

```tsx
// components/shared/Modal.tsx (or wherever your modal wrapper lives)
import { useExperienceProfile } from '@/components/experience'

export function Modal({ children, ...props }) {
  const profile = useExperienceProfile()
  const animClass = profile.level === 'premium' ? 'premium-reveal' : 'page-transition-enter-active'

  return (
    <div className={`modal-panel ${animClass}`}>
      {children}
    </div>
  )
}
```

### 4.2 AsyncButton — Hover & Active States
`AsyncButton.tsx` (already defined in the Experience Framework) gets the `premium-hoverable` class added to its className string:

```tsx
className={`
  relative h-10 px-4 rounded-lg text-sm font-medium
  flex items-center justify-center
  transition-all duration-[var(--exp-btn-duration,120ms)]
  premium-hoverable
  disabled:opacity-70 disabled:cursor-not-allowed
  ${VARIANT_CLASSES[variant]}
  ${className}
`}
```
On `ultraFast`/`balanced` profiles, `hoverScale`/`activeScale` are `1`/`1` or `1.01`/`0.99` — nearly imperceptible. On `premium`, they become the full `1.02`/`0.97` per spec. Same class, different behavior, zero conditional logic needed in the component.

### 4.3 Skeleton Shimmer — Slower Sweep + Softer Gradient
`Skeleton.tsx` needs one small addition — pass the active profile level as a data attribute so the CSS selector in Section 2 can target it:

```tsx
// Skeleton.tsx
const profile = useExperienceProfile()
// ...
<div className="animate-shimmer" data-profile={profile.level} />
```

### 4.4 Stagger — Table Rows, List Items, Form Fields Entering
Apply `premium-stagger` wrapper class to the direct parent of repeated elements:

```tsx
// Skeleton.tsx table variant, and real DataTable component
<div className={profile.level === 'premium' ? 'premium-stagger' : ''}>
  {rows.map((row, i) => <TableRow key={i} data={row} />)}
</div>
```
For lists longer than 6 items (dynamic data, not skeleton placeholders), fall back to inline `style={{ animationDelay: `${Math.min(i, 8) * profile.staggerDelayMs}ms` }}` rather than relying on `nth-child` CSS, since real data length is unbounded.

### 4.5 Toast Notifications (Sonner)
Sonner's own transition config gets overridden when premium is active:

```tsx
// app/(dashboard)/layout.tsx — Sonner Toaster config
import { Toaster } from 'sonner'
const profile = useExperienceProfile()

<Toaster
  duration={4000}
  toastOptions={{
    style: profile.level === 'premium'
      ? { transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', transitionDuration: '400ms' }
      : undefined
  }}
/>
```

---

## 5. Where Premium Profile Is Selected

Per the original Experience Framework (`NavigationExperienceProvider.tsx`), profile selection was previously automatic based on network speed only. Add a manual override:

```tsx
// Settings → General (Phase 2) → System Preferences card — NEW toggle
// Add a new row to the System Preferences card (Section 5.1 of Phase 2 plan):

Row: "Motion Style" (replaces plain toggle with a 3-option select)
  Label: "Motion Style"
  Subtitle: "Choose how animations feel across the app"
  Select: Efficient (ultraFast) | Balanced (default) | Premium
  Persisted to: business_settings.motion_profile (new column, TEXT DEFAULT 'balanced')
```

```sql
ALTER TABLE business_settings ADD COLUMN motion_profile TEXT DEFAULT 'balanced'
  CHECK (motion_profile IN ('ultraFast','balanced','premium'));
```

**Selection priority (highest to lowest):**
1. User's explicit choice in Settings (`business_settings.motion_profile`)
2. Network auto-detection (existing logic — slow connections force `ultraFast` regardless of setting, to protect actual performance)
3. Default: `balanced`

```tsx
// NavigationExperienceProvider.tsx — updated profile resolution
const profile = useMemo(() => {
  const conn = (navigator as any).connection
  const effectiveType = conn?.effectiveType

  // Network override always wins — performance protection is non-negotiable
  if (effectiveType === '2g' || effectiveType === 'slow-2g') {
    return EXPERIENCE_PROFILES.ultraFast
  }

  // Otherwise respect the business's chosen motion style
  return EXPERIENCE_PROFILES[businessSettings.motion_profile] ?? EXPERIENCE_PROFILES.balanced
}, [businessSettings.motion_profile])
```

---

## 6. Verification Checklist

- [ ] `premium` profile values updated exactly per spec (400ms, cubic-bezier(0.34,1.56,0.64,1), 40ms stagger)
- [ ] Modals/dialogs use `premium-reveal` (translateY 24px + scale 0.98→1 + fade) when premium is active
- [ ] Skeleton shimmer cycle is 2500ms and uses the softer 3-stop gradient when premium is active
- [ ] Buttons/cards scale to 1.02 on hover (300ms transition) and snap to 0.97 on active/click when premium is active
- [ ] Table rows and list items stagger in at 40ms intervals when premium is active (verify with 8+ row table — no more than 6 discrete CSS delays, rest capped)
- [ ] Toast notifications use the premium easing curve when premium is active
- [ ] Slow-network auto-detection still overrides to `ultraFast` even if business has selected `premium` (performance protection never bypassed)
- [ ] Settings → General → Motion Style select persists to `business_settings.motion_profile`
- [ ] Switching Motion Style takes effect immediately without page reload (CSS variable swap only)
- [ ] `ultraFast` and `balanced` profiles unchanged in behavior from original framework spec

---

*TAS ERP Premium Motion Profile Update | Addendum to Global Experience Framework | June 2026*
