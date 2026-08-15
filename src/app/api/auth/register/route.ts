import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { RegisterSchema } from "@/lib/schemas/auth.schema";
import { handleApiError, validateRequestBody } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const valResult = await validateRequestBody(req, RegisterSchema);
    if (!valResult.success) {
      return valResult.response;
    }

    const { userId, businessName, fullName, email, phone } = valResult.data;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server authentication configuration missing" }, { status: 500 });
    }

    // Initialize Supabase Admin Client using Service Role Key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
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
      throw new Error(`Failed to create business profile: ${businessError.message}`);
    }

    const businessId = businessData.id;

    if (userId) {
      // 2. Insert owner user record
      const { error: userError } = await supabaseAdmin.from("users").upsert({
        id: userId,
        business_id: businessId,
        full_name: fullName,
        email: email,
        role: "owner",
        phone: phone || null,
        is_active: true,
      }, { onConflict: "id" });

      if (userError) {
        // Rollback business creation
        await supabaseAdmin.from("businesses").delete().eq("id", businessId);

        if (userError.code === "23503" || userError.message?.includes("users_id_fkey")) {
          return NextResponse.json(
            { error: "This email account is already registered in Authentication. Please sign in to your account." },
            { status: 400 }
          );
        }

        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // 3. Insert owner membership into company_members
      const { error: memberError } = await supabaseAdmin
        .from("company_members")
        .upsert({
          user_id: userId,
          company_id: businessId,
          role: "owner",
          status: "active",
        }, { onConflict: "user_id, company_id" });

      if (memberError) {
        console.warn("Warning: Failed to create company_members row on register:", memberError.message);
      }
    }

    return NextResponse.json({ success: true, businessId });
  } catch (err: any) {
    return handleApiError(err);
  }
}

