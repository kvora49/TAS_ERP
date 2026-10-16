import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/";
  // Callback destinations are internal paths only. This prevents auth codes
  // and newly-created sessions from being forwarded to an attacker-controlled
  // origin through absolute, protocol-relative, or encoded URLs.
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? requestedNext
    : "/";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const metadata = user?.user_metadata || {};
      if (user?.email && metadata.business_name && metadata.full_name) {
        const { error: registrationError } = await supabase.rpc("fn_complete_registration", {
          p_business_name: String(metadata.business_name),
          p_full_name: String(metadata.full_name),
          p_email: user.email,
          p_phone: metadata.phone ? String(metadata.phone) : null,
        });
        if (registrationError) {
          return NextResponse.redirect(`${appOrigin}/login?error=workspace-setup-failed`);
        }
      }
      return NextResponse.redirect(new URL(next, appOrigin));
    }
  }

  // If auth fails, forward error details so the login page can guide the user
  const authError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  const redirectParams = new URLSearchParams();
  if (authError) redirectParams.set("error", authError);
  if (errorCode) redirectParams.set("error_code", errorCode);
  if (errorDescription) redirectParams.set("error_description", errorDescription);

  if (!authError && !errorCode) {
    redirectParams.set("error", "auth-callback-failed");
  }

  return NextResponse.redirect(
    `${appOrigin}/login?${redirectParams.toString()}`
  );
}
