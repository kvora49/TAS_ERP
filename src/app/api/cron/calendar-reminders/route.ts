import { NextResponse } from "next/server";
import { runCalendarRemindersJob } from "@/lib/cron/calendar-reminders";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on server" }, { status: 500 });
  }

  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await runCalendarRemindersJob();
    return NextResponse.json(result);
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

// ─── Helper: compute next reminder occurrence ─────────────────────────────────
function computeNextOccurrence(
  from: Date,
  repeatType: string,
  repeatInterval: number | null
): Date | null {
  const next = new Date(from);

  switch (repeatType) {
    case "daily":
      next.setDate(next.getDate() + (repeatInterval || 1));
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * (repeatInterval || 1));
      break;
    case "monthly":
      next.setMonth(next.getMonth() + (repeatInterval || 1));
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + (repeatInterval || 1));
      break;
    case "custom":
      next.setDate(next.getDate() + (repeatInterval || 1));
      break;
    default:
      return null;
  }

  return next;
}
