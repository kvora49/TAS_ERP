import { NextResponse } from "next/server";
import { runBackupJob } from "@/lib/cron/backup";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
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

