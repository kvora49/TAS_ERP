import openNextHandler from "./.open-next/worker.js";
import { runBackupJob } from "./src/lib/cron/backup";
import { runCalendarRemindersJob } from "./src/lib/cron/calendar-reminders";
import { runNotificationsJob } from "./src/lib/cron/notifications";
import { runEinvoiceReconcileJob } from "./src/lib/cron/einvoice-reconcile";
import { runScheduledStockIntegrityJob } from "./src/lib/cron/stock-integrity";

import { runReportSubscriptionsJob } from "./src/lib/cron/report-subscriptions";

export * from "./.open-next/worker.js";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    return (openNextHandler as any).fetch(request, env, ctx);
  },

  async scheduled(event: { cron: string; type: string; scheduledTime: number }, env: any, ctx: any) {
    console.log(`[Cloudflare Cron] Scheduled trigger "${event.cron}" fired at ${new Date(event.scheduledTime).toISOString()}`);

    const executeJob = async () => {
      switch (event.cron) {
        case "0 * * * *":
          console.log("[Cloudflare Cron] Running Hourly Notification & Scheduled Backup Checks...");
          const [notifResult, backupResult, reportResult] = await Promise.allSettled([
            runNotificationsJob(),
            runBackupJob(),
            runReportSubscriptionsJob(),
          ]);
          return { notifResult, backupResult, reportResult };
        case "0 8 * * *":
          console.log("[Cloudflare Cron] Running Calendar Reminders Job...");
          return await runCalendarRemindersJob();
        case "0 22 * * *":
          console.log("[Cloudflare Cron] Running E-Invoice Reconciliation Job...");
          return await runEinvoiceReconcileJob();
        case "0 4 * * *":
          console.log("[Cloudflare Cron] Running Stock Integrity Watchdog Job...");
          return await runScheduledStockIntegrityJob();
        default:
          console.warn(`[Cloudflare Cron] Unrecognized cron schedule: "${event.cron}"`);
      }
    };

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(
        executeJob()
          .then((res) => {
            console.log(`[Cloudflare Cron] Successfully finished "${event.cron}":`, JSON.stringify(res));
          })
          .catch((err) => {
            console.error(`[Cloudflare Cron] Error in cron job "${event.cron}":`, err);
          })
      );
    } else {
      await executeJob();
    }
  },
};
