import { createClient as createServerClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

    const supabaseAdmin = createAdminClient();

    // 1. Fetch current membership in this company to protect owner role
    const { data: existingMember, error: fetchError } = await supabaseAdmin
      .from("company_members")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", businessId)
      .maybeSingle();

    const isTargetOwner = existingMember?.role?.toLowerCase() === "owner";
    const newRole = role.toLowerCase();

    if (isTargetOwner && newRole !== "owner") {
      return NextResponse.json(
        { error: "Owner role cannot be changed or demoted." },
        { status: 400 }
      );
    }

    // 2. Update company_members table for this business
    await supabaseAdmin
      .from("company_members")
      .update({
        role: isTargetOwner ? "owner" : newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("company_id", businessId);

    // 3. Update public.users table
    await supabaseAdmin
      .from("users")
      .update({
        full_name: name,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 4. Synchronize user metadata in Supabase Auth
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = params.id;

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Check if user is owner of this company
    const { data: existingMember } = await supabaseAdmin
      .from("company_members")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", businessId)
      .maybeSingle();

    if (existingMember?.role?.toLowerCase() === "owner") {
      return NextResponse.json(
        { error: "Owner cannot be removed from company membership." },
        { status: 400 }
      );
    }

    // 2. Remove company membership
    const { error: deleteError } = await supabaseAdmin
      .from("company_members")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", businessId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
