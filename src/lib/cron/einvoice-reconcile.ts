import { createAdminClient } from "@/lib/supabase/admin";
import { getEInvoiceAdapter } from "@/lib/einvoice";
import { logAudit } from "@/lib/audit";

export interface EinvoiceReconcileOptions {
  businessId?: string;
  customSupabase?: any;
}

export async function runEinvoiceReconcileJob(options: EinvoiceReconcileOptions = {}) {
  const { businessId, customSupabase } = options;
  const supabase = customSupabase || createAdminClient();

  // 30 minutes threshold
  const cutoffDate = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Query pending invoices
  let query = supabase
    .from("sale_bills")
    .select("id, business_id, bill_number, bill_date, irn_status, grand_total, created_at")
    .eq("irn_status", "pending")
    .lte("created_at", cutoffDate);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data: pendingBills, error: fetchErr } = await query.limit(100);

  if (fetchErr) {
    throw fetchErr;
  }

  if (!pendingBills || pendingBills.length === 0) {
    return {
      success: true,
      scanned: 0,
      resolved: 0,
      failed: 0,
      unchanged: 0,
      message: "No pending e-invoices requiring reconciliation found.",
    };
  }

  // Fetch tenant businesses credentials in bulk
  const bizIds = Array.from(new Set(pendingBills.map((b: any) => b.business_id)));
  const { data: businesses, error: bizErr } = await supabase
    .from("businesses")
    .select("id, name, gstin, irp_client_id, irp_auth_token, irp_token_expiry")
    .in("id", bizIds);

  if (bizErr) {
    throw bizErr;
  }

  const bizMap = new Map<string, any>((businesses || []).map((b: any) => [b.id, b]));
  const adapter = getEInvoiceAdapter();

  let resolvedCount = 0;
  let failedCount = 0;
  let unchangedCount = 0;

  for (const bill of pendingBills) {
    const biz = bizMap.get(bill.business_id);
    if (!biz || !biz.gstin) {
      unchangedCount++;
      continue;
    }

    const credentials = {
      gstin: biz.gstin,
      clientId: process.env.IRIS_CLIENT_ID,
      clientSecret: process.env.IRIS_CLIENT_SECRET,
      userName: biz.irp_client_id || undefined,
      authToken: biz.irp_auth_token || undefined,
      tokenExpiry: biz.irp_token_expiry || undefined,
    };

    try {
      const statusResult = await adapter.getIRNStatus(
        {
          docType: "INV",
          docNo: bill.bill_number,
          docDate: bill.bill_date,
        },
        credentials
      );

      if (statusResult.success && statusResult.irn) {
        // Resolved on IRP as successfully registered
        await supabase
          .from("sale_bills")
          .update({
            irn: statusResult.irn,
            irn_status: statusResult.status || "registered",
            ack_no: statusResult.ackNo,
            ack_date: statusResult.ackDate,
            signed_qr_data: statusResult.signedQrData,
            locked_for_edit: statusResult.status === "registered",
            updated_at: new Date().toISOString(),
          })
          .eq("id", bill.id);

        await logAudit(
          bill.business_id,
          "einvoice_reconcile_resolved",
          "sale_bills",
          bill.id,
          { irn: statusResult.irn, status: statusResult.status }
        );

        resolvedCount++;
      } else {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const isStale = new Date(bill.created_at).getTime() < twoHoursAgo;

        if (isStale) {
          await supabase
            .from("sale_bills")
            .update({
              irn_status: "failed",
              locked_for_edit: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", bill.id);

          await supabase.from("einvoice_error_log").insert({
            business_id: bill.business_id,
            invoice_id: bill.id,
            irp_error_code: "TIMEOUT_UNRESOLVED",
            friendly_message: "Invoice remained in pending status without IRP confirmation. Re-validation required.",
            raw_response: JSON.stringify({ bill_number: bill.bill_number, bill_date: bill.bill_date }),
          });

          failedCount++;
        } else {
          unchangedCount++;
        }
      }
    } catch (err: any) {
      console.error(`Reconciliation failed for bill ${bill.id}:`, err);
      unchangedCount++;
    }
  }

  return {
    success: true,
    scanned: pendingBills.length,
    resolved: resolvedCount,
    failed: failedCount,
    unchanged: unchangedCount,
    message: `Reconciliation finished: ${resolvedCount} resolved, ${failedCount} marked failed, ${unchangedCount} unchanged.`,
  };
}
