import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: logs, error } = await supabase
      .from("whatsapp_logs")
      .select(`
        id,
        template_code,
        message_generated,
        status,
        created_at,
        users (
          full_name
        ),
        parties (
          name
        )
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    const body = await request.json();
    const { party_id, template_code, message_generated } = body;

    if (!message_generated) {
      return NextResponse.json({ error: "Missing message content" }, { status: 400 });
    }

    const { data: log, error } = await supabase
      .from("whatsapp_logs")
      .insert({
        business_id: businessId,
        user_id: userId || null,
        party_id: party_id || null,
        template_code: template_code || "CUSTOM",
        message_generated,
        status: "Opened In WhatsApp",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
