import { createClient } from "@/lib/supabase/server";
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

    const { data: newCompanyId, error: createError } = await supabase.rpc("fn_create_company_for_current_user", {
      p_name: name.trim(), p_address: address || null, p_phone: phone || null,
      p_email: email || user.email || null, p_gstin: gstin || null, p_pan: pan || null,
      p_website: website || null, p_logo_url: logo_url || null, p_currency: currency || "INR",
    });
    if (createError || !newCompanyId) throw createError || new Error("Failed to create company");
    const { data: businessData, error: businessError } = await supabase.from("businesses").select().eq("id", newCompanyId).single();
    if (businessError || !businessData) throw businessError || new Error("Created company could not be loaded");

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
