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

const businessIdCache = new Map<string, string>();

export async function getSessionBusinessId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  let businessId = businessIdCache.get(user.id);
  if (!businessId) {
    const { data: profile } = await supabase
      .from("users")
      .select("business_id")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    if (profile?.business_id) {
      const bId: string = profile.business_id;
      businessIdCache.set(user.id, bId);
      businessId = bId;
    }
  }
  return businessId || null;
}
