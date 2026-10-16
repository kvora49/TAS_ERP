import { NextResponse } from "next/server";
import { runBackupJob } from "@/lib/cron/backup";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on server" }, { status: 500 });
  }

  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await runBackupJob();
    return NextResponse.json(result);
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

