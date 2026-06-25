import { createClient as createServerClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = params.id;

  try {
    const { action } = await request.json().catch(() => ({ action: "deactivate" }));

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === "activate") {
      // Activate: reset deleted_at and set active
      const { error: profileError } = await supabase
        .from("users")
        .update({
          deleted_at: null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("business_id", businessId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Re-enable in auth
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });

      return NextResponse.json({ success: true, active: true });
    } else {
      // Deactivate: set deleted_at and inactive
      const { error: profileError } = await supabase
        .from("users")
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("business_id", businessId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Ban/disable user session in Auth
      try {
        await supabaseAdmin.auth.admin.signOut(userId);
        // Ban for 10 years to prevent login
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "87600h", // 10 years
        });
      } catch (authErr: any) {
        console.warn("Could not completely invalidate auth session:", authErr.message);
      }

      return NextResponse.json({ success: true, active: false });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
