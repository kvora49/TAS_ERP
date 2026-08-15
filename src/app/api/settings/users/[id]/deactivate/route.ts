import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { user, businessId } = guard.ctx;
  const targetUserId = params.id;

  if (user.id === targetUserId) {
    return NextResponse.json(
      { error: "You cannot deactivate or suspend your own account", code: "CANNOT_DEACTIVATE_SELF" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  try {
    const { action } = await request.json().catch(() => ({ action: "deactivate" }));
    const supabaseAdmin = createAdminClient();

    if (action === "activate") {
      // 1. Activate profile
      const { error: profileError } = await supabase
        .from("users")
        .update({
          deleted_at: null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .eq("business_id", businessId);

      if (profileError) throw profileError;

      // 2. Activate company_members row
      await supabaseAdmin
        .from("company_members")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId)
        .eq("company_id", businessId);

      return NextResponse.json({ success: true, active: true });
    } else {
      // 1. Deactivate profile
      const { error: profileError } = await supabase
        .from("users")
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .eq("business_id", businessId);

      if (profileError) throw profileError;

      // 2. Suspend company_members row
      await supabaseAdmin
        .from("company_members")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId)
        .eq("company_id", businessId);

      return NextResponse.json({ success: true, active: false });
    }
  } catch (err: any) {
    return handleApiError(err);
  }
}

