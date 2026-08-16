import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalise raw IP strings from headers / socket.
 *  ::1             → 127.0.0.1   (IPv6 loopback)
 *  ::ffff:1.2.3.4  → 1.2.3.4     (IPv4-mapped IPv6)
 *  anything else   → as-is
 */
function normaliseIp(raw: string): string {
  const ip = raw.trim();
  if (ip === "::1") return "127.0.0.1";
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  return ip;
}

/**
 * Returns true when the IP is a private / loopback address that should NOT
 * be stored as the real client IP (these appear when running locally or when
 * the proxy itself is the originator).
 */
function isPrivateOrLoopback(ip: string): boolean {
  if (!ip) return true;
  // Loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  // IPv4 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  // Link-local
  if (/^169\.254\./.test(ip)) return true;
  // IPv6 private / link-local
  if (/^f[cd]/i.test(ip)) return true;  // fc00::/7  ULA
  if (/^fe80:/i.test(ip)) return true;  // fe80::/10 link-local
  return false;
}

/**
 * Extract the best (most public) IP from an `x-forwarded-for` value.
 * XFF is a comma-separated list: [client, proxy1, proxy2 …].
 * We take the LEFT-MOST IP that is not a private/loopback address.
 * If all are private (local dev), we return the raw leftmost.
 */
function extractBestIpFromXff(xff: string): string {
  const candidates = xff.split(",").map((s) => normaliseIp(s.trim()));
  // Pick the first public IP
  const pub = candidates.find((ip) => !isPrivateOrLoopback(ip));
  return pub ?? candidates[0];
}

/**
 * logAudit — write one row to the central audit_log table.
 *
 * Uses the service-role admin client for the INSERT so that it always
 * succeeds regardless of RLS (audit writes are a trusted server-side
 * operation). The user identity is still resolved from the authenticated
 * session client so we get the correct user_id / user_name.
 *
 * @param businessId      Tenant business ID
 * @param action          e.g. "create", "update", "sync_and_reconcile"
 * @param tableName       e.g. "sale_bills", "stock_integrity"
 * @param recordId        Primary key or a descriptive slug for the record
 * @param newValues       Snapshot of new / current values
 * @param oldValues       Snapshot of previous values (empty for create)
 * @param reqOrHeaders    The originating Request or Headers – used for IP & UA
 * @param supabaseClient  Optional authenticated client; if omitted a fresh one
 *                        is created from cookies.
 */
export async function logAudit(
  businessId: string,
  action: string,
  tableName: string,
  recordId: string | null,
  newValues: any,
  oldValues: any = {},
  reqOrHeaders?: Request | Headers,
  supabaseClient?: SupabaseClient
) {
  try {
    // ── Resolve user identity from authenticated session ──────────────────────
    // We use the caller's client (has session cookie) or create one.
    // The admin client bypasses RLS but has no session, so we resolve the
    // user separately.
    const sessionClient: SupabaseClient = supabaseClient ?? createClient();
    const {
      data: { session },
    } = await sessionClient.auth.getSession();
    const user = session?.user;

    // ── Resolve IP address & user-agent ──────────────────────────────────────
    // Priority order (most reliable → least reliable):
    //   1. cf-connecting-ip          (Cloudflare — single verified client IP)
    //   2. x-vercel-forwarded-for    (Vercel edge — verified client IP)
    //   3. x-real-ip                 (nginx / standard proxy)
    //   4. true-client-ip            (Akamai / CDN)
    //   5. fastly-client-ip          (Fastly CDN)
    //   6. x-forwarded-for           (de-facto standard, pick leftmost public IP)
    //   7. x-client-ip               (legacy)
    //   8. Next.js headers() fallback (always attempt)
    let ipAddress = "unknown";
    let userAgent = "unknown";

    let reqHeaders: Headers | null = null;

    if (reqOrHeaders) {
      if (
        "headers" in reqOrHeaders &&
        typeof (reqOrHeaders as Request).headers?.get === "function"
      ) {
        reqHeaders = (reqOrHeaders as Request).headers;
      } else if (typeof (reqOrHeaders as Headers).get === "function") {
        reqHeaders = reqOrHeaders as Headers;
      }
    }

    // Always also try Next.js request headers() — in Next.js App Router routes
    // this contains the full set of incoming headers including proxies.
    // Merge: explicit reqOrHeaders takes priority over the global headers().
    let nextReqHeaders: Headers | null = null;
    try {
      nextReqHeaders = await headers();
    } catch {
      // Called outside request scope (e.g. static generation or pure Node job)
    }

    // Merge helper — prefer reqHeaders values, fall back to nextReqHeaders
    const getHeader = (name: string): string | null =>
      reqHeaders?.get(name) ?? nextReqHeaders?.get(name) ?? null;

    const cfConnectingIp  = getHeader("cf-connecting-ip");
    const vercelForwarded = getHeader("x-vercel-forwarded-for");
    const xRealIp         = getHeader("x-real-ip");
    const trueClientIp    = getHeader("true-client-ip");
    const fastlyClientIp  = getHeader("fastly-client-ip");
    const xForwardedFor   = getHeader("x-forwarded-for");
    const xClientIp       = getHeader("x-client-ip");
    const ua              = getHeader("user-agent");

    if (cfConnectingIp) {
      ipAddress = normaliseIp(cfConnectingIp);
    } else if (vercelForwarded) {
      ipAddress = extractBestIpFromXff(vercelForwarded);
    } else if (xRealIp) {
      ipAddress = normaliseIp(xRealIp);
    } else if (trueClientIp) {
      ipAddress = normaliseIp(trueClientIp);
    } else if (fastlyClientIp) {
      ipAddress = normaliseIp(fastlyClientIp);
    } else if (xForwardedFor) {
      ipAddress = extractBestIpFromXff(xForwardedFor);
    } else if (xClientIp) {
      ipAddress = normaliseIp(xClientIp);
    }

    // ── Check for Client Local Private LAN IP (e.g. 192.168.x.x) ────────────
    // Strictly validated against private IPv4 RFC 1918 range to prevent injection
    const clientLocalIpHeader = getHeader("x-client-local-ip");
    const rawCookie = getHeader("cookie") || "";
    const localIpFromCookie = rawCookie.match(/(?:^|;\s*)tas-client-local-ip=([^;]+)/)?.[1];
    const candidateLocalIp = clientLocalIpHeader || localIpFromCookie;

    const isValidPrivateIp = (ip: string) =>
      /^(192\.168|10\.|172\.(1[6-9]|2\d|3[0-1]))\.\d{1,3}\.\d{1,3}$/.test(ip);

    if (candidateLocalIp && isValidPrivateIp(candidateLocalIp.trim())) {
      const cleanLocal = candidateLocalIp.trim();
      if (ipAddress !== cleanLocal && ipAddress !== "unknown" && ipAddress !== "127.0.0.1") {
        ipAddress = `${ipAddress} (LAN: ${cleanLocal})`;
      } else if (ipAddress === "unknown" || ipAddress === "127.0.0.1") {
        ipAddress = cleanLocal;
      }
    }

    if (ua) userAgent = ua;

    // ── Insert via service-role admin client (bypasses RLS) ──────────────────
    // This is intentional: audit logging is a trusted server-side write.
    // The data written is already validated and the user identity is resolved
    // above from the session, not from the client making the insert.
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name:
        user?.user_metadata?.full_name || user?.email || "System",
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error("logAudit insert error:", error.message, error.details);
    }
  } catch (err) {
    console.error("Failed to log audit:", err);
  }
}
