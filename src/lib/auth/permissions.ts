import { createClient } from "@/lib/supabase/server";
import { requireAuthGuard } from "@/lib/auth/guards";

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
): Promise<{ allowed: boolean; user: unknown; businessId: string }> {
  const guard = await requireAuthGuard();
  if (!guard.success) return { allowed: false, user: null, businessId: "" };
  const { user, businessId, role } = guard.ctx;
  const supabase = createClient();

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

  if (!perm) return { allowed: false, user, businessId };

  return {
    allowed: !!perm[action],
    user,
    businessId,
  };
}
