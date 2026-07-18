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
  // 1. Try to read the forwarded business ID from headers (middleware)
  try {
    const headerBusinessId = headers().get("x-business-id");
    if (headerBusinessId) {
      return headerBusinessId;
    }
  } catch (error) {
    // headers() may throw when called from static generation or non-request contexts
  }

  // 2. Fallback to resolving from session cookie and database
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("business_id")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();
    
  return profile?.business_id || null;
}
