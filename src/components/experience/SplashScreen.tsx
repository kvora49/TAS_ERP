'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ClothColorPalette {
  base: string;
  light: string;
  dark: string;
  sheen: string;
  edge: string;
}

interface SwatchConfig {
  seed: number;
  paletteIndex: number;
  widthFactor: number;   // Width across flight direction
  arcFactor: number;     // Multiplier on streamer arc length
  startAngle: number;    // Entry angle from center
  orbitOffset: number;   // Angular distribution offset in vortex
  speedMult: number;     // Natural speed variation
}

// ============================================================
// CONSTANTS & COLOR PALETTES
// ============================================================

const TOTAL_DURATION = 2700; // ms: exit fade begins at 2700ms
const NUM_PIECES = 8;

// TAS brand textile palette: deep navy, vibrant blues, silk white, silver
const PALETTES: ClothColorPalette[] = [
  { base: '#0B1D3A', light: '#1F3C70', dark: '#040B18', sheen: '#2E599C', edge: '#3B82F6' }, // Deep Navy
  { base: '#1E3A7A', light: '#335EB5', dark: '#0E1D42', sheen: '#5084EB', edge: '#60A5FA' }, // Navy Blue
  { base: '#2563EB', light: '#5A8EF7', dark: '#143EA8', sheen: '#8AB3FF', edge: '#93C5FD' }, // TAS Brand Blue
  { base: '#3B82F6', light: '#70A4FC', dark: '#1D53B8', sheen: '#A5C7FF', edge: '#BFDBFE' }, // Sky Blue
  { base: '#F1F5F9', light: '#FFFFFF', dark: '#CBD5E1', sheen: '#FFFFFF', edge: '#FFFFFF' }, // Silk White
  { base: '#CBD5E1', light: '#E2E8F0', dark: '#94A3B8', sheen: '#F8FAFC', edge: '#E2E8F0' }, // Silver Weave
  { base: '#1D4ED8', light: '#4676F5', dark: '#102F8A', sheen: '#739CFE', edge: '#60A5FA' }, // Royal Blue
  { base: '#0F2557', light: '#214999', dark: '#081432', sheen: '#386AC8', edge: '#3B82F6' }, // Dark TAS Blue
];

// Deterministic configurations for each of the 8 fabric pieces
const SWATCH_CONFIGS: SwatchConfig[] = [
  { seed: 31,  paletteIndex: 0, widthFactor: 0.14, arcFactor: 1.60, startAngle: 0.05,                   orbitOffset: 0.00, speedMult: 1.00 },
  { seed: 67,  paletteIndex: 3, widthFactor: 0.13, arcFactor: 1.55, startAngle: Math.PI * 0.25 + 0.08,   orbitOffset: 0.25, speedMult: 0.96 },
  { seed: 103, paletteIndex: 5, widthFactor: 0.15, arcFactor: 1.65, startAngle: Math.PI * 0.50 - 0.06,   orbitOffset: 0.50, speedMult: 1.04 },
  { seed: 139, paletteIndex: 2, widthFactor: 0.13, arcFactor: 1.50, startAngle: Math.PI * 0.75 + 0.10,   orbitOffset: 0.75, speedMult: 0.98 },
  { seed: 181, paletteIndex: 4, widthFactor: 0.15, arcFactor: 1.70, startAngle: Math.PI * 1.00 + 0.04,   orbitOffset: 1.00, speedMult: 1.02 },
  { seed: 223, paletteIndex: 1, widthFactor: 0.14, arcFactor: 1.55, startAngle: Math.PI * 1.25 - 0.08,   orbitOffset: 1.25, speedMult: 0.95 },
  { seed: 269, paletteIndex: 6, widthFactor: 0.14, arcFactor: 1.60, startAngle: Math.PI * 1.50 + 0.06,   orbitOffset: 1.50, speedMult: 1.05 },
  { seed: 311, paletteIndex: 7, widthFactor: 0.13, arcFactor: 1.50, startAngle: Math.PI * 1.75 - 0.05,   orbitOffset: 1.75, speedMult: 0.97 },
];

// ============================================================
// UTILITY MATH
// ============================================================

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================
// PWA & PREFERENCE DETECTION
// ============================================================

function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // URL override for testing/preview: ?splash=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('splash') === '1' || params.get('splash') === 'true') return true;

    // Standard PWA standalone detection
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if ((navigator as any).standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
  } catch { /* noop */ }
  return false;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ============================================================
// CLOTH STREAMER RENDERER
// Draws a flowing, folding silk swatch along its orbital arc
// ============================================================

function drawClothStreamer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  vmin: number,
  startAngle: number,
  arcLength: number,
  radius: number,
  width: number,
  palette: ClothColorPalette,
  seed: number,
  timeSec: number,
  opacity: number,
  dpr: number,
) {
  if (opacity <= 0.01) return;

  const numSteps = 26;
  const leftPts: { x: number; y: number }[] = [];
  const rightPts: { x: number; y: number }[] = [];
  const midPts: { x: number; y: number }[] = [];
  const fold1Pts: { x: number; y: number }[] = [];
  const fold2Pts: { x: number; y: number }[] = [];

  for (let s = 0; s <= numSteps; s++) {
    const u = s / numSteps; // 0 = leading head, 1 = trailing hem
    const theta = startAngle + (1 - u) * arcLength;

    // Dynamic wave ripple along length (grows in amplitude toward trailing tail)
    const wave = Math.sin(u * 7.5 - timeSec * 6.5 + seed) * (vmin * 0.022) * (0.25 + 0.75 * u);
    const r = radius + wave;

    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    midPts.push({ x: px, y: py });

    // Normal vector perpendicular to the orbital arc
    const nx = Math.cos(theta);
    const ny = Math.sin(theta);

    // Natural fabric width profile: tapered at head, billowing body, fluttering tail
    const widthFactor = Math.sin(Math.pow(u, 0.45) * Math.PI);
    const curW = widthFactor * width * (0.88 + 0.12 * Math.sin(u * 14 + seed));
    const halfW = curW * 0.5;

    // High frequency flutter at trailing hem
    const flutter = Math.sin(timeSec * 16 + u * 12 + seed) * (u > 0.6 ? (u - 0.6) * 12 : 0);

    leftPts.push({ x: px + nx * (halfW + flutter), y: py + ny * (halfW + flutter) });
    rightPts.push({ x: px - nx * (halfW - flutter), y: py - ny * (halfW - flutter) });
    fold1Pts.push({ x: px + nx * halfW * 0.35, y: py + ny * halfW * 0.35 });
    fold2Pts.push({ x: px - nx * halfW * 0.35, y: py - ny * halfW * 0.35 });
  }

  // ── 1. Soft Ambient Drop Shadow on canvas ──
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(10, 18, 36, 0.26)';
  ctx.shadowBlur = 16 * dpr;
  ctx.shadowOffsetX = 3 * dpr;
  ctx.shadowOffsetY = 6 * dpr;
  ctx.fillStyle = palette.base;

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Reference points for gradient vector across width
  const midIdx = Math.floor(numSteps * 0.45);
  const gradX1 = leftPts[midIdx].x * dpr;
  const gradY1 = leftPts[midIdx].y * dpr;
  const gradX2 = rightPts[midIdx].x * dpr;
  const gradY2 = rightPts[midIdx].y * dpr;

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── 2. Full Silk Base Layer with 3 Dynamic Folds ──
  const silkGrad = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2);
  silkGrad.addColorStop(0.00, palette.light);
  silkGrad.addColorStop(0.25, palette.sheen);
  silkGrad.addColorStop(0.48, palette.dark);  // Fold Valley Shadow
  silkGrad.addColorStop(0.72, palette.sheen); // Fold Ridge Highlight
  silkGrad.addColorStop(1.00, palette.base);
  ctx.fillStyle = silkGrad;

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.fill();

  // ── 3. Internal Crease Ridge 1 (Specular Silk Highlight) ──
  ctx.strokeStyle = palette.sheen;
  ctx.globalAlpha = opacity * 0.60;
  ctx.lineWidth = 1.3 * dpr;
  ctx.beginPath();
  ctx.moveTo(fold1Pts[0].x * dpr, fold1Pts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(fold1Pts[i].x * dpr, fold1Pts[i].y * dpr);
  ctx.stroke();

  // ── 4. Internal Fold Valley (Deep Crease Shadow) ──
  ctx.strokeStyle = palette.dark;
  ctx.globalAlpha = opacity * 0.48;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(midPts[0].x * dpr, midPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(midPts[i].x * dpr, midPts[i].y * dpr);
  ctx.stroke();

  // ── 5. Internal Crease Ridge 2 (Specular Silk Highlight) ──
  ctx.strokeStyle = palette.sheen;
  ctx.globalAlpha = opacity * 0.52;
  ctx.lineWidth = 1.2 * dpr;
  ctx.beginPath();
  ctx.moveTo(fold2Pts[0].x * dpr, fold2Pts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(fold2Pts[i].x * dpr, fold2Pts[i].y * dpr);
  ctx.stroke();

  // ── 6. Fine Selvage / Edge Hem ──
  ctx.strokeStyle = palette.edge;
  ctx.globalAlpha = opacity * 0.42;
  ctx.lineWidth = 0.9 * dpr;
  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SplashScreen() {
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number>(0);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Exit handler ──
  const handleExit = useCallback(() => {
    setExiting(true);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('tas-pwa-splash');
    }
    exitTimerRef.current = setTimeout(() => {
      setDismissed(true);
      setExiting(false);
      setActive(false);
    }, 285);
  }, []);

  // ── Mount: check PWA standalone mode & session storage ──
  useEffect(() => {
    const isSplashTest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('splash') === '1';
    const alreadyShown = sessionStorage.getItem('tas-splash-shown');

    if (alreadyShown && !isSplashTest) {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('tas-pwa-splash');
      }
      setDismissed(true);
      return;
    }

    if (!isPWAMode()) {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('tas-pwa-splash');
      }
      setDismissed(true);
      return;
    }

    if (!isSplashTest) {
      sessionStorage.setItem('tas-splash-shown', '1');
    }

    const isReduced = prefersReducedMotion();
    setReducedMotion(isReduced);
    setActive(true);

    // Hard fallback: never let splash lock the screen longer than 3.2s
    const safetyTimeout = setTimeout(() => {
      handleExit();
    }, 3200);

    return () => {
      clearTimeout(safetyTimeout);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [handleExit]);

  // ── Reduced-motion mode ──
  useEffect(() => {
    if (!active || !reducedMotion) return;

    if (logoRef.current) {
      logoRef.current.classList.add('tas-splash-logo-reveal');
    }
    setShowLogo(true);
    const t2 = setTimeout(() => handleExit(), 850);

    return () => {
      clearTimeout(t2);
    };
  }, [active, reducedMotion, handleExit]);

  // ── Full Fabric Animation (Canvas) ──
  useEffect(() => {
    if (!active || reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      if (logoRef.current) logoRef.current.classList.add('tas-splash-logo-reveal');
      setShowLogo(true);
      const fb = setTimeout(() => handleExit(), 900);
      return () => clearTimeout(fb);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (logoRef.current) logoRef.current.classList.add('tas-splash-logo-reveal');
      setShowLogo(true);
      const fb = setTimeout(() => handleExit(), 900);
      return () => clearTimeout(fb);
    }

    // Hi-DPI setup
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;

    const cx = vw / 2;
    const cy = vh / 2;
    const vmin = Math.min(vw, vh);

    const startTime = performance.now();
    let logoRevealed = false;

    // ── Animation Loop ──
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const timeSec = elapsed / 1000;

      // Clear frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Sequence Timings:
      // 0.0 - 0.3s: Entry from edges
      // 0.3 - 1.0s: Inward flight curving into orbit
      // 1.0 - 1.5s: Form circular vortex ring
      // 1.5 - 1.9s: Vortex tightens inward
      // 1.9 - 2.2s: Fabric swirls into center & dissolves
      // 1.9 - 2.5s: Large official TAS logo reveals & settles
      // 2.5 - 2.7s: Clean logo hold
      // 2.7s+: Exit / fade out

      // Orbit radius progression
      let orbitRadius: number;
      if (elapsed < 300) {
        const t = easeOutCubic(elapsed / 300);
        orbitRadius = vmin * lerp(0.55, 0.35, t);
      } else if (elapsed < 1000) {
        const t = easeInOutQuad((elapsed - 300) / 700);
        orbitRadius = vmin * lerp(0.35, 0.26, t);
      } else if (elapsed < 1500) {
        const t = easeInOutQuad((elapsed - 1000) / 500);
        orbitRadius = vmin * lerp(0.26, 0.23, t);
      } else if (elapsed < 1900) {
        const t = easeInOutCubic((elapsed - 1500) / 400);
        orbitRadius = vmin * lerp(0.23, 0.04, t);
      } else {
        orbitRadius = vmin * 0.02;
      }

      // Orbital speed accelerates as vortex tightens (angular momentum)
      const speedRamp = elapsed > 1400 ? lerp(1.0, 2.4, clamp01((elapsed - 1400) / 500)) : 1.0;
      const baseRotation = timeSec * 2.1 * speedRamp;

      // Organization factor (swatches smoothly synchronize into a harmonious circular ring)
      const orgFactor = easeInOutQuad(clamp01((elapsed - 700) / 650));

      // Swatch width & arc length scaling
      let widthScale = 1.0;
      let arcScale = 1.0;
      if (elapsed < 300) {
        widthScale = lerp(0.7, 1.0, easeOutCubic(elapsed / 300));
        arcScale = lerp(0.8, 1.0, easeOutCubic(elapsed / 300));
      } else if (elapsed > 1550) {
        widthScale = lerp(1.0, 0.35, clamp01((elapsed - 1550) / 350));
        arcScale = lerp(1.0, 0.40, clamp01((elapsed - 1550) / 350));
      }

      // Overall cloth opacity
      let clothOpacity: number;
      if (elapsed < 250) {
        clothOpacity = easeOutCubic(elapsed / 250) * 0.96;
      } else if (elapsed < 1650) {
        clothOpacity = 0.96;
      } else if (elapsed < 1950) {
        clothOpacity = lerp(0.96, 0.35, (elapsed - 1650) / 300);
      } else {
        // Swirl into center and dissolve cleanly as logo emerges
        clothOpacity = Math.max(0, lerp(0.35, 0, clamp01((elapsed - 1950) / 180)));
      }

      if (clothOpacity > 0.01) {
        for (let i = 0; i < NUM_PIECES; i++) {
          const cfg = SWATCH_CONFIGS[i];
          const palette = PALETTES[cfg.paletteIndex];

          // Angular position: blends from independent entry angles to synchronized vortex ring
          const freeAngle = cfg.startAngle + baseRotation * cfg.speedMult;
          const ringAngle = (i / NUM_PIECES) * Math.PI * 2 + baseRotation;
          const currentAngle = lerp(freeAngle, ringAngle, orgFactor * 0.88);

          // Overlapping arc length around circumference
          const arcLength = ((Math.PI * 2) / NUM_PIECES) * cfg.arcFactor * arcScale;
          const swatchWidth = vmin * cfg.widthFactor * widthScale;

          drawClothStreamer(
            ctx,
            cx,
            cy,
            vmin,
            currentAngle,
            arcLength,
            orbitRadius,
            swatchWidth,
            palette,
            cfg.seed,
            timeSec,
            clothOpacity,
            dpr,
          );
        }
      }

      // ── Logo reveal at 1700ms ──
      if (elapsed >= 1700 && !logoRevealed) {
        logoRevealed = true;
        if (logoRef.current) {
          logoRef.current.classList.add('tas-splash-logo-reveal');
        }
        setShowLogo(true);
      }

      // ── Exit transition trigger at 2700ms ──
      if (elapsed >= TOTAL_DURATION) {
        handleExit();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, reducedMotion, handleExit]);

  // Don't render to DOM once splash has completed or was dismissed
  if (dismissed) return null;

  return (
    <div
      className={`tas-splash-overlay${exiting ? ' tas-splash-exiting' : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      {/* Canvas for flowing textile animation */}
      {!reducedMotion && (
        <canvas ref={canvasRef} className="tas-splash-canvas" />
      )}

      {/* Large Official TAS Logo */}
      <div className="tas-splash-logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={logoRef}
          src="/tas-splash-logo.png"
          alt="TAS ERP"
          className={`tas-splash-logo${showLogo ? ' tas-splash-logo-reveal' : ''}`}
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            handleExit();
          }}
        />
      </div>
    </div>
  );
}
