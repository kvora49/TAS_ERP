import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const reqStart = Date.now();
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Bypass paths - API routes handle their own auth, never redirect to HTML
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/callback") ||
    pathname.includes(".")
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const authStart = Date.now();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const authDuration = Date.now() - authStart;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  const isPublicPage =
    isAuthPage ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/p/");

  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If authenticated, forward user context via request headers
  if (session) {
    let businessId: string | undefined = request.cookies.get("sb-business-id")?.value;

    if (businessId) {
      const { data: validBus } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", businessId)
        .limit(1)
        .maybeSingle();

      if (!validBus) businessId = undefined;
    }

    if (!businessId) {
      const { data: profile } = await supabase
        .from("users")
        .select("business_id")
        .eq("id", session.user.id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (profile?.business_id) {
        businessId = profile.business_id;
      }
    }

    if (!businessId) {
      const { data: firstBus } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (firstBus?.id) {
        businessId = firstBus.id;
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.user.id);
    if (businessId) {
      requestHeaders.set("x-business-id", businessId);
    }

    supabaseResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    if (businessId) {
      supabaseResponse.cookies.set("sb-business-id", businessId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
