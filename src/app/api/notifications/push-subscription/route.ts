import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, fcmToken } = body;

    let endpointToSave: string | null = null;
    let p256dhToSave: string = "fcm";
    let authToSave: string = "fcm";

    if (subscription && subscription.endpoint) {
      endpointToSave = subscription.endpoint;
      p256dhToSave = subscription.keys?.p256dh || "fcm";
      authToSave = subscription.keys?.auth || "fcm";
    } else if (fcmToken) {
      endpointToSave = fcmToken.startsWith("http") ? fcmToken : `https://fcm.googleapis.com/fcm/send/${fcmToken}`;
    }

    if (!endpointToSave) {
      return NextResponse.json({ error: "Invalid Web Push or FCM token format" }, { status: 400 });
    }

    const { error } = await supabase
      .from("web_push_subscriptions")
      .upsert(
        {
          business_id: businessId,
          user_id: user.id,
          endpoint: endpointToSave,
          p256dh: p256dhToSave,
          auth: authToSave,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save push subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("web_push_subscriptions")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to disable push subscription" },
      { status: 500 }
    );
  }
}
