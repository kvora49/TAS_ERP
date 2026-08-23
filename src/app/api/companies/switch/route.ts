import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ACTIVE_COMPANY_COOKIE, LEGACY_BUSINESS_COOKIE } from "@/lib/active-company";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId } = await request.json();
    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    // 1. Validate that the user is an active member of the requested company
    const { data: membership, error: memberError } = await supabase
      .from("company_members")
      .select("id, role, company_id, businesses(name)")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "You do not have active access to this company" },
        { status: 403 }
      );
    }

    // 2. Keep users.business_id in sync
    await supabase
      .from("users")
      .update({ business_id: companyId })
      .eq("id", user.id);

    // 3. Set active company cookies on response
    const cookieOpts = {
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    };

    const companyName = (membership.businesses as any)?.name || "Company";
    const response = NextResponse.json({
      success: true,
      companyId,
      companyName,
      role: membership.role,
    });

    response.cookies.set(ACTIVE_COMPANY_COOKIE, companyId, cookieOpts);
    response.cookies.set(LEGACY_BUSINESS_COOKIE, companyId, cookieOpts);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to switch company" },
      { status: 500 }
    );
  }
}
