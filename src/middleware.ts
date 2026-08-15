import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  RATE_LIMIT_POLICIES,
  RateLimitConfig,
} from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // 1. API Route Rate Limiting & Throttling
  if (pathname.startsWith("/api/")) {
    // Cron routes authorized by CRON_SECRET bypass general IP rate limits
    if (pathname.startsWith("/api/cron/")) {
      return supabaseResponse;
    }

    const ip = getClientIp(request);
    let policy: RateLimitConfig = RATE_LIMIT_POLICIES.QUERIES;
    let policyKey = "api_query";

    if (pathname.startsWith("/api/auth/")) {
      policy = RATE_LIMIT_POLICIES.AUTH;
      policyKey = "api_auth";
    } else if (pathname.startsWith("/api/public/bills/")) {
      policy = RATE_LIMIT_POLICIES.PUBLIC_INVOICE;
      policyKey = "api_public_invoice";
    } else if (pathname.startsWith("/api/upload/presigned")) {
      policy = RATE_LIMIT_POLICIES.UPLOAD;
      policyKey = "api_upload";
    } else if (
      pathname.startsWith("/api/reports/") ||
      pathname.startsWith("/api/settings/backup") ||
      pathname.startsWith("/api/settings/import")
    ) {
      policy = RATE_LIMIT_POLICIES.REPORTS;
      policyKey = "api_reports";
    } else if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      policy = RATE_LIMIT_POLICIES.MUTATIONS;
      policyKey = "api_mutation";
    }

    const rateKey = `${policyKey}:${ip}`;
    const rateResult = checkRateLimit(rateKey, policy);

    if (!rateResult.success) {
      return createRateLimitResponse(rateResult);
    }

    const response = NextResponse.next({ request });
    response.headers.set("X-RateLimit-Limit", rateResult.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rateResult.remaining.toString());
    response.headers.set("X-RateLimit-Reset", rateResult.resetInSeconds.toString());
    return response;
  }

  // 2. Bypass static assets, auth callbacks, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth/callback") ||
    pathname.includes(".")
  ) {
    return supabaseResponse;
  }

  // 2. Initialize Supabase SSR Client for Cookie session refreshing
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
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

  // 3. Fast auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  const isSelectCompanyPage = pathname.startsWith("/select-company");

  const isPublicPage =
    isAuthPage ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/p/");

  // 4. Redirect unauthenticated visitors to login
  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Redirect logged-in users away from auth pages
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 6. Presence check for active company cookie on authenticated routes
  if (user && !isPublicPage && !isSelectCompanyPage) {
    const activeCompanyId =
      request.cookies.get("active_company_id")?.value ||
      request.cookies.get("sb-business-id")?.value;

    if (!activeCompanyId) {
      return NextResponse.redirect(new URL("/select-company", request.url));
    }

    // Forward context headers downstream (zero DB queries in middleware)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-business-id", activeCompanyId);

    supabaseResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
