# Sales Bills — Module Brain
Loaded automatically whenever the agent works inside this folder.

## Status
This is the **reference module** for the repository/service/hook pattern (P1 #13). Once complete, its shape is the template for every other module (P2 #22) — don't diverge without a good reason; if you do, update this file to explain why.

## Known baseline (verified pre-refactor — do not re-audit these as new)
| File | Lines | State vars | Fetch calls | useQuery |
|---|---|---|---|---|
| `bills/page.tsx` | 594 | 11 | 2 | 0 |
| `bills/new/page.tsx` | 1,879 | 38 | 7 | 0 |
| `bills/[id]/edit/page.tsx` | 1,712 | 39 | 6 | 0 |
| `bills/[id]/page.tsx` | 1,105 | 3 | 2 | 0 |
| `bills/[id]/print/page.tsx` | 881 | 1 | 1 | 0 |

Two backend issues motivated the refactor, fixed as part of it — if these patterns reappear, they're regressions:
- GST/total calculation was duplicated between create and edit routes — should live only in `services/sales-bill.service.ts`.
- Bill-update route did update → delete items → insert items as three independent, non-transactional calls — should be wrapped in one Postgres function via `.rpc()`.

## Target structure
```
sales/bills/
  page.tsx                (list — useERPQuery, not raw fetch)
  new/page.tsx              → SalesBillEditor mode="create"
  [id]/edit/page.tsx        → SalesBillEditor mode="edit"
  [id]/page.tsx              (BillHeaderCard, BillItemsView, BillTotalsCard, BillPaymentHistory, BillActionsBar)
  [id]/print/page.tsx        (PrintHeader, PrintPartyInfo, PrintItemsTable, PrintTotalsFooter)
  components/
    SalesBillEditor.tsx, CustomerSection.tsx, ItemsTable.tsx, PaymentSection.tsx, TotalsPanel.tsx, TaxCalculator.tsx, BillValidation.tsx

repositories/sales-bill.repository.ts   (only file calling Supabase for this domain)
services/sales-bill.service.ts           (GST/total calculation — single source — business validation)
hooks/useSalesBill.ts                     (returns { bill, customer, items, totals, actions, validation, loading })
schemas/sale-bill.schema.ts               (shared between form and API route)
```

## Conventions specific to this module
- Never bypass `SalesBillService` for total/GST calculation anywhere else in the app — import it, don't reimplement it.
- `mode="create"` and `mode="edit"` stay one `SalesBillEditor` — never fork into two files again.
- Line items use `crypto.randomUUID()` as key for unsaved rows, DB `id` once saved — never array index.

## Don't re-flag as new findings
Oversized page components, zero React Query usage, duplicated fetch calls, duplicated GST calculation, non-transactional bill-update writes — all already identified, check P1 #13's current status before re-reporting.
