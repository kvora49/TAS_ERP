# TAS ERP — GST E-Invoicing & E-Way Bill Production Playbook
**Phases 6, Operations, Security & Compliance, and Living Error Matrix**

---

## 1. Phase 6 — Production Cutover Checklist

Before switching traffic from the sandbox adapter to live IRIS IRP production:

| Step | Action | Status / Instructions |
|---|---|---|
| **1. Sandbox Sign-Off** | Submit required sandbox test cases to IRIS review team | Run `npx tsx scripts/test-einvoice-e2e.ts` and `npx tsx scripts/test-einvoice-engine.ts`. Capture logs and generate test JSON payloads as required by IRIS. |
| **2. Production Credentials** | Obtain production Client ID / Client Secret and API-User credentials | Generated from the IRIS IRP developer portal upon test case approval. |
| **3. Configuration Switch** | Zero code changes — Environment variable switch only | Set `EINVOICE_ADAPTER=iris`, `IRIS_API_URL=https://api.irisgst.com/einvoice/v1`, and set live production credentials in tenant settings. |
| **4. Pilot Tenant Launch** | Enable for one high-volume pilot tenant | Monitor closely for one complete billing cycle (30 days). |
| **5. Full Tenant Rollout** | Roll out to all eligible/opted-in tenants | In Settings > Company Profile, activate "Mandatory" or "Voluntary". |
| **6. Commercial Terms** | Written confirmation of tier limits | Confirm in writing with IRIS whether the free Basic tier has any hard invoice caps at production volume. |

---

## 2. Operations & Reconciliation Architecture

### 2.1. Nightly Reconciliation Job (`/api/cron/einvoice-reconcile`)
* **Objective**: Automatically resolves timeout/ambiguous invoices without duplicate submissions or silent data drift.
* **Mechanism**:
  1. Queries all `sale_bills` where `irn_status = 'pending'` and `created_at <= NOW() - INTERVAL '30 minutes'`.
  2. Calls `adapter.getIRNStatus({ docType: 'INV', docNo, docDate }, credentials)` to query the official state directly on the IRP.
  3. If registered on IRP: updates `irn`, `ack_no`, `ack_date`, `signed_qr_data`, marks `irn_status = 'registered'`, and locks the invoice (`locked_for_edit = true`).
  4. If older than 2 hours without IRP confirmation: marks `irn_status = 'failed'` and logs exception to `einvoice_error_log` so the user can re-generate with a single click.
* **Execution**: Scheduled via Vercel Cron, GitHub Actions, or on-demand via the Operations Console (`/settings/einvoice-operations`).

### 2.2. Operations & Monitoring Console (`/settings/einvoice-operations`)
* **KPI Metrics**: Total Registered IRNs, Pending Reconciliation, Failed Generations, Active E-Way Bills, Success Rate %.
* **Intelligent Outage & Spike Detection**:
  * **Data Quality Spike Alert**: Fires if tenant failure rate exceeds 15% (indicates dirty master data, such as missing PINs or invalid HSNs).
  * **IRP Gateway Outage Alert**: Fires if consecutive network timeouts (HTTP 504/100/102) occur upstream on the government portal.
* **Continuous Error Log Review**: Real-time table tracking `einvoice_error_log` to detect validation gaps.

---

## 3. Section 13 — Living IRP Error Handling Reference Matrix

| IRP Code | Error Meaning | TAS ERP Friendly Message | Caught Locally in Phase 2? | Validation Engine Rule |
|---|---|---|:---:|---|
| **2150** | Duplicate IRN: Document number already registered in FY | This invoice number has already been registered on the GST portal for this financial year. | **Yes** | Local database uniqueness validation |
| **2174** | Invalid Supplier GSTIN | Your company GSTIN in Settings > Company Profile is invalid or malformed. | **Yes** | Mod-36 Luhn check algorithm |
| **2175** | Invalid Recipient (Buyer) GSTIN | Customer GSTIN is invalid or failed mathematical checksum validation. | **Yes** | Mod-36 Luhn check algorithm |
| **2176** | Recipient GSTIN cancelled / inactive on GST portal | The customer's GSTIN is marked inactive or cancelled on the GST Portal. | **No** *(Live portal only)* | Requires external GST portal status sync |
| **2180** | Invalid Place of Supply (POS) State Code | Selected Place of Supply does not match any valid Indian state or UT. | **Yes** | State code master validation |
| **2181** | Supplier PIN code does not match State | Company PIN code does not correspond to the company state. | **Yes** | PIN code prefix vs State code check |
| **2182** | Buyer PIN code does not match State | Buyer PIN code does not correspond to the recipient state. | **Yes** | PIN code prefix vs State code check |
| **2201** | Invoice date cannot be in future | Invoice date cannot be in the future. | **Yes** | Strict date range check |
| **2202** | Invoice older than 30 days for AATO ≥ ₹10 Cr | For businesses with turnover ≥ ₹10 Cr, invoices must be reported within 30 days of invoice date. | **Yes** | 30-day cutoff evaluation |
| **2203** | Invalid document number format | Invoice number must be ≤ 16 characters containing only alphanumeric, / or -. | **Yes** | Invoice number regex check |
| **2250** | Missing or empty HSN code on item | One or more line items is missing an HSN code. | **Yes** | Item-level HSN presence check |
| **2251** | HSN code < 6 digits for turnover > ₹5 Cr | HSN code must have at least 6 digits for businesses with turnover exceeding ₹5 Crore. | **Yes** | Turnover bracket HSN length rule |
| **2252** | HSN code < 4 digits for turnover ≤ ₹5 Cr | HSN code must have at least 4 digits for businesses with turnover up to ₹5 Crore. | **Yes** | Minimum 4-digit HSN check |
| **2260** | Tax calculation mismatch | Tax amount does not equal taxable value multiplied by tax rate. | **Yes** | Tax reconciliation with ₹1.00 tolerance |
| **2261** | Intra-state invoice charging IGST | Intra-state sales must charge equal CGST and SGST, not IGST. | **Yes** | Place of Supply tax parity rule |
| **2262** | Inter-state invoice charging CGST/SGST | Inter-state sales must charge IGST, not CGST or SGST. | **Yes** | Place of Supply tax parity rule |
| **2300** | 24-Hour cancellation window expired | E-invoices can only be cancelled on the IRP within 24 hours of generation. | **Yes** | Client-side cancellation timer check |
| **2302** | Active E-Way bill linked to IRN | The linked E-Way Bill must be cancelled before cancelling this e-invoice. | **Yes** | Linked E-Way Bill check |
| **100** | Invalid authentication credentials | IRP authentication credentials invalid or session expired. | **No** | Upstream auth handshake |
| **102** | IRP Auth token expired | IRP token expired; re-authentication required. | **No** | Auto-refreshed by adapter |

---

## 4. Security & Compliance Notes

1. **Credentials & Token Encryption**:
   * Client IDs, secrets, and auth tokens are stored encrypted per tenant in `businesses` table.
   * Credentials are never returned in public API payloads and never logged in plaintext.
2. **Legal Evidence Backups**:
   * `signed_invoice_json` and `signed_qr_data` represent the statutory legal proof of tax invoice registration.
   * Both fields are permanently retained on `sale_bills` and backed up alongside transactional ledger entries.
3. **Strict Server-Side Immutability**:
   * Once an invoice receives a valid IRN (`irn_status = 'registered'`), `locked_for_edit = true` is enforced on the database level and server-side in `SalesBillService.validateAndUpdate`. Any attempt to modify a locked invoice via API returns HTTP 400.
4. **2FA / MFA Re-Authentication Handling**:
   * Government IRP requires periodic password rotation and OTP re-verification.
   * The system detects token expiry (`irp_token_expiry`) and marks `irp_onboarding_status = 'otp_pending'` if interactive re-verification is required.

---

## 5. Credential Architecture & Tenant Onboarding Model

### 5.1. Two-Layer Credential Model
| Layer | Scope | Where Configured | Secret Visibility |
|---|---|---|---|
| **Layer 1: TAS ↔ IRIS Platform Credentials** | Identifies **TAS the application** to IRIS IRP across sandbox & production. | Server `.env.local` / production environment: `IRIS_CLIENT_ID`, `IRIS_CLIENT_SECRET`, `IRIS_API_URL`. | **Server Only**. Never touches the browser, never displayed to tenants, never stored in client state. |
| **Layer 2: GSTIN ↔ Government Authorization** | Legal taxpayer consent authorizing IRIS to act as the taxpayer's GSP. | Created by taxpayer on `einvoice1.gst.gov.in` under *API Registration → Through GSP*. Linked in TAS Settings > Company Profile. | Handshake relayed server-to-server. Passwords encrypted at rest, masked, and never echoed back in GET requests. |

### 5.2. Tenant Step-by-Step Onboarding Guide (For Business Owners / Garment Manufacturers)
1. **Log in to GST E-Invoice Portal**: Visit [einvoice1.gst.gov.in](https://einvoice1.gst.gov.in) with company credentials.
2. **API Registration**: In the main navigation, click **API Registration** → **Create API User** → choose **Through GSP**.
3. **Select GSP Partner**: Select **IRIS Business Services Limited** from the authorized GSP drop-down.
4. **Create API User**: Enter a dedicated **GSP API Username** and **GSP API Password** (note: this is a special API credential separate from your main GST tax return password).
5. **Connect in TAS ERP**: Open **Settings → Company Profile** in TAS ERP, enter the GSP API Username & Password, and click **Authorize & Connect GSTIN**.
6. **Live Verification**: TAS ERP communicates server-to-server with IRIS to establish a live session. Once verified, the tenant status turns green (**GSTIN Authorized & Live**). Invoices and delivery challans can immediately generate compliant IRNs and E-Way Bills with a single click.

---

## 6. Answers to Operational Questions with IRIS

1. **ERP Provider Master Credentials vs Tenant Credentials**:
   * TAS ERP acts as the registered ERP/GSP Intermediary using Layer 1 master credentials (`IRIS_CLIENT_ID` / `IRIS_CLIENT_SECRET`). Tenants supply only their Layer 2 GSP API Username & Password generated under "Through GSP".
2. **Volume Cap on Free Basic Tier**:
   * Production scale requires confirmation of monthly generation quotas. If monthly invoice volume exceeds 1,000 invoices/month, commercial enterprise licensing with SLA guarantees must be active.
3. **Per-Invoice Line Item Limit**:
   * Schema limit for NIC INV-01 is 1,000 line items. The local pre-validation engine automatically enforces `max_invoice_line_items = 1000`.
4. **OTP / 2FA Sequence for Tenant GSTIN Authorization**:
   * The initial handshake triggers an OTP to the authorized signatory registered on the GST portal. Once verified, auth tokens remain active for 6 to 24 hours, automatically refreshed by the adapter.

