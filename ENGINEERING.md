# TAS ERP — Engineering Guide

Short, practical reference derived from what the codebase actually does — not aspirations.
Keep this updated as patterns evolve. See `brain.md` for high-level project context.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes (`src/app/api/`) |
| Database | Supabase (PostgreSQL + RLS) |
| Data Fetching | TanStack Query via `useERPQuery` / `useERPMutation` |
| Global State | Zustand (`src/store/index.ts`) — minimal, only cross-cutting UI state |
| Forms | React Hook Form + Zod (`src/schemas/`) |
| File Storage | Cloudflare R2 via presigned URLs (`/api/upload/presigned`) |
| UI Primitives | shadcn/ui (Radix) — `src/components/ui/` |
| Auth | Supabase Auth + JWT |

---

## Folder Structure

```
src/
  app/
    (dashboard)/           # All authenticated ERP pages
      master-data/         # Brands, Designs, Godowns, etc.
      sales/               # Bills, Cheques
      production/          # Lots, Stage Entries
      finance/             # Cheques
      parties/             # Customers / Suppliers / Workers
      settings/            # Company Profile, Users
    api/                   # All backend API routes
  components/
    ui/                    # shadcn primitives (do not modify directly)
    layout/                # PageHeader, Sidebar, etc.
    shared/                # ConfirmDialog, EmptyState, Skeletons, etc.
    forms/                 # ImageUpload, reusable form controls
    tables/                # DataTable (virtualized)
  lib/
    supabase/
      client.ts            # Browser client
      server.ts            # Server client + getSessionBusinessId()
  hooks/
    useERPQuery.ts         # Shared query/mutation wrapper - use this, not raw fetch+useEffect
    useFileUpload.ts       # R2 upload helper
  schemas/                 # Shared Zod schemas (frontend + backend)
  store/                   # Zustand global store
```

---

## Data Fetching — Always use useERPQuery

Never use raw `fetch()` + `useState` + `useEffect` in new pages.

```tsx
// Correct — use useERPQuery
const { data, isLoading } = useERPQuery<Design[]>(
  ["designs"],
  async () => {
    const res = await fetch("/api/master-data/designs");
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    return data.designs;
  }
);
```

---

## Multi-Tenancy — Mandatory on every API route

```ts
// Every API route starts with this
const businessId = await getSessionBusinessId(request);

// Always filter by business_id — never trust client-supplied values
const { data } = await supabase
  .from("designs")
  .select("*")
  .eq("business_id", businessId);
```

---

## God-Component Prevention

| File type | Max lines |
|---|---|
| Page (list) | 150-200 |
| Page (detail) | 300-400 |
| Sub-component | 200-300 |

When exceeded, extract: dialogs -> `_components/XxxDialog.tsx`, panels -> `_components/XxxPanel.tsx`

---

## Images — Use next/image

```tsx
// Correct
import Image from "next/image";
<Image src={logoUrl} alt="Logo" width={40} height={40} className="..." />
```

Remote domains configured in `next.config.mjs`: `*.r2.dev`, `*.supabase.co`
Exception: print layout pages may keep `<img>` where layout depends on it.

---

## Security Checklist (before marking any feature complete)

- API route starts with `getSessionBusinessId()`
- All DB queries filter by `business_id`
- Input validated with Zod before use
- No sensitive data exposed unnecessarily
- File uploads go through `/api/upload/presigned`
- QR/barcode codes contain only UUIDs, not business data

---

## Performance Rules

- Parallelize independent Supabase queries with `Promise.all()`
- Paginate all list endpoints (default 50 items)
- Add DB indexes for `business_id` + foreign key filter columns
- Use TanStack Query cache — don't re-fetch on every render

---

*Last updated: P2/P3 implementation pass. Derived from actual codebase.*
