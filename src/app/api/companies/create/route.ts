import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveCompanyId } from "@/lib/active-company";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      address,
      phone,
      email,
      gstin,
      pan,
      website,
      logo_url,
      currency,
      financial_year_start,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Create the new business / company record
    const insertPayload: Record<string, any> = {
      name: name.trim(),
      address: address || null,
      phone: phone || null,
      email: email || user.email,
      gstin: gstin || null,
      pan: pan || null,
      website: website || null,
      logo_url: logo_url || null,
      currency: currency || "INR",
      enable_gst: true,
      enable_batch_tracking: true,
      allow_negative_stock: false,
      low_stock_alerts: true,
    };

    if (financial_year_start !== undefined && financial_year_start !== null) {
      const parsed = typeof financial_year_start === "number"
        ? financial_year_start
        : parseInt(String(financial_year_start), 10);
      if (!isNaN(parsed)) {
        insertPayload.financial_year_start = parsed;
      }
    }

    const { data: businessData, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert(insertPayload)
      .select()
      .single();

    if (businessError || !businessData) {
      return NextResponse.json(
        { error: `Failed to create company: ${businessError?.message}` },
        { status: 500 }
      );
    }

    const newCompanyId = businessData.id;

    // 2. Insert owner membership in company_members
    const { error: memberError } = await supabaseAdmin
      .from("company_members")
      .insert({
        user_id: user.id,
        company_id: newCompanyId,
        role: "owner",
        status: "active",
      });

    if (memberError) {
      // Rollback business creation
      await supabaseAdmin.from("businesses").delete().eq("id", newCompanyId);
      return NextResponse.json(
        { error: `Failed to create company membership: ${memberError.message}` },
        { status: 500 }
      );
    }

    // 3. Update user active business_id in users table
    await supabaseAdmin
      .from("users")
      .update({ business_id: newCompanyId })
      .eq("id", user.id);

    // 4. Auto-activate the new company in session cookies
    setActiveCompanyId(newCompanyId);

    // 5. Audit log
    void logAudit(newCompanyId, "create", "businesses", newCompanyId, {
      name: name.trim(),
      created_by: user.id,
    });

    const response = NextResponse.json({
      success: true,
      company: businessData,
    });

    // Explicitly set cookie on the HTTP response
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    };
    response.cookies.set("active_company_id", newCompanyId, cookieOpts);
    response.cookies.set("sb-business-id", newCompanyId, cookieOpts);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
