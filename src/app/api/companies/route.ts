import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
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
    const activeCompanyId = await getSessionBusinessId();

    // Query active memberships with company/business details
    const { data: memberships, error } = await supabase
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
          financial_year_start
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
          role: m.role,
          status: m.status,
          membershipId: m.id,
          isActive: b.id === activeCompanyId,
        };
      });

    return NextResponse.json({
      companies,
      activeCompanyId,
      total: companies.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
