import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuthGuard } from "@/lib/auth/guards";
import { CreateUserSchema } from "@/lib/schemas/settings.schema";
import { handleApiError, validateRequestBody } from "@/lib/api-response";

export async function GET(request: Request) {
  const guard = await requireAuthGuard(["owner", "admin", "manager"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const status = searchParams.get("status"); // 'all' | 'active' | 'deactivated'
  const search = searchParams.get("search");

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Fetch memberships for the active company
    let memberQuery = supabaseAdmin
      .from("company_members")
      .select("id, user_id, role, status, created_at")
      .eq("company_id", businessId);

    if (role && role !== "all") {
      memberQuery = memberQuery.eq("role", role.toLowerCase());
    }

    if (status === "active") {
      memberQuery = memberQuery.eq("status", "active");
    } else if (status === "deactivated" || status === "suspended") {
      memberQuery = memberQuery.eq("status", "suspended");
    }

    const { data: memberRows, error: memberError } = await memberQuery;

    if (memberError) {
      throw memberError;
    }

    const userIds = (memberRows || []).map((m) => m.user_id);

    // 2. Fetch profiles for these users
    let usersList: any[] = [];
    if (userIds.length > 0) {
      const { data: userProfiles, error: profileError } = await supabaseAdmin
        .from("users")
        .select("id, full_name, email, phone, is_active, last_login_at, created_at, deleted_at")
        .in("id", userIds);

      if (profileError) {
        throw profileError;
      }

      const profileMap = new Map<string, any>((userProfiles || []).map((p: any) => [p.id, p]));

      usersList = (memberRows || []).map((m: any) => {
        const p: any = profileMap.get(m.user_id) || {};
        return {
          id: m.user_id,
          membership_id: m.id,
          full_name: p.full_name || "User",
          email: p.email || "",
          phone: p.phone || null,
          role: m.role,
          status: m.status,
          is_active: m.status === "active" && !p.deleted_at,
          last_login_at: p.last_login_at || null,
          created_at: m.created_at || p.created_at,
        };
      });
    }

    // Client-side simple search filter
    let filteredUsers = usersList;
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
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;

  try {
    const valResult = await validateRequestBody(request, CreateUserSchema);
    if (!valResult.success) {
      return valResult.response;
    }

    const { name, email, phone, role, password } = valResult.data;
    const supabaseAdmin = createAdminClient();

    // 1. Check if an auth user with this email already exists
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      // User exists in Auth — check if already member of this company
      userId = existingUser.id;

      const { data: existingMember } = await supabaseAdmin
        .from("company_members")
        .select("id, status")
        .eq("user_id", userId)
        .eq("company_id", businessId)
        .maybeSingle();

      if (existingMember && existingMember.status === "active") {
        return NextResponse.json(
          { error: "This user is already an active member of this company", code: "ALREADY_MEMBER" },
          { status: 400 }
        );
      }

      // Upsert membership into company_members
      const { error: memberError } = await supabaseAdmin
        .from("company_members")
        .upsert(
          {
            user_id: userId,
            company_id: businessId,
            role: role.toLowerCase(),
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, company_id" }
        );

      if (memberError) {
        throw memberError;
      }
    } else {
      // New user — password is required
      if (!password) {
        return NextResponse.json(
          { error: "Password is required for new users", code: "PASSWORD_REQUIRED" },
          { status: 400 }
        );
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: authError?.message || "Failed to create user credentials" },
          { status: 400 }
        );
      }

      userId = authData.user.id;

      // Upsert profile in public.users
      await supabaseAdmin.from("users").upsert(
        {
          id: userId,
          business_id: businessId,
          full_name: name,
          email: email.trim(),
          phone: phone || null,
          role: role.toLowerCase(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // Insert membership into company_members
      const { error: memberError } = await supabaseAdmin
        .from("company_members")
        .upsert(
          {
            user_id: userId,
            company_id: businessId,
            role: role.toLowerCase(),
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, company_id" }
        );

      if (memberError) {
        throw memberError;
      }
    }

    // Audit log
    void logAudit(businessId, "create", "users", userId, {
      full_name: name,
      email: email.trim(),
      role: role.toLowerCase(),
    }, {}, request);

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    return handleApiError(err);
  }
}

