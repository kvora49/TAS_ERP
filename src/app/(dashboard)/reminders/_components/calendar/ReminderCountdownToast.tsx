"use client";

import React, { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bell, Clock, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * ReminderCountdownToast
 *
 * Client-side listener running in the background when the app is open.
 * Periodically checks for reminders due within the next 15 minutes that haven't been toast-notified.
 * Shows a rich toast notification with quick actions [View], [Snooze 10m], and [Complete].
 */
export function ReminderCountdownToast() {
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkUpcomingReminders = async () => {
      try {
        const now = new Date();
        const future15m = new Date(now.getTime() + 15 * 60 * 1000);

        const res = await fetch(
          `/api/calendar/entries?type=reminder&status=pending&date_from=${now.toISOString().split("T")[0]}&date_to=${future15m.toISOString().split("T")[0]}`
        );

        if (!res.ok) return;
        const json = await res.json();
        const entries = json.data || [];

        for (const entry of entries) {
          if (!entry.reminders || entry.reminders.length === 0) continue;
          const reminder = entry.reminders[0];

          if (reminder.is_fired || notifiedIdsRef.current.has(entry.id)) continue;

          const remindAtTime = new Date(reminder.remind_at).getTime();
          const diffMinutes = Math.round((remindAtTime - now.getTime()) / 60000);

          if (diffMinutes <= 15 && diffMinutes >= -5) {
            notifiedIdsRef.current.add(entry.id);

            toast.custom(
              (t) => (
                <div className="bg-[var(--card-bg)] border-2 border-amber-400 p-4 rounded-xl shadow-xl flex flex-col gap-2 min-w-[320px] text-[var(--text-primary)]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-400/20 text-amber-500 shrink-0">
                      <Bell className="h-5 w-5 animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                          {diffMinutes <= 0 ? "Due Now!" : `Due in ${diffMinutes} min`}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">{entry.title}</h4>
                      {entry.content && (
                        <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5"
                          dangerouslySetInnerHTML={{ __html: entry.content.replace(/<[^>]+>/g, " ") }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={async () => {
                        toast.dismiss(t);
                        await fetch(`/api/calendar/entries/${entry.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "completed" }),
                        });
                        queryClient.invalidateQueries({ queryKey: ["calendar"] });
                        toast.success("Reminder completed!");
                      }}
                      className="flex-1 py-1.5 px-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Complete
                    </button>

                    <button
                      onClick={async () => {
                        toast.dismiss(t);
                        const snoozeTime = new Date(now.getTime() + 10 * 60 * 1000);
                        await fetch(`/api/calendar/entries/${entry.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ entry_time: formatTime(snoozeTime) }),
                        });
                        queryClient.invalidateQueries({ queryKey: ["calendar"] });
                        toast.info("Snoozed for 10 minutes");
                      }}
                      className="py-1.5 px-3 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      Snooze 10m
                    </button>
                  </div>
                </div>
              ),
              { duration: 15000 }
            );
          }
        }
      } catch (err) {
        // Ignore background polling errors
      }
    };

    checkUpcomingReminders();
    const interval = setInterval(checkUpcomingReminders, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
