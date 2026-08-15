"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveCompanyId } from "@/lib/active-company";

/**
 * Server Action to switch active company.
 * Always validates membership server-side before updating the session cookie.
 */
export async function switchCompany(companyId: string) {
  if (!companyId) {
    throw new Error("Company ID is required");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Validate that the user is an active member of the requested company
  const { data: membership, error } = await supabase
    .from("company_members")
    .select("id, role, company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    throw new Error("You do not have active access to this company");
  }

  // 2. Set active company cookie
  setActiveCompanyId(companyId);

  // 3. Keep users.business_id in sync
  await supabase
    .from("users")
    .update({ business_id: companyId })
    .eq("id", user.id);

  // 4. Invalidate caches and redirect to dashboard
  revalidatePath("/", "layout");
  redirect("/");
}
