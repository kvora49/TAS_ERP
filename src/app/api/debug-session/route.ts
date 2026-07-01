import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const businessId = await getSessionBusinessId();
  return NextResponse.json({
    email: session?.user?.email || null,
    userId: session?.user?.id || null,
    businessId,
  });
}
