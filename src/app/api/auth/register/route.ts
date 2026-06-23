import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, businessName, fullName, email, phone } = await req.json();

    if (!userId || !businessName || !fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Supabase Admin Client using Service Role Key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Insert new business record
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: businessName,
        email: email,
        phone: phone || null,
        enable_gst: true,
        enable_batch_tracking: true,
        allow_negative_stock: false,
        low_stock_alerts: true,
      })
      .select()
      .single();

    if (businessError) {
      return NextResponse.json(
        { error: `Failed to create business: ${businessError.message}` },
        { status: 500 }
      );
    }

    const businessId = businessData.id;

    // 2. Insert owner user record
    const { error: userError } = await supabaseAdmin.from("users").insert({
      id: userId,
      business_id: businessId,
      full_name: fullName,
      email: email,
      role: "owner",
      phone: phone || null,
      is_active: true,
    });

    if (userError) {
      // Rollback business creation
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);

      return NextResponse.json(
        { error: `Failed to create user profile: ${userError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, businessId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
