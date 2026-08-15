import { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient, getSessionBusinessId } from "../supabase/server";
import { NextResponse } from "next/server";

export interface AuthContext {
  user: User;
  businessId: string;
  role: string;
}

export type GuardResult =
  | { success: true; ctx: AuthContext }
  | { success: false; response: NextResponse };

/**
 * Authenticates the caller, resolves active business_id, and optionally verifies that the caller
 * holds one of the required roles in the active company.
 */
export async function requireAuthGuard(
  allowedRoles?: string[],
  customSupabase?: SupabaseClient
): Promise<GuardResult> {
  const supabase = customSupabase || createClient();
  const businessId = await getSessionBusinessId();

  if (!businessId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized: Missing active business session", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized: User session invalid or expired", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  // Fetch membership role
  const { data: member } = await supabase
    .from("company_members")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("company_id", businessId)
    .eq("status", "active")
    .maybeSingle();

  let userRole = member?.role?.toLowerCase() || "";

  // Fallback: check profile in users table if company_members row is transitioning
  if (!userRole) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", user.id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (profile && profile.is_active !== false) {
      userRole = profile.role?.toLowerCase() || "viewer";
    }
  }

  if (!userRole) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Forbidden: You are not an active member of this company", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: `Forbidden: Action requires one of [${allowedRoles.join(", ")}] permissions. Current role: ${userRole}`,
            code: "FORBIDDEN",
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    success: true,
    ctx: {
      user,
      businessId,
      role: userRole,
    },
  };
}
