"use client";

/**
 * Client-Side Local Network Helper
 * 
 * Safely and asynchronously detects the client's private LAN IP (e.g. 192.168.x.x)
 * using standard browser WebRTC (RTCPeerConnection).
 * 
 * Security & Reliability:
 * - Runs 100% locally in the browser sandbox.
 * - Zero external network calls (iceServers is empty `[]`).
 * - Non-blocking (cached in memory and sessionStorage after first probe).
 * - Timeout bounded (1000ms max) to ensure zero UI delay.
 */

let cachedLocalIp: string | null = null;
let probePromise: Promise<string | null> | null = null;

const PRIVATE_IP_REGEX = /\b((192\.168\.\d{1,3}\.\d{1,3})|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))\b/;

export async function getClientLocalIp(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (cachedLocalIp) return cachedLocalIp;

  try {
    const stored = sessionStorage.getItem("tas_local_ip");
    if (stored && PRIVATE_IP_REGEX.test(stored)) {
      cachedLocalIp = stored;
      return stored;
    }
  } catch {}

  if (probePromise) return probePromise;

  probePromise = new Promise<string | null>((resolve) => {
    try {
      const RTCPeer =
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

      if (!RTCPeer) {
        resolve(null);
        return;
      }

      const pc = new RTCPeer({ iceServers: [] });
      let resolved = false;

      const finish = (ip: string | null) => {
        if (!resolved) {
          resolved = true;
          try {
            pc.close();
          } catch {}
          if (ip) {
            cachedLocalIp = ip;
            try {
              sessionStorage.setItem("tas_local_ip", ip);
              // Set lightweight non-sensitive cookie so every API call automatically carries it
              document.cookie = `tas-client-local-ip=${ip}; path=/; max-age=86400; SameSite=Lax`;
            } catch {}
          }
          resolve(ip);
        }
      };

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) {
          return;
        }
        const cand = event.candidate.candidate;
        const match = cand.match(PRIVATE_IP_REGEX);
        if (match) {
          finish(match[0]);
        }
      };

      pc.createDataChannel("");
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(null));

      // 1000ms safety timeout
      setTimeout(() => finish(null), 1000);
    } catch {
      resolve(null);
    }
  });

  return probePromise;
}

/**
 * Initializes client network detection on app load
 */
export function initClientNetworkDetection() {
  if (typeof window !== "undefined") {
    // Probe in background after initial page render (idle callback or timeout)
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => {
        getClientLocalIp();
      });
    } else {
      setTimeout(() => {
        getClientLocalIp();
      }, 500);
    }
  }
}
