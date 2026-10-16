# Module 11 settings and administration audit — 16 October 2026

## Scope and verification status

Source audit only. No production configuration, backup, restore, import, or database migration was executed. The active checkout has a dirty worktree from prior modules; unrelated changes were preserved.

## Implemented confirmed fixes

| Finding | Status | Remediation |
| --- | --- | --- |
| SET-01 inventory policy mutation authorization | Fixed | Owner/admin guard, strict payload validation, current-company godown validation, legacy-write error handling, and audit event. |
| SET-02 production mutation authorization and ownership checks | Partially fixed | Owner/admin guard, schema validation, company-scoped template/work-center/stage verification, stage uniqueness checks, write-error handling, and audit event. Atomic default/template-stage writes remain pending a database RPC. |
| SET-03 and SET-12 import authorization and unsupported success reports | Fixed for implemented import entities | Owner/admin guard, explicit `parties`/`designs` allowlist, maximum 1,000 rows, rejected unsupported entities, and import audit event. |
| SET-08 notification configuration authorization and validation | Fixed | Owner/admin guard, time/email/rule type/day/target-role validation, and audit event. |
| SET-10 configuration writes in GET handlers | Fixed | Inventory, production, financial, general, and notification GET routes no longer seed persistent settings or service-role notification rules. |
| SET-14 failed server settings reads became defaults | Fixed | `getBusinessServerSettings` now throws required-source errors rather than allowing failed queries to become defaults. |

## Current route and security inventory

Settings APIs include general, inventory, production, financial, notifications, users, permissions, imports, company profile, bill configuration, e-invoice operations, communication, audit logs, backup history, backup, and restore. Existing guards were already present for general, financial, users, permissions, backup, and restore. This audit added them where the source lacked mutation guards.

## Remaining blockers and required approval

1. **SET-04/05/06/07 — atomic cross-table settings writes:** production default selection/stage reordering and general/inventory mirrors still use more than one table write. They require a tested PostgreSQL RPC with row locks and optimistic-version input before being described as atomic.
2. **SET-09 — permission enforcement:** `role_permissions` governs configuration/UI, but backend routes remain predominantly role-guard based. A module/action authorization service and endpoint-by-endpoint policy matrix require product approval before changing access semantics.
3. **SET-11 — backup confidentiality/durability:** the current manual backup code constructs an R2 public URL and has local-filesystem fallback. This is not suitable for confidential SQL dumps on ephemeral hosting. Replace it with private R2 storage, a guarded signed-download endpoint, durable failed-backup history, and staging restore verification.
4. **SET-15 — user provisioning:** new auth-user creation can still leave an identity if profile/membership writes fail. It needs a compensating cleanup or service-side transactional provisioning design.
5. **Import integrity:** implemented imports still execute row-by-row and update duplicate GSTIN/design records. Idempotency keys, dry-run/persisted import batches, canonical row schemas, and opening-balance governance need a staged design.

## Validation performed

- `npm run typecheck` passed.
- `git diff --check` passed.

## Required staging tests

- Staff/suspended user attempts inventory, production, notification, and import mutations.
- Cross-company godown/template/stage IDs.
- Failure between production default changes and stage reordering after the RPC migration is introduced.
- Backup object privacy, storage outage history, signed download authorization, retention, and isolated restore.
- Duplicate and over-limit import requests; row-level validation and audit history.
