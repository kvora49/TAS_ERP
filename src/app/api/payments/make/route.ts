import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");

  try {
    if (partyId) {
      // 1. Fetch Outstanding items from 3 different sources
      const [rmPurchasesResult, fgPurchasesResult, jobWorkResult] = await Promise.all([
        supabase
          .from("raw_material_purchases")
          .select("id, purchase_number, invoice_date, due_date, grand_total, paid_amount, payment_status")
          .eq("supplier_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),
        supabase
          .from("purchase_bills")
          .select("id, bill_number, invoice_date, due_date, grand_total, paid_amount, payment_status")
          .eq("supplier_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),
        supabase
          .from("stage_entries")
          .select("id, entry_number, entry_date, total_job_work_amount, paid_amount, payment_status")
          .eq("worker_id", partyId)
          .eq("business_id", businessId)
          .neq("payment_status", "paid"),
      ]);

      const rmPurchases = rmPurchasesResult.data || [];
      const fgPurchases = fgPurchasesResult.data || [];
      const jobWork = jobWorkResult.data || [];

      // Combine and format them
      const outstandingBills: any[] = [];

      rmPurchases.forEach((p) => {
        outstandingBills.push({
          id: p.id,
          invoice_number: p.purchase_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "raw_material_purchase",
        });
      });

      fgPurchases.forEach((p) => {
        outstandingBills.push({
          id: p.id,
          invoice_number: p.bill_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "purchase_bill",
        });
      });

      jobWork.forEach((jw) => {
        const total = Number(jw.total_job_work_amount || 0);
        const paid = Number(jw.paid_amount || 0);
        if (total > paid) {
          outstandingBills.push({
            id: jw.id,
            invoice_number: jw.entry_number,
            invoice_date: jw.entry_date,
            due_date: jw.entry_date,
            total: total,
            outstanding: total - paid,
            bill_type: "job_work_entry",
          });
        }
      });

      return NextResponse.json({ bills: outstandingBills });
    } else {
      // 2. Fetch Suppliers & Workers
      const { data: parties, error: partiesError } = await supabase
        .from("parties")
        .select("id, name, company_name, phone, type, opening_balance")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (partiesError) {
        return NextResponse.json({ error: partiesError.message }, { status: 500 });
      }

      // Filter suppliers or workers
      const payees = parties.filter(
        (p) => p.type?.includes("supplier") || p.type?.includes("worker")
      );

      // Fetch bank accounts
      const { data: banks } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number, sub_label, type, is_default, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      const formattedBanks = (banks || []).map((b: any) => ({
        id: b.id,
        name: b.name || b.bank_name || "Bank Account",
        account_name: b.name || b.bank_name || "Bank Account",
        bank_name: b.bank_name || b.sub_label || (b.type ? b.type.toUpperCase() : "Bank"),
        account_number: b.account_number || "",
        is_default: !!b.is_default,
      }));

      return NextResponse.json({ payees, bankAccounts: formattedBanks });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User session not found" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      party_id,
      amount,
      payment_date,
      payment_mode,
      reference_no,
      bank_account_id,
      remarks,
      allocations, // Array of { billId, allocatedAmount, billType }
    } = body;

    // Server-side validation
    if (!party_id || !amount || !payment_date || !payment_mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call record_payment database RPC function for direction: 'paid'
    const { data: paymentId, error } = await supabase.rpc("record_payment", {
      p_business_id: businessId,
      p_direction: "paid",
      p_party_id: party_id,
      p_payment_date: payment_date,
      p_payment_mode: payment_mode,
      p_reference_no: reference_no || "",
      p_bank_account_id: bank_account_id || null,
      p_amount: Number(amount),
      p_remarks: remarks || "",
      p_allocations: allocations || [],
      p_created_by: userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process bill allocations for outgoing payments
    if (paymentId && allocations && Array.isArray(allocations) && allocations.length > 0) {
      let totalAllocated = 0;
      for (const alloc of allocations) {
        const billId = alloc.billId || alloc.bill_id;
        const allocatedAmount = Number(alloc.allocatedAmount || alloc.allocated_amount || alloc.amount || 0);
        const billType = alloc.billType || alloc.bill_type || "purchase_bill";

        if (billId && allocatedAmount > 0) {
          totalAllocated += allocatedAmount;

          if (billType === "raw_material_purchase") {
            const { data: rm } = await supabase
              .from("raw_material_purchases")
              .select("grand_total, paid_amount")
              .eq("id", billId)
              .maybeSingle();

            if (rm) {
              const currentPaid = Number(rm.paid_amount || 0);
              const grandTotal = Number(rm.grand_total || 0);
              const newPaid = currentPaid + allocatedAmount;
              const newStatus = newPaid >= grandTotal ? "paid" : "partially_paid";

              await supabase
                .from("raw_material_purchases")
                .update({ paid_amount: newPaid, payment_status: newStatus })
                .eq("id", billId);
            }
          } else if (billType === "job_work_entry") {
            const { data: jw } = await supabase
              .from("job_work_entries")
              .select("total_job_work_amount, paid_amount")
              .eq("id", billId)
              .maybeSingle();

            if (jw) {
              const currentPaid = Number(jw.paid_amount || 0);
              const grandTotal = Number(jw.total_job_work_amount || 0);
              const newPaid = currentPaid + allocatedAmount;
              const newStatus = newPaid >= grandTotal ? "paid" : "partially_paid";

              await supabase
                .from("job_work_entries")
                .update({ paid_amount: newPaid, status: newStatus })
                .eq("id", billId);
            }
          }

          await supabase
            .from("payment_allocations")
            .insert({
              business_id: businessId,
              payment_id: paymentId,
              bill_id: billId,
              bill_type: billType,
              amount: allocatedAmount,
              created_by: userId,
            });
        }
      }

      if (totalAllocated > 0) {
        const { data: pRec } = await supabase
          .from("payments")
          .select("amount")
          .eq("id", paymentId)
          .maybeSingle();

        if (pRec) {
          const newUnallocated = Math.max(0, Number(pRec.amount || 0) - totalAllocated);
          await supabase
            .from("payments")
            .update({ unallocated_amount: newUnallocated })
            .eq("id", paymentId);
        }
      }
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
