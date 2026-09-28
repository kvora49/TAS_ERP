import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
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
    `${origin}/login?${redirectParams.toString()}`
  );
}
