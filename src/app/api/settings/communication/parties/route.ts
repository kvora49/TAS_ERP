import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: parties, error } = await supabase
      .from("parties")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ parties });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, whatsapp_number } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing party ID" }, { status: 400 });
    }

    // Validation: Clean formatting (digits only)
    const cleanNumber = whatsapp_number ? whatsapp_number.replace(/\D/g, "") : null;

    const { data: party, error } = await supabase
      .from("parties")
      .update({
        whatsapp_number: cleanNumber,
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ party });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
