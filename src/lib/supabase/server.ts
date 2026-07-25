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
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  let candidateId: string | null = null;

  // 1. Try to read the forwarded business ID from headers (middleware)
  try {
    const headerBusinessId = headers().get("x-business-id");
    if (headerBusinessId) {
      candidateId = headerBusinessId;
    }
  } catch (error) {
    // headers() may throw when called from static generation or non-request contexts
  }

  // 2. Resolve from user profile if not in header
  if (!candidateId && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("business_id, is_active")
      .eq("id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (profile && profile.is_active !== false) {
      candidateId = profile.business_id;
    }
  }

  // 3. Verify candidateId actually exists in public.businesses table to satisfy FK constraints
  if (candidateId) {
    const { data: validBus } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", candidateId)
      .limit(1)
      .maybeSingle();

    if (validBus) return validBus.id;
  }

  // 4. Fallback: if candidateId is invalid/missing, fetch the primary business record in DB
  const { data: firstBus } = await supabase
    .from("businesses")
    .select("id")
    .limit(1)
    .maybeSingle();

  return firstBus?.id || null;
}
