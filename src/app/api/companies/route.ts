import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_COMPANY_COOKIE, LEGACY_BUSINESS_COOKIE } from "@/lib/active-company";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = createAdminClient();
    let activeCompanyId = await getSessionBusinessId();

    // Query active memberships with company/business details using admin client
    // strictly filtered to the authenticated user.id for multi-tenant isolation
    const { data: memberships, error } = await supabaseAdmin
      .from("company_members")
      .select(`
        id,
        role,
        status,
        created_at,
        businesses (
          id,
          name,
          gstin,
          pan,
          address,
          phone,
          email,
          website,
          logo_url,
          currency,
          financial_year_start,
          archived_at
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format into clean list
    const companies = (memberships || [])
      .filter((m) => m.businesses)
      .map((m) => {
        const b = m.businesses as any;
        return {
          id: b.id,
          name: b.name,
          gstin: b.gstin,
          pan: b.pan,
          address: b.address,
          phone: b.phone,
          email: b.email,
          website: b.website,
          logo_url: b.logo_url,
          currency: b.currency,
          financial_year_start: b.financial_year_start,
          archived_at: b.archived_at || null,
          role: m.role,
          status: m.status,
          membershipId: m.id,
          isActive: false, // Calculated below
        };
      });

    // If activeCompanyId is not one of the user's active companies, fall back to first company
    const isValidActive = companies.some((c) => c.id === activeCompanyId);
    if (!isValidActive && companies.length > 0) {
      activeCompanyId = companies[0].id;
    }

    // Mark active company
    for (const c of companies) {
      c.isActive = c.id === activeCompanyId;
    }

    const response = NextResponse.json({
      companies,
      activeCompanyId,
      total: companies.length,
    });

    // Set cookie if activeCompanyId resolved
    if (activeCompanyId) {
      const cookieOpts = {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      };
      response.cookies.set(ACTIVE_COMPANY_COOKIE, activeCompanyId, cookieOpts);
      response.cookies.set(LEGACY_BUSINESS_COOKIE, activeCompanyId, cookieOpts);
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
