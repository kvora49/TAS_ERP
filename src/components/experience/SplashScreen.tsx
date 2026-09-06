'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface FabricPiece {
  // Position & movement
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  angle: number;        // current orbital angle (radians)
  angularSpeed: number; // radians per frame
  orbitRadius: number;  // current distance from center
  startOrbitRadius: number;

  // Visual
  width: number;
  height: number;
  rotation: number;     // visual rotation of the piece
  color: string;
  opacity: number;

  // Bezier curve control offsets for organic shape
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;

  // Phase tracking
  phase: number;        // 0-6 animation phase
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const TOTAL_DURATION_MS = 2700;
const FABRIC_COLORS = [
  '#0A1A3A', // deep navy
  '#0F2557', // dark navy
  '#1E3A7A', // navy blue
  '#2563EB', // bright blue
  '#3B82F6', // medium blue
  '#60A5FA', // light blue
  '#F8FAFC', // white
  '#CBD5E1', // light gray
];
const NUM_PIECES = 8;

// Phase timings (ms)
const PHASE_APPEAR_END = 300;
const PHASE_ORBIT_START = 300;
const PHASE_ORBIT_END = 1000;
const PHASE_VORTEX_END = 1500;
const PHASE_CONTRACT_END = 1900;
const PHASE_LOGO_REVEAL_END = 2200;
const PHASE_SETTLE_END = 2500;

// ────────────────────────────────────────────────────────────
// Helper: detect PWA standalone mode
// ────────────────────────────────────────────────────────────

function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Standard display-mode check
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    // iOS Safari standalone
    if ((navigator as any).standalone === true) return true;
  } catch {
    // matchMedia may throw in some edge cases
  }
  return false;
}

// ────────────────────────────────────────────────────────────
// Helper: check reduced motion preference
// ────────────────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// Helper: initialize fabric pieces
// ────────────────────────────────────────────────────────────

function createFabricPieces(w: number, h: number): FabricPiece[] {
  const cx = w / 2;
  const cy = h / 2;
  const maxDim = Math.max(w, h);
  const pieces: FabricPiece[] = [];

  for (let i = 0; i < NUM_PIECES; i++) {
    // Start position: random edge of screen
    const edge = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
    let startX: number, startY: number;
    switch (edge) {
      case 0: startX = Math.random() * w; startY = -maxDim * 0.15; break;
      case 1: startX = w + maxDim * 0.15; startY = Math.random() * h; break;
      case 2: startX = Math.random() * w; startY = h + maxDim * 0.15; break;
      default: startX = -maxDim * 0.15; startY = Math.random() * h; break;
    }

    const angleToCenter = Math.atan2(cy - startY, cx - startX);
    const orbitRadius = maxDim * (0.25 + Math.random() * 0.15);
    const pieceScale = maxDim * 0.001; // scale factor based on viewport

    pieces.push({
      x: startX,
      y: startY,
      targetX: cx,
      targetY: cy,
      startX,
      startY,
      angle: angleToCenter + (Math.random() - 0.5) * 0.5,
      angularSpeed: (0.02 + Math.random() * 0.015) * (Math.random() > 0.5 ? 1 : -1),
      orbitRadius,
      startOrbitRadius: orbitRadius,
      width: (40 + Math.random() * 30) * pieceScale,
      height: (80 + Math.random() * 60) * pieceScale,
      rotation: Math.random() * Math.PI * 2,
      color: FABRIC_COLORS[i % FABRIC_COLORS.length],
      opacity: 0,

      // Random bezier offsets for organic shape
      cx1: (Math.random() - 0.5) * 30 * pieceScale,
      cy1: (Math.random() - 0.5) * 20 * pieceScale,
      cx2: (Math.random() - 0.5) * 30 * pieceScale,
      cy2: (Math.random() - 0.5) * 20 * pieceScale,

      phase: 0,
    });
  }

  return pieces;
}

// ────────────────────────────────────────────────────────────
// Helper: draw a single fabric piece (bezier-curved shape)
// ────────────────────────────────────────────────────────────

function drawFabricPiece(
  ctx: CanvasRenderingContext2D,
  piece: FabricPiece,
  dpr: number,
) {
  if (piece.opacity <= 0.005) return;

  ctx.save();
  ctx.globalAlpha = piece.opacity;
  ctx.translate(piece.x * dpr, piece.y * dpr);
  ctx.rotate(piece.rotation);

  const w = piece.width * dpr;
  const h = piece.height * dpr;
  const cx1 = piece.cx1 * dpr;
  const cy1 = piece.cy1 * dpr;
  const cx2 = piece.cx2 * dpr;
  const cy2 = piece.cy2 * dpr;

  // Create gradient for fabric-like depth
  const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  gradient.addColorStop(0, piece.color);
  gradient.addColorStop(0.5, lightenColor(piece.color, 15));
  gradient.addColorStop(1, piece.color);

  ctx.fillStyle = gradient;
  ctx.beginPath();

  // Organic fabric shape using bezier curves
  ctx.moveTo(-w / 2, -h / 2);
  ctx.quadraticCurveTo(-w / 2 + cx1, -h / 4 + cy1, -w / 3, 0);
  ctx.quadraticCurveTo(-w / 2 + cx2, h / 4 + cy2, -w / 2, h / 2);
  ctx.quadraticCurveTo(0 + cx1, h / 2 + cy1, w / 2, h / 2);
  ctx.quadraticCurveTo(w / 2 + cx2, h / 4 + cy2, w / 3, 0);
  ctx.quadraticCurveTo(w / 2 + cx1, -h / 4 + cy1, w / 2, -h / 2);
  ctx.quadraticCurveTo(0 + cx2, -h / 2 + cy2, -w / 2, -h / 2);
  ctx.closePath();
  ctx.fill();

  // Subtle fold line for textile feel
  ctx.strokeStyle = lightenColor(piece.color, 25);
  ctx.lineWidth = 0.5 * dpr;
  ctx.globalAlpha = piece.opacity * 0.3;
  ctx.beginPath();
  ctx.moveTo(-w / 4, -h / 2);
  ctx.quadraticCurveTo(cx1, 0, -w / 4, h / 2);
  ctx.stroke();

  ctx.restore();
}

// ────────────────────────────────────────────────────────────
// Helper: lighten a hex color
// ────────────────────────────────────────────────────────────

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r},${g},${b})`;
}

// ────────────────────────────────────────────────────────────
// Easing
// ────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const piecesRef = useRef<FabricPiece[]>([]);

  // ── Determine visibility on mount ──
  useEffect(() => {
    // Only show in PWA mode, and only once per session
    const alreadyShown = sessionStorage.getItem('tas-splash-shown');
    if (alreadyShown) return;
    if (!isPWAMode()) return;

    setReducedMotion(prefersReducedMotion());
    setVisible(true);
    sessionStorage.setItem('tas-splash-shown', '1');
  }, []);

  // ── Exit handler ──
  const handleExit = useCallback(() => {
    setExiting(true);
    // After CSS fade-out completes, remove from DOM
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 260);
  }, []);

  // ── Reduced-motion path ──
  useEffect(() => {
    if (!visible || !reducedMotion) return;

    // Simple: show logo after 200ms, hold, then exit
    const t1 = setTimeout(() => setShowLogo(true), 200);
    const t2 = setTimeout(() => handleExit(), 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible, reducedMotion, handleExit]);

  // ── Canvas animation (full motion) ──
  useEffect(() => {
    if (!visible || reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      // Canvas failed — fallback: show logo briefly then exit
      setShowLogo(true);
      const fallbackTimer = setTimeout(() => handleExit(), 800);
      return () => clearTimeout(fallbackTimer);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setShowLogo(true);
      const fallbackTimer = setTimeout(() => handleExit(), 800);
      return () => clearTimeout(fallbackTimer);
    }

    // Hi-DPI setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    // Initialize fabric pieces
    piecesRef.current = createFabricPieces(w, h);
    startTimeRef.current = performance.now();

    const cx = w / 2;
    const cy = h / 2;

    // ── Animation loop ──
    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pieces = piecesRef.current;

      for (const piece of pieces) {
        // ── Phase: Appear (0–300ms) ──
        if (elapsed < PHASE_APPEAR_END) {
          const t = easeOutCubic(elapsed / PHASE_APPEAR_END);
          piece.opacity = t * 0.85;
          piece.x = piece.startX + (cx - piece.startX) * t * 0.3;
          piece.y = piece.startY + (cy - piece.startY) * t * 0.3;
          piece.rotation += 0.01;
        }
        // ── Phase: Move toward center + begin orbit (300–1000ms) ──
        else if (elapsed < PHASE_ORBIT_END) {
          const t = easeInOutQuad((elapsed - PHASE_ORBIT_START) / (PHASE_ORBIT_END - PHASE_ORBIT_START));
          piece.opacity = 0.85;
          piece.orbitRadius = piece.startOrbitRadius * (1 - t * 0.4);
          piece.angle += piece.angularSpeed * (0.5 + t * 0.5);
          piece.x = cx + Math.cos(piece.angle) * piece.orbitRadius;
          piece.y = cy + Math.sin(piece.angle) * piece.orbitRadius;
          piece.rotation += piece.angularSpeed * 0.5;
        }
        // ── Phase: Tighten vortex (1000–1500ms) ──
        else if (elapsed < PHASE_VORTEX_END) {
          const t = easeInOutQuad((elapsed - PHASE_ORBIT_END) / (PHASE_VORTEX_END - PHASE_ORBIT_END));
          piece.opacity = 0.85;
          piece.orbitRadius = piece.startOrbitRadius * 0.6 * (1 - t * 0.45);
          piece.angle += piece.angularSpeed * (1 + t * 0.5);
          piece.x = cx + Math.cos(piece.angle) * piece.orbitRadius;
          piece.y = cy + Math.sin(piece.angle) * piece.orbitRadius;
          piece.rotation += piece.angularSpeed * 0.8;
          // Pieces become more uniformly distributed
          const targetAngle = (pieces.indexOf(piece) / pieces.length) * Math.PI * 2;
          piece.angle += (targetAngle - (piece.angle % (Math.PI * 2))) * t * 0.02;
        }
        // ── Phase: Contract inward (1500–1900ms) ──
        else if (elapsed < PHASE_CONTRACT_END) {
          const t = easeInOutQuad((elapsed - PHASE_VORTEX_END) / (PHASE_CONTRACT_END - PHASE_VORTEX_END));
          piece.orbitRadius = piece.startOrbitRadius * 0.33 * (1 - t * 0.85);
          piece.angle += piece.angularSpeed * (1.5 - t * 0.5);
          piece.x = cx + Math.cos(piece.angle) * piece.orbitRadius;
          piece.y = cy + Math.sin(piece.angle) * piece.orbitRadius;
          piece.rotation += piece.angularSpeed;
          piece.opacity = 0.85 * (1 - t * 0.6);
          // Shrink pieces
          piece.width *= (1 - 0.003 * t);
          piece.height *= (1 - 0.003 * t);
        }
        // ── Phase: Fade out fabric (1900–2200ms) ──
        else if (elapsed < PHASE_LOGO_REVEAL_END) {
          const t = (elapsed - PHASE_CONTRACT_END) / (PHASE_LOGO_REVEAL_END - PHASE_CONTRACT_END);
          piece.opacity = Math.max(0, 0.34 * (1 - t));
          piece.orbitRadius *= 0.98;
          piece.angle += piece.angularSpeed * 0.3;
          piece.x = cx + Math.cos(piece.angle) * piece.orbitRadius;
          piece.y = cy + Math.sin(piece.angle) * piece.orbitRadius;
        }
        // ── Beyond: fully invisible ──
        else {
          piece.opacity = 0;
        }

        drawFabricPiece(ctx, piece, dpr);
      }

      // ── Logo reveal trigger (at 1900ms) ──
      if (elapsed >= PHASE_CONTRACT_END && !showLogoTriggered) {
        showLogoTriggered = true;
        setShowLogo(true);
      }

      // ── Exit trigger (at 2700ms) ──
      if (elapsed >= TOTAL_DURATION_MS) {
        handleExit();
        return; // stop loop
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    let showLogoTriggered = false;
    rafRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, reducedMotion, handleExit]);

  // ── Don't render if not needed ──
  if (!visible) return null;

  return (
    <div
      className={`tas-splash-overlay ${exiting ? 'tas-splash-exiting' : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      {/* Canvas for fabric animation */}
      {!reducedMotion && (
        <canvas
          ref={canvasRef}
          className="tas-splash-canvas"
        />
      )}

      {/* Logo (revealed by animation or reduced-motion) */}
      <div className="tas-splash-logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tas-splash-logo.png"
          alt="TAS ERP"
          className={`tas-splash-logo ${showLogo ? 'tas-splash-logo-reveal' : ''}`}
          draggable={false}
          onError={(e) => {
            // Fallback: if logo fails to load, exit gracefully
            (e.target as HTMLImageElement).style.display = 'none';
            handleExit();
          }}
        />
      </div>
    </div>
  );
}
