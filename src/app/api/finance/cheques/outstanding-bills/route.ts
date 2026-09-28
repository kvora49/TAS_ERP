import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");
  const direction = searchParams.get("direction") || "received";

  if (!partyId) {
    return NextResponse.json({ bills: [] });
  }

  try {
    const outstandingBills: any[] = [];

    if (direction === "received") {
      // Fetch unpaid or partially paid sales bills for customer
      const { data: sales, error } = await supabase
        .from("sale_bills")
        .select("id, bill_number, bill_date, payment_due_date, grand_total, paid_amount, payment_status")
        .eq("business_id", businessId)
        .eq("party_id", partyId)
        .neq("status", "cancelled")
        .order("bill_date", { ascending: true });

      if (error) throw error;

      (sales || []).forEach((s) => {
        const total = Number(s.grand_total || 0);
        const paid = Number(s.paid_amount || 0);
        const outstanding = total - paid;
        if (outstanding > 0) {
          outstandingBills.push({
            id: s.id,
            invoice_number: s.bill_number,
            invoice_date: s.bill_date,
            due_date: s.payment_due_date || s.bill_date,
            total,
            paid,
            outstanding,
            bill_type: "sale_bill",
          });
        }
      });
    } else {
      // Issued cheques to Supplier or Job Worker
      // 1. Raw material purchases
      const [rmPurchasesResult, purchaseBillsResult, jobWorkResult] = await Promise.all([
        supabase
          .from("raw_material_purchases")
          .select("id, purchase_number, invoice_date, grand_total, paid_amount, payment_status")
          .eq("business_id", businessId)
          .eq("supplier_id", partyId)
          .neq("status", "cancelled")
          .is("deleted_at", null)
          .order("invoice_date", { ascending: true }),

        supabase
          .from("purchase_bills")
          .select("id, bill_number, invoice_date, grand_total, paid_amount, payment_status")
          .eq("business_id", businessId)
          .eq("supplier_id", partyId)
          .neq("status", "cancelled")
          .order("invoice_date", { ascending: true }),

        supabase
          .from("stage_entries")
          .select("id, entry_number, entry_date, total_job_work_amount, paid_amount, payment_status")
          .eq("business_id", businessId)
          .eq("worker_id", partyId)
          .order("entry_date", { ascending: true }),
      ]);

      (rmPurchasesResult.data || []).forEach((rm) => {
        const total = Number(rm.grand_total || 0);
        const paid = Number(rm.paid_amount || 0);
        const outstanding = total - paid;
        if (outstanding > 0) {
          outstandingBills.push({
            id: rm.id,
            invoice_number: rm.purchase_number,
            invoice_date: rm.invoice_date,
            due_date: rm.invoice_date,
            total,
            paid,
            outstanding,
            bill_type: "raw_material_purchase",
          });
        }
      });

      (purchaseBillsResult.data || []).forEach((pb) => {
        const total = Number(pb.grand_total || 0);
        const paid = Number(pb.paid_amount || 0);
        const outstanding = total - paid;
        if (outstanding > 0) {
          outstandingBills.push({
            id: pb.id,
            invoice_number: pb.bill_number,
            invoice_date: pb.invoice_date,
            due_date: pb.invoice_date,
            total,
            paid,
            outstanding,
            bill_type: "purchase_bill",
          });
        }
      });

      (jobWorkResult.data || []).forEach((jw) => {
        const total = Number(jw.total_job_work_amount || 0);
        const paid = Number(jw.paid_amount || 0);
        const outstanding = total - paid;
        if (outstanding > 0) {
          outstandingBills.push({
            id: jw.id,
            invoice_number: jw.entry_number,
            invoice_date: jw.entry_date,
            due_date: jw.entry_date,
            total,
            paid,
            outstanding,
            bill_type: "job_work_entry",
          });
        }
      });
    }

    return NextResponse.json({ bills: outstandingBills });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load outstanding bills" },
      { status: 500 }
    );
  }
}
