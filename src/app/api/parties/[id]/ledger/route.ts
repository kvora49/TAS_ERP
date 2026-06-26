import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. Fetch Party Details
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("type, opening_balance, opening_balance_date, created_at")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (partyError) {
      return NextResponse.json({ error: partyError.message }, { status: 404 });
    }

    const isCustomerOnly = party.type?.includes("customer") && !party.type?.includes("supplier");

    // 2. Fetch Purchases
    const { data: purchases, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .select("id, purchase_number, invoice_date, grand_total, status")
      .eq("supplier_id", id)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("deleted_at", null);

    // 3. Fetch Returns
    const { data: returns, error: returnError } = await supabase
      .from("purchase_returns")
      .select("id, return_number, return_date, grand_total, status")
      .eq("supplier_id", id)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("deleted_at", null);

    // 4. Fetch Payments
    const { data: payments, error: paymentError } = await supabase
      .from("purchase_payments")
      .select("id, payment_date, payment_mode, reference_no, paid_amount, status")
      .eq("supplier_id", id)
      .eq("business_id", businessId)
      .eq("status", "success");

    // 5. Build Ledger Entries
    const entries: any[] = [];

    // Add Opening Balance if exists
    const obDate = party.opening_balance_date 
      ? party.opening_balance_date 
      : party.created_at.split("T")[0];
    
    const obVal = Number(party.opening_balance || 0);
    if (obVal !== 0) {
      entries.push({
        date: obDate,
        particulars: "Opening Balance",
        voucherType: "Opening",
        voucherNo: "-",
        debit: obVal < 0 ? Math.abs(obVal) : 0,
        credit: obVal > 0 ? obVal : 0,
        sortOrder: 0,
      });
    } else {
      // Always add an opening balance row even if 0, for continuity
      entries.push({
        date: obDate,
        particulars: "Opening Balance",
        voucherType: "Opening",
        voucherNo: "-",
        debit: 0,
        credit: 0,
        sortOrder: 0,
      });
    }

    // Add Purchases
    if (purchases) {
      purchases.forEach((p) => {
        entries.push({
          date: p.invoice_date,
          particulars: `Purchase Invoice #${p.purchase_number}`,
          voucherType: "Purchase",
          voucherNo: p.purchase_number,
          debit: 0,
          credit: Number(p.grand_total),
          sortOrder: 1,
        });
      });
    }

    // Add Returns
    if (returns) {
      returns.forEach((r) => {
        entries.push({
          date: r.return_date,
          particulars: `Purchase Return #${r.return_number}`,
          voucherType: "Return",
          voucherNo: r.return_number,
          debit: Number(r.grand_total),
          credit: 0,
          sortOrder: 2,
        });
      });
    }

    // Add Payments
    if (payments) {
      payments.forEach((py) => {
        const mode = py.payment_mode ? py.payment_mode.replace("_", " ").toUpperCase() : "PAYMENT";
        entries.push({
          date: py.payment_date,
          particulars: `Payment via ${mode} ${py.reference_no ? "(" + py.reference_no + ")" : ""}`,
          voucherType: "Payment",
          voucherNo: py.reference_no || py.id.substring(0, 8).toUpperCase(),
          debit: Number(py.paid_amount),
          credit: 0,
          sortOrder: 3,
        });
      });
    }

    // Sort entries: Chronologically by date, then by sortOrder
    entries.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.sortOrder - b.sortOrder;
    });

    // Compute running balance
    let runningBalance = 0;
    const ledger = entries.map((entry) => {
      if (isCustomerOnly) {
        // Customer: Debit increases, Credit decreases
        runningBalance += entry.debit - entry.credit;
        return {
          ...entry,
          balance: runningBalance,
          balanceSign: runningBalance >= 0 ? "Dr" : "Cr",
          balanceStr: `${Math.abs(runningBalance).toFixed(2)} ${runningBalance >= 0 ? "Dr" : "Cr"}`,
        };
      } else {
        // Supplier / Other: Credit increases, Debit decreases
        runningBalance += entry.credit - entry.debit;
        return {
          ...entry,
          balance: runningBalance,
          balanceSign: runningBalance >= 0 ? "Cr" : "Dr",
          balanceStr: `${Math.abs(runningBalance).toFixed(2)} ${runningBalance >= 0 ? "Cr" : "Dr"}`,
        };
      }
    });

    return NextResponse.json({ ledger });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
