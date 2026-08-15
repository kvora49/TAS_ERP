import { NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory token storage (per server instance)
const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired tokens every 60 seconds
let lastCleanup = Date.now();
function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    rateLimitMap.forEach((record, key) => {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    });
  }
}

export interface RateLimitConfig {
  limit: number; // Max requests allowed
  windowSeconds: number; // Time window in seconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks and increments the rate limit for a specific identifier key.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const record = rateLimitMap.get(key);

  if (!record || record.resetAt <= now) {
    // New window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetInSeconds: config.windowSeconds,
    };
  }

  // Existing window
  record.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  const remaining = Math.max(0, config.limit - record.count);

  if (record.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetInSeconds,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining,
    resetInSeconds,
  };
}

/**
 * Extracts client IP from standard proxy headers
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "127.0.0.1";
}

/**
 * Generates standard 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: result.resetInSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": result.resetInSeconds.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetInSeconds.toString(),
      },
    }
  );
}

/**
 * Preset rate limit policies for different application domains
 */
export const RATE_LIMIT_POLICIES: Record<"AUTH" | "PUBLIC_INVOICE" | "UPLOAD" | "REPORTS" | "MUTATIONS" | "QUERIES", RateLimitConfig> = {
  // Strict policy for auth, registration, login (5 requests / min)
  AUTH: { limit: 5, windowSeconds: 60 },

  // Public invoice and PDF generation (20 requests / min)
  PUBLIC_INVOICE: { limit: 20, windowSeconds: 60 },

  // Presigned upload requests (30 requests / min)
  UPLOAD: { limit: 30, windowSeconds: 60 },

  // Heavy reports and analytical queries (10 requests / min)
  REPORTS: { limit: 10, windowSeconds: 60 },

  // Standard mutation routes POST / PUT / PATCH / DELETE (60 requests / min)
  MUTATIONS: { limit: 60, windowSeconds: 60 },

  // Standard query routes GET (120 requests / min)
  QUERIES: { limit: 120, windowSeconds: 60 },
};

