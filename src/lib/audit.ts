import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function logAudit(
  businessId: string,
  action: string,
  tableName: string,
  recordId: string,
  newValues: any,
  oldValues: any = {},
  reqOrHeaders?: Request | Headers
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  let ipAddress = "127.0.0.1";
  let userAgent = "Unknown Client";

  try {
    let reqHeaders: Headers | null = null;
    if (reqOrHeaders) {
      if ("headers" in reqOrHeaders && typeof (reqOrHeaders as Request).headers?.get === "function") {
        reqHeaders = (reqOrHeaders as Request).headers;
      } else if (typeof (reqOrHeaders as Headers).get === "function") {
        reqHeaders = reqOrHeaders as Headers;
      }
    }

    if (!reqHeaders) {
      try {
        const h = await headers();
        reqHeaders = h;
      } catch {
        // Called outside request scope or during static generation
      }
    }

    if (reqHeaders) {
      const xForwardedFor = reqHeaders.get("x-forwarded-for");
      const xRealIp = reqHeaders.get("x-real-ip");
      const cfConnectingIp = reqHeaders.get("cf-connecting-ip");
      const xClientIp = reqHeaders.get("x-client-ip");
      const ua = reqHeaders.get("user-agent");

      if (xForwardedFor) {
        ipAddress = xForwardedFor.split(",")[0].trim();
      } else if (xRealIp) {
        ipAddress = xRealIp.trim();
      } else if (cfConnectingIp) {
        ipAddress = cfConnectingIp.trim();
      } else if (xClientIp) {
        ipAddress = xClientIp.trim();
      }

      if (ua) {
        userAgent = ua;
      }
    }

    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("Failed to log audit:", err);
  }
}

