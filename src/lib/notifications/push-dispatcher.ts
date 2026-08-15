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
    const vapidPrivateKey = process.env.FIREBASE_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
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
    let isVapidConfigured = false;

    // 2. Configure VAPID details if keys are available
    if (vapidPublicKey && !vapidPublicKey.includes("placeholder")) {
      try {
        let privateKey = vapidPrivateKey || "";
        if (privateKey) {
          webPush.setVapidDetails("mailto:admin@taserp.com", vapidPublicKey, privateKey);
          isVapidConfigured = true;
        } else {
          console.warn("[Push Dispatcher] FIREBASE_VAPID_PRIVATE_KEY is missing. Background web-push requires a valid VAPID private key, will use Firebase Admin SDK for FCM endpoints.");
        }
      } catch (e: any) {
        console.warn("[Push Dispatcher] Warning setting VAPID details:", e.message);
      }
    }

    // 3. Dispatch to all active subscription endpoints
    const { sendLockScreenPushNotification } = await import("@/lib/firebase/admin");

    for (const sub of subs) {
      let dispatched = false;

      // Method A: If endpoint is Google FCM, use Firebase Admin SDK
      if (sub.endpoint.includes("fcm.googleapis.com") || sub.endpoint.includes("googleapis.com")) {
        try {
          const fcmToken = sub.endpoint.includes("/fcm/send/")
            ? sub.endpoint.split("/fcm/send/")[1]
            : sub.endpoint;

          if (fcmToken) {
            const fcmRes = await sendLockScreenPushNotification({
              token: fcmToken,
              title,
              body: message,
              url: linkUrl || "/",
              tag: tag || "tas-erp-alert",
            });
            if (fcmRes.success) {
              sentCount++;
              dispatched = true;
            }
          }
        } catch (fcmErr: any) {
          console.warn(`[Push Dispatcher] Firebase Admin push failed for ${sub.id}:`, fcmErr.message);
        }
      }

      // Method B: If not sent via FCM and VAPID is configured, send via web-push
      if (!dispatched && isVapidConfigured) {
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
          dispatched = true;
        } catch (err: any) {
          // Clean up expired or unregistered endpoints automatically (410 Gone / 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredIds.push(sub.id);
          } else {
            console.error(`[Push Dispatcher] Web-push failed for endpoint ${sub.id}:`, err.message);
          }
        }
      }
    }

    // 4. Delete expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from("web_push_subscriptions").delete().in("id", expiredIds);
    }

    return {
      success: sentCount > 0 || subs.length === 0,
      sentCount,
      totalSubscribers: subs.length,
      warning: sentCount === 0 && subs.length > 0 && !isVapidConfigured
        ? "No notifications delivered. FCM or VAPID keys required."
        : undefined,
    };
  } catch (err: any) {
    console.error("[Push Dispatcher] Error dispatching push notification:", err);
    return { success: false, error: err.message };
  }
}
