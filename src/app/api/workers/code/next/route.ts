import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "job_worker"; // default to job_worker

  let prefix = "JW";
  if (type === "permanent") prefix = "PW";

  try {
    const { data: workers, error } = await supabase
      .from("workers")
      .select("worker_id")
      .eq("business_id", businessId)
      .like("worker_id", `${prefix}-%`)
      .order("worker_id", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let nextNum = 1;
    if (workers && workers.length > 0) {
      for (const w of workers) {
        if (!w.worker_id) continue;
        const numPart = w.worker_id.substring(prefix.length + 1);
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
