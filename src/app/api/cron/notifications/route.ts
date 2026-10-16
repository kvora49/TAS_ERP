import { NextResponse } from "next/server";
import { runNotificationsJob } from "@/lib/cron/notifications";
import { handleApiError } from "@/lib/api-response";
import { timingSafeEqual } from "node:crypto";

export async function GET(request: Request) {
  const __startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;
  const force = searchParams.get("force") === "true";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on server" }, { status: 500 });
  }

  if (!secret || Buffer.byteLength(secret) !== Buffer.byteLength(cronSecret) || !timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret))) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await runNotificationsJob({ force });
    return NextResponse.json(result);
  } catch (err: any) {
    return handleApiError(err);
  } finally {
    console.log(`[PERF_TIMING] GET /api/cron/notifications - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

