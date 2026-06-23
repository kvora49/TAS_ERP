import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: godowns, error } = await supabase
      .from("godowns")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ godowns });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, address, contact_person, phone, is_primary, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Godown Name is required" },
        { status: 400 }
      );
    }

    // Reset others if set to primary
    if (is_primary) {
      await supabase
        .from("godowns")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    const { data: godown, error } = await supabase
      .from("godowns")
      .insert({
        business_id: businessId,
        name,
        address: address || null,
        contact_person: contact_person || null,
        phone: phone || null,
        is_primary: !!is_primary,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ godown });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
