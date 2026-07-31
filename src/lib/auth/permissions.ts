import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export type PermissionAction =
  | "can_view"
  | "can_add"
  | "can_edit"
  | "can_delete"
  | "can_approve"
  | "can_export";

export async function verifyModulePermission(
  moduleName: string,
  action: PermissionAction = "can_view"
): Promise<{ allowed: boolean; user: any; businessId: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, user: null, businessId: "" };
  }

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return { allowed: false, user, businessId: "" };
  }

  // Get user role from user_metadata or profiles
  const role = user.user_metadata?.role || "staff";

  // Owner & Admin have full access by default
  if (role === "owner" || role === "admin") {
    return { allowed: true, user, businessId };
  }

  const { data: perm } = await supabase
    .from("role_permissions")
    .select("*")
    .eq("business_id", businessId)
    .eq("role", role)
    .ilike("module", moduleName)
    .maybeSingle();

  if (!perm) {
    // If no permission record exists yet, allow viewing by default, restrict writes
    return {
      allowed: action === "can_view",
      user,
      businessId,
    };
  }

  return {
    allowed: !!perm[action],
    user,
    businessId,
  };
}
