import { NextRequest, NextResponse } from "next/server";
import { sendLockScreenPushNotification } from "@/lib/firebase/admin";
import { dispatchSystemPushAlert } from "@/lib/notifications/push-dispatcher";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const businessId = await getSessionBusinessId();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !businessId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { token, title, body: messageBody, url, tag } = body;

    const pushTitle = title || "TAS ERP Mobile Alert";
    const pushMessage = messageBody || "You have a new update in your workspace.";
    const targetUrl = url || "/";
    const alertTag = tag || "tas-erp-lockscreen-alert";

    let fcmResult: any = { success: false };
    if (token) {
      fcmResult = await sendLockScreenPushNotification({
        token,
        title: pushTitle,
        body: pushMessage,
        url: targetUrl,
        tag: alertTag,
      });
    }

    const webPushResult = await dispatchSystemPushAlert({
      businessId,
      userId: user.id,
      title: pushTitle,
      message: pushMessage,
      linkUrl: targetUrl,
      tag: alertTag,
    });

    return NextResponse.json({
      success: true,
      webPushSentCount: webPushResult.sentCount || 0,
      fcmSuccess: !!fcmResult.success,
      warning: (webPushResult.sentCount === 0 && !fcmResult.success)
        ? (webPushResult.error || "No active web push subscriptions found for this user.")
        : undefined,
      message: (webPushResult.sentCount || 0) > 0
        ? `Lock screen push notification dispatched to ${webPushResult.sentCount} device(s).`
        : "Push request processed.",
    });
  } catch (err: any) {
    console.error("[API Notifications Push] Internal Server Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error dispatching push notification" },
      { status: 500 }
    );
  }
}
