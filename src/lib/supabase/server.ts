import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // Ignore cookie errors when called from Server Components
          }
        },
      },
    }
  );
}

import { headers } from "next/headers";

export async function getSessionBusinessId(): Promise<string | null> {
  // 1. Fast path: Try to read forwarded business ID from middleware headers
  try {
    const headerBusinessId = headers().get("x-business-id");
    if (headerBusinessId) {
      return headerBusinessId;
    }
  } catch (error) {
    // headers() may throw when called from static generation or non-request contexts
  }

  // 2. Fast path: Read from sb-business-id cookie set by middleware on page loads
  try {
    const cookieStore = cookies();
    const businessIdCookie = cookieStore.get("sb-business-id")?.value;
    if (businessIdCookie) {
      return businessIdCookie;
    }
  } catch (error) {
    // Ignore
  }

  // 3. Slow path: Authenticate and lookup user profile
  const supabase = createClient();

  // Use getUser() — authenticates via Supabase Auth server (reliable, not a local cookie read)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("business_id, is_active")
    .eq("id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (profile && profile.is_active !== false && profile.business_id) {
    return profile.business_id;
  }

  // 4. Fallback: fetch the first business this user owns
  const { data: firstBus } = await supabase
    .from("businesses")
    .select("id")
    .limit(1)
    .maybeSingle();

  return firstBus?.id || null;
}

