# Stock Management Rules — TAS ERP

These rules apply to EVERY agent session and every code change in TAS ERP.
Violating any rule below will cause stock discrepancies that are hard to detect.

---

## Rule S1 — Single Writer: Only Reconciliation Writes to `finished_stock`

**NEVER directly INSERT or UPDATE rows in the `finished_stock` table from API routes or repositories.**

The only code allowed to write to `finished_stock` is:
- `src/lib/finished-stock-reconciliation.ts` → `reconcileFinishedStock()`

All other code must:
1. Write to `stock_ledger` for the audit trail
2. Call `reconcileFinishedStock()` to update the actual stock

**Allowed exceptions (document them here if any are ever added):**
- `move-to-stock/route.ts` — inserts directly WITH `lot_id` for idempotency guard, THEN calls reconcileFinishedStock

---

## Rule S2 — Every Stock-Affecting Write Must Call Reconciliation

Any API route or repository method that changes data in these tables MUST call the relevant reconcile function afterward:

### Tables that trigger `reconcileFinishedStock(supabase, businessId, design_id)`:
| Table | Operations |
|---|---|
| `sale_bills` | INSERT, soft-delete, status change |
| `sale_bill_items` | INSERT, DELETE |
| `sales_returns` | INSERT, UPDATE, DELETE |
| `sales_return_items` | INSERT, DELETE |
| `stock_adjustments` | INSERT, DELETE |
| `stock_transfers` | INSERT, UPDATE status |
| `stock_transfer_items` | INSERT |
| `challans` | INSERT, UPDATE status |
| `challan_items` | INSERT |
| `raw_material_purchase_items` | INSERT (finished_goods type only) |
| `purchase_return_items` | INSERT (finished_goods type only) |
| `production_lots` | Status → "completed" (move-to-stock) |

### Tables that trigger `reconcileRawMaterialStock(supabase, businessId)`:
| Table | Operations |
|---|---|
| `raw_material_purchases` | INSERT, soft-delete |
| `raw_material_purchase_items` | INSERT (fabric/accessory types) |
| `purchase_returns` | INSERT, DELETE |
| `purchase_return_items` | INSERT (fabric/accessory types) |
| `raw_material_stock_entries` | INSERT |
| `raw_material_stock_entry_items` | INSERT |
| `raw_material_transfers` | INSERT, UPDATE status |
| `production_lots` | Cancellation (fabric + accessory release) |
| `production_lot_accessories` | Move-to-stock (unused accessory return) |

---

## Rule S3 — Never Call Reconciliation in GET Handlers

Reconciliation is expensive (delete + rebuild). **Never call it in a GET request handler.**

- If data may be stale, show a "Sync Stock" button that calls the POST reconcile endpoint
- Use the CRON job (`/api/cron/stock-integrity`) for scheduled refreshes

---

## Rule S4 — Always Use Actual Godown IDs

**Never assume `defaultGodownId` (first godown) is correct for any transaction.**

Always use the actual godown from the source record:
- Sales: `sale_bills.godown_id`
- Returns: `sales_returns.godown_id`
- Purchases: `raw_material_purchases.godown_id`
- Production: `production_lots.godown_id` (set during move-to-stock)
- Transfers: `stock_transfers.from_godown_id` / `to_godown_id`

Only fall back to `defaultGodownId` if the column is genuinely NULL on the source record.

---

## Rule S5 — Reconciliation Must Abort on Query Failure

If any critical query in `reconcileFinishedStock()` fails:
1. **Throw the error** — do NOT continue with empty arrays
2. **Never wipe `finished_stock`** unless all source queries succeeded

Queries that must abort on failure: godowns, production_lots, sale_bills, raw_material_purchase_items.
Queries that can use empty arrays as fallback: adjustments, transfers, challans (secondary flows).

---

## Rule S6 — Run Watchdog After Every Significant Change

Call `runStockIntegrityCheck()` from `src/lib/stock-integrity-watchdog.ts` after:
- Any bulk reconciliation (full or design-scoped)
- Any schema change to stock-related tables
- Any migration that modifies existing stock records

The watchdog compares `finished_stock` against `stock_ledger` net deltas and auto-fixes + reports.

---

## Rule S7 — New Features: Update This Document First

If you add a new stock-affecting transaction type, you MUST:
1. Add the new table to the relevant table list in Rule S2
2. Add the new `transaction_type` string to `stock_ledger` documentation below
3. Update `reconcileFinishedStock()` or `reconcileRawMaterialStock()` to include the new flow
4. Add a test case in the CRON endpoint

**Known `transaction_type` values for `stock_ledger.transaction_type`:**
- `purchase` — raw material / FG purchase inflow
- `purchase_cancellation` — purchase deleted
- `sale_bill_outflow` — finished good sold
- `sales_return_inflow` — finished good returned from customer
- `adjustment_inflow` — manual stock addition
- `adjustment_outflow` — manual stock deduction
- `production_lot_finished_good_push` — lot moved to finished stock
- `production_lot_return_unused_fabric` — unused fabric returned to RM stock
- `production_lot_return_unused_accessory` — unused accessory returned to RM stock
- `production_lot_cancellation_roll_release` — lot cancelled, fabric released
- `production_lot_cancellation_accessory_release` — lot cancelled, accessories released
