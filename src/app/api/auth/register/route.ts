import { NextResponse } from "next/server";
import { RegisterSchema } from "@/lib/schemas/auth.schema";
import { handleApiError, validateRequestBody } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const valResult = await validateRequestBody(req, RegisterSchema);
    if (!valResult.success) {
      return valResult.response;
    }

    const { businessName, fullName, email, phone } = valResult.data;
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Sign in and verify your email before creating a workspace." }, { status: 401 });
    }
    if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Registration email does not match the signed-in user." }, { status: 403 });
    }

    const { data: businessId, error } = await supabase.rpc("fn_complete_registration", {
      p_business_name: businessName,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone || null,
    });
    if (error) throw error;
    return NextResponse.json({ data: { businessId } }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err);
  }
}

