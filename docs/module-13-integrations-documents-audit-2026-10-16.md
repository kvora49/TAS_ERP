# Module 13 — Integrations, Documents, Export and Sharing Audit

Audit date: 2026-10-16. Scope: source review of the Next.js routes and shared libraries. This is not evidence that production bucket policy, RLS, provider credentials, or backup retention have been verified.

## Implemented source-level remediation

| Finding | Result |
| --- | --- |
| INT-03 / upload scope | Presigned-object keys now include the active business and authenticated user. SVG is no longer accepted by the generic upload route. |
| INT-04 worker document linking | Worker-document registration now requires an active company member, verifies the worker belongs to that company, limits document types and size, and accepts only a URL under that user and company’s server-issued `workers` key prefix. |
| INT-05 calendar upload consistency | Calendar attachment metadata is not inserted after an object-store failure. Uploads do not overwrite existing objects, failed metadata insertion attempts cleanup, and delete failures are surfaced. |
| INT-09 mock/live adapter safety | An unknown adapter, or `mock` in production, now fails closed instead of silently simulating an IRN registration. |
| INT-10 fabricated e-invoice location values | The generate route no longer substitutes buyer/consignee PINs, cities or addresses. It returns 422 before submitting incomplete statutory data. |
| INT-07 object-read ordering/cache | The public PDF endpoint verifies the bill before storage access and sends stored PDFs with `private, no-store`. |
| INT-12 spreadsheet formula injection | Shared generic Excel exports prefix formula-like strings, while retaining real numeric fields as numbers. |

## Confirmed remaining work requiring deployment design or database work

| Finding | Why it is not safely changed in source alone | Required next step |
| --- | --- | --- |
| INT-01 calendar attachment public URLs | `calendar-attachments` records and UI currently store/open `getPublicUrl` URLs. Making the bucket private without a signed-download endpoint and storage-policy migration breaks every existing attachment. | Inventory bucket visibility and object ownership, migrate records to a signed download route with tenant/entry authorization, then make the bucket private. |
| INT-02 and INT-03 upload integrity | A presigned PUT constrains key/type but cannot prove actual bytes or virus-scan content before the client uploads. | Add a post-upload verification/scanning worker and an attachment state machine (`pending`, `verified`, `rejected`) before sensitive files become visible. |
| INT-07 public invoice authorization | `/p/bill/[id]` and `/api/public/bills/[id]/pdf` are intentionally unauthenticated customer URLs. UUIDs are identifiers, not durable share authorization. | Add a revocable, expiry-bound, hashed share token and migrate generated links. Do not disable the present endpoints until replacement links have been issued. |
| INT-08 IRN divergence/idempotency | Provider submission and the local sale-bill update remain separate operations; concurrent calls can submit duplicates and a local write can fail after IRN success. | Add a persisted idempotency/outbox table plus a transactional state transition and reconciliation worker. Test provider timeout-after-acceptance and concurrent generation on staging. |
| INT-11 WhatsApp sharing | WhatsApp currently builds URLs to the unauthenticated public PDF endpoint. | Use the above scoped share token and log delivery intent/status without exposing long-lived invoice URLs. |
| INT-12 reports beyond generic exporter | Dedicated XLSX paths using direct `aoa_to_sheet` / `json_to_sheet` still need a complete output inventory. | Route all export cells through one escaping helper and add representative formula-injection tests for every custom exporter. |
| INT-14 backups | Backup routes and UI still expose/stores direct file URLs; retention and restore authorization require the Module 11 backup hardening design. | Replace direct URLs with time-bound authorized downloads; encrypt and test restore in staging. |

## Validation performed

The changes require TypeScript typechecking and whitespace/diff validation. Provider calls, object storage, bucket policy, and database migrations were not executed from this audit environment.
