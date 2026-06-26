import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "supplier"; // default to supplier

  let prefix = "PRT";
  if (type === "supplier") prefix = "SUP";
  else if (type === "customer") prefix = "CUS";
  else if (type === "worker") prefix = "WRK";

  try {
    const { data: parties, error } = await supabase
      .from("parties")
      .select("code")
      .eq("business_id", businessId)
      .like("code", `${prefix}-%`)
      .order("code", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let nextNum = 1;
    if (parties && parties.length > 0) {
      // Find the highest number
      for (const p of parties) {
        if (!p.code) continue;
        const numPart = p.code.substring(prefix.length + 1);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
          break;
        }
      }
    }

    const nextCode = `${prefix}-${String(nextNum).padStart(4, "0")}`;
    return NextResponse.json({ code: nextCode });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
