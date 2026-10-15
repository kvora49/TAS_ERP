# Delivery challans and deployment configuration

## Delivery challans

Create a challan from the invoice success dialog, the e-invoice success dialog,
the sales bill detail page, or Sales & Billing → Delivery challans using a bill ID.
The document records the invoice's full quantity once; it does not deduct stock again.
Saved challans are immutable snapshots. Partial shipments are not supported by this workflow.

Shipping details are separate from billing details. Users must confirm the shipping
address, or explicitly select Use billing address. Recorded rolls, meters, garment
designs, sizes and quantities come from the bill. Supplementary serial, weight,
width and quality details can be entered before saving.

Print and Download PDF use the same compact A4 document with customer and company
signature spaces. Long documents repeat item headings and page references.

Migration: `20261003000025_sales_delivery_challans.sql`. Access is tenant-scoped
and checked against trusted Sales & Billing permissions. A source-version check
rejects saving against an invoice changed since the draft was loaded.

Validation commands:

```sh
node scripts/test-delivery-challan.cjs
node scripts/test-delivery-challan-db.mjs
node scripts/test-supabase-build-env.mjs
npm run typecheck
npm run build:worker
```

Validation performed: model/PDF tests, database permission and stale-source tests,
TypeScript and Next.js production build passed. Compact (one page) and long
(six pages) PDF fixtures were rendered and visually inspected; text remained
inside page bounds and the signatures appeared on the final page. The hosted
database lookup plan measured 0.03 ms. PDF code is loaded only on export/print;
draft reads are bounded and independent lookups are batched. Authenticated
end-to-end navigation, mobile/dark-mode visual checks and network latency targets
remain unmeasured because no signed-in browser session was available; the SQL
measurement does not represent full API latency.

## Cloudflare browser configuration

Next.js needs public Supabase configuration at build time. Worker runtime bindings
alone cannot configure an already-generated browser bundle. `next.config.mjs`
resolves the public URL and anon/publishable key from the build environment, falling
back to the public pair in `wrangler.toml`. An incomplete override fails the build;
service-role keys are rejected. Server secrets remain Worker secret bindings.

After deployment, verify that the login bundle contains the public project URL
and has no unresolved `process.env.NEXT_PUBLIC_SUPABASE_URL` reference.
