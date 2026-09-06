'use client';

import React, { useEffect, useRef, useState } from 'react';

// ============================================================
// TYPES & PALETTES
// Exact luxury textile brand palette from approved TAS splash
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
  widthFactor: number;
  arcFactor: number;
  startAngle: number;
}

const PALETTES: ClothColorPalette[] = [
  { base: '#0B1D3A', light: '#1F3C70', dark: '#040B18', sheen: '#2E599C', edge: '#3B82F6' }, // 0: Deep Navy
  { base: '#1E3A7A', light: '#335EB5', dark: '#0E1D42', sheen: '#5084EB', edge: '#60A5FA' }, // 1: Navy Blue
  { base: '#2563EB', light: '#5A8EF7', dark: '#143EA8', sheen: '#8AB3FF', edge: '#93C5FD' }, // 2: TAS Brand Blue
  { base: '#3B82F6', light: '#70A4FC', dark: '#1D53B8', sheen: '#A5C7FF', edge: '#BFDBFE' }, // 3: Sky Blue
  { base: '#F1F5F9', light: '#FFFFFF', dark: '#CBD5E1', sheen: '#FFFFFF', edge: '#FFFFFF' }, // 4: Silk White
  { base: '#CBD5E1', light: '#E2E8F0', dark: '#94A3B8', sheen: '#F8FAFC', edge: '#E2E8F0' }, // 5: Silver Weave
  { base: '#1D4ED8', light: '#4676F5', dark: '#102F8A', sheen: '#739CFE', edge: '#60A5FA' }, // 6: Royal Blue
  { base: '#0F2557', light: '#214999', dark: '#081432', sheen: '#386AC8', edge: '#3B82F6' }, // 7: Dark TAS Blue
];

// Full 8-piece harmonious circular textile ring (uniform angular lockstep)
const LOADER_SWATCHES: SwatchConfig[] = [
  { seed: 31,  paletteIndex: 0, widthFactor: 0.165, arcFactor: 1.62, startAngle: (Math.PI * 2 / 8) * 0 },
  { seed: 67,  paletteIndex: 3, widthFactor: 0.155, arcFactor: 1.58, startAngle: (Math.PI * 2 / 8) * 1 },
  { seed: 103, paletteIndex: 5, widthFactor: 0.170, arcFactor: 1.65, startAngle: (Math.PI * 2 / 8) * 2 },
  { seed: 139, paletteIndex: 2, widthFactor: 0.160, arcFactor: 1.55, startAngle: (Math.PI * 2 / 8) * 3 },
  { seed: 181, paletteIndex: 4, widthFactor: 0.170, arcFactor: 1.68, startAngle: (Math.PI * 2 / 8) * 4 },
  { seed: 223, paletteIndex: 1, widthFactor: 0.160, arcFactor: 1.60, startAngle: (Math.PI * 2 / 8) * 5 },
  { seed: 269, paletteIndex: 6, widthFactor: 0.165, arcFactor: 1.62, startAngle: (Math.PI * 2 / 8) * 6 },
  { seed: 311, paletteIndex: 7, widthFactor: 0.155, arcFactor: 1.56, startAngle: (Math.PI * 2 / 8) * 7 },
];

function drawClothStreamer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  startAngle: number,
  arcLength: number,
  radius: number,
  width: number,
  palette: ClothColorPalette,
  seed: number,
  timeSec: number,
  isDark: boolean,
  dpr: number,
) {
  const numSteps = 28;
  const leftPts: { x: number; y: number }[] = [];
  const rightPts: { x: number; y: number }[] = [];
  const midPts: { x: number; y: number }[] = [];
  const fold1Pts: { x: number; y: number }[] = [];
  const fold2Pts: { x: number; y: number }[] = [];

  for (let s = 0; s <= numSteps; s++) {
    const u = s / numSteps; // 0 = leading head, 1 = trailing hem
    const theta = startAngle + (1 - u) * arcLength;

    // Organic harmonic wave ripple along length
    const wave = Math.sin(u * 6.8 - timeSec * 5.8 + seed) * (size * 0.026) * (0.2 + 0.8 * u);
    const r = radius + wave;

    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    midPts.push({ x: px, y: py });

    const nx = Math.cos(theta);
    const ny = Math.sin(theta);

    // Natural fabric width profile: tapered head, full billowing body, delicate tail
    const widthFactor = Math.sin(Math.pow(u, 0.45) * Math.PI);
    const curW = widthFactor * width * (0.92 + 0.08 * Math.sin(u * 12 + seed));
    const halfW = curW * 0.5;

    // Flutter ripple near trailing edge
    const flutter = Math.sin(timeSec * 12 + u * 10 + seed) * (u > 0.6 ? (u - 0.6) * 3.5 : 0);

    leftPts.push({ x: px + nx * (halfW + flutter), y: py + ny * (halfW + flutter) });
    rightPts.push({ x: px - nx * (halfW - flutter), y: py - ny * (halfW - flutter) });
    fold1Pts.push({ x: px + nx * halfW * 0.36, y: py + ny * halfW * 0.36 });
    fold2Pts.push({ x: px - nx * halfW * 0.36, y: py - ny * halfW * 0.36 });
  }

  // ── 1. Soft Ambient Depth Shadow ──
  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(2, 6, 23, 0.60)' : 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = (isDark ? 14 : 16) * dpr;
  ctx.shadowOffsetX = 1.5 * dpr;
  ctx.shadowOffsetY = 4.0 * dpr;
  ctx.fillStyle = palette.base;

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Gradient vector across swatch width
  const midIdx = Math.floor(numSteps * 0.45);
  const gradX1 = leftPts[midIdx].x * dpr;
  const gradY1 = leftPts[midIdx].y * dpr;
  const gradX2 = rightPts[midIdx].x * dpr;
  const gradY2 = rightPts[midIdx].y * dpr;

  ctx.save();

  // ── 2. Full Silk Base Layer with 3 Dynamic Crease Folds ──
  const silkGrad = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2);
  silkGrad.addColorStop(0.00, palette.light);
  silkGrad.addColorStop(0.24, palette.sheen);
  silkGrad.addColorStop(0.48, palette.dark);  // Fold Valley Shadow
  silkGrad.addColorStop(0.74, palette.sheen); // Fold Ridge Highlight
  silkGrad.addColorStop(1.00, palette.base);
  ctx.fillStyle = silkGrad;

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.fill();

  // ── 3. Crease Ridge 1 (Specular Silk Luster) ──
  ctx.strokeStyle = palette.sheen;
  ctx.globalAlpha = 0.70;
  ctx.lineWidth = 1.4 * dpr;
  ctx.beginPath();
  ctx.moveTo(fold1Pts[0].x * dpr, fold1Pts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(fold1Pts[i].x * dpr, fold1Pts[i].y * dpr);
  ctx.stroke();

  // ── 4. Crease Valley (Deep Fabric Shadow) ──
  ctx.strokeStyle = palette.dark;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.6 * dpr;
  ctx.beginPath();
  ctx.moveTo(midPts[0].x * dpr, midPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(midPts[i].x * dpr, midPts[i].y * dpr);
  ctx.stroke();

  // ── 5. Crease Ridge 2 (Secondary Specular Luster) ──
  ctx.strokeStyle = palette.sheen;
  ctx.globalAlpha = 0.60;
  ctx.lineWidth = 1.3 * dpr;
  ctx.beginPath();
  ctx.moveTo(fold2Pts[0].x * dpr, fold2Pts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(fold2Pts[i].x * dpr, fold2Pts[i].y * dpr);
  ctx.stroke();

  // ── 6. Fine Selvage Hem / Woven Edge ──
  ctx.strokeStyle = palette.edge;
  ctx.globalAlpha = 0.50;
  ctx.lineWidth = 1.0 * dpr;
  ctx.beginPath();
  ctx.moveTo(leftPts[0].x * dpr, leftPts[0].y * dpr);
  for (let i = 1; i <= numSteps; i++) ctx.lineTo(leftPts[i].x * dpr, leftPts[i].y * dpr);
  for (let i = numSteps; i >= 0; i--) ctx.lineTo(rightPts[i].x * dpr, rightPts[i].y * dpr);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// COMPONENT: TASFabricLoader
// Responsive, theme-aware, continuous revolving silk loop
// ============================================================

interface TASFabricLoaderProps {
  size?: number; // Optional explicit size; if omitted, automatically adapts to viewport
  className?: string;
  showText?: boolean;
}

export default function TASFabricLoader({
  size,
  className = '',
  showText = true,
}: TASFabricLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [actualSize, setActualSize] = useState<number>(size || 120);
  const [isDark, setIsDark] = useState<boolean>(false);

  // ── 1. Automatic Responsive Sizing & Theme Detection ──
  useEffect(() => {
    const updateDimensionsAndTheme = () => {
      // Dynamic responsive sizing:
      // Mobile (<640px): 92px
      // Tablet (640-1024px): 110px
      // Desktop (>1024px): 132px (Substantial, luxurious, confident)
      if (!size) {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        if (vw < 640) {
          setActualSize(92);
        } else if (vw < 1024) {
          setActualSize(110);
        } else {
          setActualSize(132);
        }
      } else {
        setActualSize(size);
      }

      // Theme detection (supports data-theme="dark", .dark class, or OS preference)
      if (typeof document !== 'undefined') {
        const hasDarkClass = document.documentElement.classList.contains('dark');
        const hasDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(hasDarkClass || hasDarkTheme || prefersDark);
      }
    };

    updateDimensionsAndTheme();
    window.addEventListener('resize', updateDimensionsAndTheme);

    // Observer for real-time theme attribute changes without reload
    const observer = new MutationObserver(updateDimensionsAndTheme);
    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
    }

    return () => {
      window.removeEventListener('resize', updateDimensionsAndTheme);
      observer.disconnect();
    };
  }, [size]);

  // ── 2. Canvas Animation Loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = actualSize * dpr;
    canvas.height = actualSize * dpr;

    const cx = actualSize / 2;
    const cy = actualSize / 2;
    // Radius and width tuned for full, thick ribbons with zero hollow gaps
    const radius = actualSize * 0.30;
    const swatchWidth = actualSize * 0.17;
    const arcLength = (Math.PI * 2 / LOADER_SWATCHES.length) * 1.62;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const timeSec = elapsed / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle ambient center glow
      const centerGlow = ctx.createRadialGradient(
        cx * dpr,
        cy * dpr,
        0,
        cx * dpr,
        cy * dpr,
        radius * 1.4 * dpr
      );
      if (isDark) {
        centerGlow.addColorStop(0.0, 'rgba(99, 102, 241, 0.12)');
        centerGlow.addColorStop(0.7, 'rgba(30, 58, 122, 0.04)');
        centerGlow.addColorStop(1.0, 'rgba(15, 23, 42, 0)');
      } else {
        centerGlow.addColorStop(0.0, 'rgba(99, 102, 241, 0.08)');
        centerGlow.addColorStop(0.7, 'rgba(219, 234, 254, 0.03)');
        centerGlow.addColorStop(1.0, 'rgba(241, 245, 249, 0)');
      }
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Silky smooth, continuous 360° circular revolving rotation
      const baseRotation = timeSec * 2.2;

      for (let i = 0; i < LOADER_SWATCHES.length; i++) {
        const cfg = LOADER_SWATCHES[i];
        const palette = PALETTES[cfg.paletteIndex];
        // Lock angular speed across all swatches so the ring remains permanently balanced with zero drift
        const currentAngle = cfg.startAngle + baseRotation;

        drawClothStreamer(
          ctx,
          cx,
          cy,
          actualSize,
          currentAngle,
          arcLength,
          radius,
          swatchWidth,
          palette,
          cfg.seed,
          timeSec,
          isDark,
          dpr
        );
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [actualSize, isDark]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center select-none ${className}`}
      role="status"
      aria-label="Syncing ERP workspace"
    >
      {/* Revolving Canvas Ring */}
      <div
        className="relative flex items-center justify-center pointer-events-none"
        style={{ width: actualSize, height: actualSize }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: actualSize, height: actualSize }}
          className="block"
        />
      </div>

      {/* Clean Status Label */}
      {showText && (
        <div className="flex items-center justify-center gap-2 mt-5 sm:mt-6 text-center select-none">
          <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-[var(--text-muted)]">
            Syncing ERP Workspace...
          </span>
        </div>
      )}
    </div>
  );
}
