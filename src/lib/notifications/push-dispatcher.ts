import { createClient } from "@supabase/supabase-js";

interface PushPayload {
  businessId: string;
  userId?: string;
  title: string;
  message: string;
  linkUrl?: string;
  tag?: string;
}

/**
 * Dispatches a high-priority mobile lock screen push notification to all subscribed device endpoints for a business.
 */
export async function dispatchSystemPushAlert(payload: PushPayload) {
  const { businessId, userId, title, message, linkUrl, tag } = payload;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[Push Dispatcher] Missing Supabase environment credentials.");
    return { success: false, sentCount: 0 };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch active web push subscriptions for this business (and optional user filter)
    let query = supabase
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("business_id", businessId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: subs, error } = await query;
    if (error || !subs || subs.length === 0) {
      return { success: true, sentCount: 0 };
    }

    // Dynamically import web-push to avoid server bundling errors if package is loading
    let webPush: any;
    try {
      webPush = (await import("web-push")).default || (await import("web-push"));
    } catch (_e) {
      console.warn("[Push Dispatcher] web-push module not available yet.");
      return { success: false, error: "web-push module missing" };
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const adminKeyRaw = process.env.FIREBASE_ADMIN_SDK_KEY;

    const pushContent = JSON.stringify({
      title,
      message,
      body: message,
      url: linkUrl || "/",
      link_url: linkUrl || "/",
      tag: tag || "tas-erp-alert",
      timestamp: Date.now(),
    });

    let sentCount = 0;
    const expiredIds: string[] = [];

    // Configure VAPID details if key is available
    if (vapidPublicKey && !vapidPublicKey.includes("placeholder")) {
      try {
        let privateKey = "";
        if (adminKeyRaw && !adminKeyRaw.includes("placeholder")) {
          const parsed = JSON.parse(adminKeyRaw);
          privateKey = parsed.private_key || "";
        }
        if (privateKey) {
          webPush.setVapidDetails("mailto:admin@taserp.com", vapidPublicKey, privateKey);
        }
      } catch (_e) {}
    }

    // 2. Send Web Push payload to each subscription endpoint
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushContent,
          {
            headers: {
              Urgency: "high", // Forces immediate wake-up on locked mobile screens
            },
            TTL: 86400,
          }
        );
        sentCount++;
      } catch (err: any) {
        // Clean up expired or unregistered endpoints automatically (410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        } else {
          console.error(`[Push Dispatcher] Failed to send push to endpoint ${sub.id}:`, err.message);
        }
      }
    }

    // 3. Delete expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from("web_push_subscriptions").delete().in("id", expiredIds);
    }

    return { success: true, sentCount };
  } catch (err: any) {
    console.error("[Push Dispatcher] Error dispatching push notification:", err);
    return { success: false, error: err.message };
  }
}
