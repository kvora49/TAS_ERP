import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { dispatchSystemPushAlert } from "@/lib/notifications/push-dispatcher";
import { handleApiError } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/cron/calendar-reminders
 *
 * Cron job: runs every 5 minutes via Vercel cron or cron-job.org.
 * Security: requires CRON_SECRET header or query param.
 */
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes

    // ── 1. Find all unfired reminders due within window ──────────────
    const { data: dueReminders, error: reminderError } = await supabase
      .from("calendar_reminders")
      .select(`
        id, business_id, entry_id, remind_at, notify_before_minutes,
        repeat_type, repeat_interval, repeat_end_date,
        entry:calendar_entries(
          id, title, content, entry_date, entry_time, entry_type,
          category, priority,
          person_responsible,
          created_by
        )
      `)
      .lte("remind_at", windowEnd.toISOString())
      .gte("remind_at", new Date(now.getTime() - 10 * 60 * 1000).toISOString()) // -10 min buffer for missed
      .eq("is_fired", false)
      .limit(50);

    if (reminderError) {
      console.error("[Calendar Cron] Error fetching reminders:", reminderError.message);
      return NextResponse.json({ error: reminderError.message }, { status: 500 });
    }

    let firedCount = 0;
    const notificationsCreated: string[] = [];

    for (const reminder of dueReminders || []) {
      const entry = reminder.entry as any;
      if (!entry) continue;

      const title = `⏰ ${entry.title}`;
      const body = entry.content
        ? entry.content.replace(/<[^>]+>/g, "").substring(0, 100)
        : `Reminder for ${entry.entry_date}`;

      // ── 2. Insert in_app_notification (bell) ─────────────────────
      const { data: notification } = await supabase
        .from("in_app_notifications")
        .insert({
          business_id: reminder.business_id,
          target_roles: ["owner", "admin", "manager"],
          rule_type: "calendar_reminder",
          title,
          message: body,
          link_url: `/reminders?tab=calendar&date=${entry.entry_date}`,
        })
        .select("id")
        .single();

      if (notification) notificationsCreated.push(notification.id);

      // ── 3. Send web push to person_responsible or created_by ─────
      if (reminder.business_id) {
        await dispatchSystemPushAlert({
          businessId: reminder.business_id,
          userId: entry.person_responsible || entry.created_by || undefined,
          title,
          message: body,
          linkUrl: `/reminders?tab=calendar&date=${entry.entry_date}`,
          tag: `calendar-reminder-${reminder.id}`,
        });
      }

      // ── 4. Mark reminder as fired ─────────────────────────────────
      await supabase
        .from("calendar_reminders")
        .update({
          is_fired: true,
          fired_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", reminder.id);

      firedCount++;

      // ── 5. Schedule next occurrence for repeating reminders ───────
      if (reminder.repeat_type && reminder.repeat_type !== "never") {
        const nextAt = computeNextOccurrence(
          new Date(reminder.remind_at),
          reminder.repeat_type,
          reminder.repeat_interval
        );

        const endDate = reminder.repeat_end_date ? new Date(reminder.repeat_end_date) : null;

        if (nextAt && (!endDate || nextAt <= endDate)) {
          await supabase.from("calendar_reminders").insert({
            business_id: reminder.business_id,
            entry_id: reminder.entry_id,
            remind_at: nextAt.toISOString(),
            notify_before_minutes: reminder.notify_before_minutes,
            repeat_type: reminder.repeat_type,
            repeat_interval: reminder.repeat_interval,
            repeat_end_date: reminder.repeat_end_date,
            is_fired: false,
          });
        }
      }
    }

    // ── 6. Auto-mark overdue entries ─────────────────────────────────
    const { error: overdueError } = await supabase
      .from("calendar_entries")
      .update({ status: "overdue", updated_at: now.toISOString() })
      .in("status", ["pending", "in_progress"])
      .in("entry_type", ["reminder", "task", "event"])
      .lt("entry_date", now.toISOString().split("T")[0])
      .is("deleted_at", null);

    if (overdueError) {
      console.error("[Calendar Cron] Error marking overdue:", overdueError.message);
    }

    return NextResponse.json({
      success: true,
      fired: firedCount,
      notifications_created: notificationsCreated.length,
      timestamp: now.toISOString(),
    });
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
