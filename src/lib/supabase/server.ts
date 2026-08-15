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
import { ACTIVE_COMPANY_COOKIE, LEGACY_BUSINESS_COOKIE } from "@/lib/active-company";

export async function getSessionBusinessId(): Promise<string | null> {
  let candidateId: string | undefined;

  // 1. Fast path: Try to read forwarded business ID from middleware headers
  try {
    const headerBusinessId = headers().get("x-business-id");
    if (headerBusinessId) {
      candidateId = headerBusinessId;
    }
  } catch (error) {
    // headers() may throw when called from static generation or non-request contexts
  }

  // 2. Fast path: Read from active company cookies
  if (!candidateId) {
    try {
      const cookieStore = cookies();
      candidateId =
        cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ||
        cookieStore.get(LEGACY_BUSINESS_COOKIE)?.value;
    } catch (error) {
      // Ignore cookie read failures in static render
    }
  }

  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return candidateId || null;
  }

  // 3. If candidate ID exists, verify user is an active member
  if (candidateId) {
    const { data: member } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", candidateId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.company_id) {
      return member.company_id;
    }
  }

  // 4. Fallback: Lookup user's first active membership in company_members
  const { data: firstMembership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstMembership?.company_id) {
    return firstMembership.company_id;
  }

  // 5. Legacy profile fallback
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

  return null;
}

