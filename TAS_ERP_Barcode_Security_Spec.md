# TAS ERP — Barcode & QR Code Security Specification
**Addendum to Phase 5 | Replaces all previous barcode implementation notes**

---

## Decision — Raw UUID Only

The QR code payload must contain **only a raw UUID string** and nothing else.

```
8f6e0b6b-6d47-4f2d-9d22-87e4b52b0f9e
```

No URL prefix. No business identifiers. No design codes. No readable data.

**Reason:** A URL like `https://erp.tas.com/scan/uuid` still reveals:
- The product name `tas.com`
- That a `/scan/` endpoint exists
- The domain of the ERP system being used

A raw UUID reveals nothing. To anyone scanning externally it is completely meaningless.

---

## What Changes in Phase 5

### 1. DB Schema — Add `qr_uuid` to `finished_stock`

```sql
ALTER TABLE finished_stock
  ADD COLUMN qr_uuid UUID UNIQUE DEFAULT gen_random_uuid();

CREATE INDEX idx_finished_stock_qr_uuid ON finished_stock(qr_uuid);
```

No other table needs a `qr_uuid`. Only `finished_stock` gets one — because QR labels are placed on finished garment stock only.

When a new `finished_stock` record is created (manually or via lot completion), `gen_random_uuid()` auto-generates the UUID. No extra step needed.

---

### 2. QR Code Generation — Encode Raw UUID Only

```ts
// lib/utils/barcode.ts
import QRCode from 'qrcode'

export async function generateQRCode(qrUuid: string): Promise<string> {
  // Encode ONLY the raw UUID — no URL, no prefix
  const dataUrl = await QRCode.toDataURL(qrUuid, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 200,
  })
  return dataUrl
}
```

Result when scanned by any external app:
```
8f6e0b6b-6d47-4f2d-9d22-87e4b52b0f9e
```
That string tells the scanner nothing about the business, product, or system.

---

### 3. Scan Lookup API — UUID + business_id isolation

```ts
// app/api/finished-stock/barcode/scan/route.ts
export async function POST(req: Request) {
  const supabase = await createClient()

  // Step 1: Verify authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Step 2: Get user's business_id
  const { data: profile } = await supabase
    .from('users')
    .select('business_id')
    .eq('id', user.id)
    .single()

  const { qr_uuid } = await req.json()

  // Step 3: Lookup with BOTH uuid AND business_id
  // RLS also enforces business_id — this is double protection
  const { data: stock, error } = await supabase
    .from('finished_stock')
    .select(`
      *,
      designs(design_number, name, images),
      design_colours(colour_name, colour_hex),
      godowns(name)
    `)
    .eq('qr_uuid', qr_uuid)
    .eq('business_id', profile!.business_id)
    .single()

  // Step 4: Record scan in history regardless of result
  await supabase.from('barcode_scan_history').insert({
    business_id: profile!.business_id,
    qr_uuid_scanned: qr_uuid,
    scan_result: stock ? 'found' : 'not_found',
    scanned_by: user.id,
  })

  if (error || !stock) {
    return Response.json({
      found: false,
      message: 'Stock not found or unauthorized.'
    }, { status: 404 })
  }

  return Response.json({ found: true, stock })
}
```

---

### 4. External Scanning Behaviour

| Scenario | What They See | What They Get |
|---|---|---|
| Scanned with phone camera | Nothing (UUID is not a URL, no browser action) | Nothing |
| Scanned with generic QR app | `8f6e0b6b-6d47-4f2d-9d22-87e4b52b0f9e` | A meaningless string |
| Scanned by competitor | Same UUID string | No product info, no ERP domain revealed |
| Scanned by another TAS ERP tenant | UUID visible but backend returns 404 | `business_id` mismatch — no data |
| Scanned inside TAS ERP app (authenticated) | UUID → API lookup → full stock info | ✅ Correct behaviour |

---

### 5. Printed Label — Human-Readable Text Below QR

The physical sticker printed for warehouse use:

```
┌──────────────────────────┐
│                          │
│   ████ ██ ███ ██ ████    │
│   ██       ██       ██   │
│   ██ █████████████  ██   │  ← QR image (UUID payload only)
│   ██ █     ███  █   ██   │
│   ████ ██ ███ ██ ████    │
│                          │
│  DES-001                 │  ← human-readable only
│  Premium Kurti           │
│  Red · M                 │
│  Main Godown             │
└──────────────────────────┘
```

**Rules for label printing:**
- QR image: UUID payload only (as specified above)
- Text below: design code, name, colour, size, godown — for warehouse staff convenience
- Text is human-readable only — NOT encoded in the QR
- Text can be printed even if warehouse staff doesn't have app access
- Scanning the QR with any app gives only the UUID — never the text values

---

### 6. Update `barcode_scan_history` Table

```sql
-- Replace old barcode_scan_history with updated schema
DROP TABLE IF EXISTS barcode_scan_history;

CREATE TABLE barcode_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  qr_uuid_scanned UUID NOT NULL,        -- the UUID that was scanned
  finished_stock_id UUID REFERENCES finished_stock(id), -- NULL if not found
  scan_result TEXT NOT NULL CHECK (scan_result IN ('found','not_found')),
  action_taken TEXT,                    -- 'add_to_bill', 'view_stock', etc.
  scanned_by UUID REFERENCES users(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE barcode_scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON barcode_scan_history
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
```

---

### 7. PWA Scanner — Input Handling

The PWA scanner (html5-qrcode) reads whatever is in the QR. Since the payload is a raw UUID, the input handler just validates UUID format before sending to API:

```ts
// hooks/useQRScanner.ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function onScanSuccess(decodedText: string) {
  const trimmed = decodedText.trim()

  // Validate it's a UUID format
  if (!UUID_REGEX.test(trimmed)) {
    toast.error('Invalid QR code. Please scan a TAS ERP label.')
    return
  }

  // Send to lookup API
  lookupStock(trimmed)
}
```

If someone tries to manually type a fake UUID → API returns 404 (not found in this business).
If a physical barcode from another system is scanned → fails UUID format check → error toast.

---

## Summary

| What | Value |
|---|---|
| QR payload | Raw UUID only — `8f6e0b6b-6d47-4f2d-9d22-87e4b52b0f9e` |
| URL in QR? | ❌ Never |
| Business data in QR? | ❌ Never |
| Human text on label | ✅ Printed below QR for warehouse staff |
| Lookup requires auth? | ✅ Always |
| Cross-tenant protection | ✅ RLS + explicit `business_id` filter |
| External scanner result | Meaningless UUID string — no product info |

---

*TAS ERP Barcode Security Specification | Addendum to Phase 5 | June 2026*
