import { NextRequest, NextResponse } from "next/server";
import { sendLockScreenPushNotification } from "@/lib/firebase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { token, title, body: messageBody, url, tag } = body;

    if (!token || !title || !messageBody) {
      return NextResponse.json(
        { error: "Missing required fields: token, title, and body are required." },
        { status: 400 }
      );
    }

    const result = await sendLockScreenPushNotification({
      token,
      title,
      body: messageBody,
      url: url || "/",
      tag: tag || "tas-erp-lockscreen-alert",
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Lock screen push notification dispatched successfully.",
    });
  } catch (err: any) {
    console.error("[API Notifications Push] Internal Server Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error dispatching push notification" },
      { status: 500 }
    );
  }
}
