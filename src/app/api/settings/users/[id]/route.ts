import { createClient as createServerClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = params.id;

  try {
    const body = await request.json();
    const { name, phone, role } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: "Missing required fields (name, role)" },
        { status: 400 }
      );
    }

    // 1. Update public.users table
    const { error: profileError } = await supabase
      .from("users")
      .update({
        full_name: name,
        phone: phone || null,
        role: role.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("business_id", businessId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 2. Synchronize user metadata in Supabase Auth
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: name },
    });

    if (authError) {
      console.warn("Failed to synchronize auth metadata:", authError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
