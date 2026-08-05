import { createClient as createServerClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : createServerClient();

    let query = supabaseAdmin
      .from("users")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (role && role !== "all") {
      query = query.eq("role", role.toLowerCase());
    }

    const { data: users, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side simple search filter
    let filteredUsers = users || [];
    if (search) {
      const s = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.role?.toLowerCase().includes(s)
      );
    }

    return NextResponse.json({ users: filteredUsers });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, phone, role, password } = body;

    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: "Missing required fields (name, email, role, password)" },
        { status: 400 }
      );
    }

    // Initialize Supabase Admin Client
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration missing: SUPABASE_SERVICE_ROLE_KEY is required to manage users" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // 1. Create auth user in Supabase Auth via Admin Client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create authentication credentials" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 2. Insert or Upsert profile record in public.users table (handles DB triggers smoothly)
    const { error: profileError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        business_id: businessId,
        full_name: name,
        email,
        phone: phone || null,
        role: role.toLowerCase(),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      // Rollback auth user creation
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Fire-and-forget audit log
    void logAudit(businessId, "create", "users", userId, {
      full_name: name,
      email,
      role: role.toLowerCase(),
    });

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
