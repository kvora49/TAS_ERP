# Module 12 notifications, reminders, and workflows audit — 16 October 2026

## Scope and verification status

This is a source audit of the checkout. No cron endpoint was invoked, no notification was dispatched, and no database migration was applied. Existing notification, reminder, and subscription records were preserved.

## Verified feature map

| Feature | Current producer | Storage/consumer | Status |
| --- | --- | --- | --- |
| In-app financial/stock alerts | `runNotificationsJob` | `in_app_notifications`, inbox/popover | Partial: low stock, overdue, due soon, and lot completion are implemented. |
| Calendar reminders | `runCalendarRemindersJob` | `calendar_reminders`, `in_app_notifications`, push dispatcher | Unsafe for concurrent execution; requires claim migration. |
| Browser/FCM push | `dispatchSystemPushAlert` | `web_push_subscriptions` | Provider acceptance only; device display is not guaranteed. |
| Bill reminder schedules | reminders/evaluate route | `bill_reminder_schedules` | Partial: separate notification and schedule writes are non-atomic. |
| Report subscriptions | `runReportSubscriptionsJob` | subscription leases and snapshot runs | Has RPC claiming and rechecks owner/admin access. No email delivery is implemented. |

## Implemented confirmed fixes

| Finding | Status | Remediation |
| --- | --- | --- |
| NOT-05 inbox source failures | Fixed | Required inbox queries are error-checked before facts are computed. |
| NOT-07 mark-as-read errors | Fixed | Batch IDs are limited to 100 UUIDs, transient IDs remain supported, and database errors return failure rather than false success. |
| NOT-10 push-recipient authorization | Fixed | Push subscriptions are now selected only for active `company_members`; target roles are applied before delivery. |
| NOT-11 settings permissions | Previously fixed in Module 11 | Owner/admin guard and rule validation are already present. |
| NOT-14 cron secret comparison | Fixed | Notifications and calendar cron routes now use length-safe timing-safe bearer/query-secret comparison and fail closed without `CRON_SECRET`. |

## Critical migration-dependent findings

1. **NOT-01/02/03:** calendar reminders use read → create event → push → mark fired → create recurrence. There is no lease, event key, delivery state, retry count, or transaction. Two workers can duplicate events and recurrences; a crash can lose or repeat work.
2. **NOT-04/05/06:** scheduled alerts deduplicate by business/rule/title for 12 hours, have unchecked source queries, and only process the first 20 candidates. Different invoices/materials can collapse; alerts can silently disappear or starve.
3. **NOT-08:** the inbox is now bounded at 200 urgently sorted invoices, but this is not a complete debt/advance/allocation reconciliation. A server-side paged or summarized projection is required for unlimited businesses.
4. **NOT-09:** `in_app_notifications.is_read` is a shared event-level flag. The current schema cannot represent individual read receipts; product approval is needed before adding recipient/read-state tables.

## Required queue design

Create a versioned migration that adds an immutable event key, unique constraint, claimed/leased timestamps, attempt count, next-attempt timestamp, provider acceptance state, and failure details. A security-definer claim RPC should lock a bounded fair batch using `FOR UPDATE SKIP LOCKED`, atomically create the in-app event and next recurrence, then return delivery work. A completion RPC should release/retry/terminally fail the claim. Do not mark device display as delivered—only provider acceptance.

## Rule coverage gaps

Configured rule types include payment due, overdue, PDC reminder, low stock, cheque bounce, stage delay, lot completion, and write-off alert. The scheduled worker currently produces only low stock, overdue, payment due, and lot completion. Email and SMS flags are configuration only; no verified email/SMS delivery producer exists.

## Validation performed

- `npm run typecheck` passed.
- `git diff --check` passed.

## Required staging tests

- Competing calendar workers, lease expiry, crash after claim/event/provider acceptance, and recurring month-end/leap-year reminders.
- Distinct same-title overdue invoices and more than 20/50/200 candidates.
- Suspended member and cross-company device subscription attempts.
- Database-failed mark-as-read and source-query failure responses.
- Cron calls with absent, malformed, and correct secrets.
- Report subscription permission revocation before execution.
