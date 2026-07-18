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
    // 1. Fetch Party Details and Transactions in Parallel
    const [
      partyResult,
      purchasesResult,
      purchaseBillsResult,
      saleBillsResult,
      returnsResult,
      legacyPaymentsResult,
      newPaymentsResult,
      writeOffsResult,
      allocationsResult,
    ] = await Promise.all([
      supabase
        .from("parties")
        .select("type, opening_balance, opening_balance_date, created_at")
        .eq("id", id)
        .eq("business_id", businessId)
        .single(),
      supabase
        .from("raw_material_purchases")
        .select("id, purchase_number, invoice_date, grand_total, status")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null),
      supabase
        .from("purchase_bills")
        .select("id, bill_number, invoice_date, grand_total, status")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled"),
      supabase
        .from("sale_bills")
        .select("id, invoice_number, invoice_date, grand_total, status")
        .eq("customer_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled"),
      supabase
        .from("purchase_returns")
        .select("id, return_number, return_date, grand_total, status")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null),
      supabase
        .from("purchase_payments")
        .select("id, payment_date, payment_mode, reference_no, paid_amount, status")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .eq("status", "success"),
      supabase
        .from("payments")
        .select("id, payment_date, direction, payment_mode, reference_no, amount, unallocated_amount, is_advance, remarks, status")
        .eq("party_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled"),
      supabase
        .from("write_offs")
        .select("id, bill_type, bill_id, write_off_type, amount, remarks, written_off_at")
        .eq("business_id", businessId)
        .is("reversed_at", null),
      supabase
        .from("payment_allocations")
        .select("payment_id, bill_type, bill_id, allocated_amount")
        .eq("business_id", businessId),
    ]);

    const party = partyResult.data;
    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const purchases = purchasesResult.data || [];
    const purchaseBills = purchaseBillsResult.data || [];
    const saleBills = saleBillsResult.data || [];
    const returns = returnsResult.data || [];
    const legacyPayments = legacyPaymentsResult.data || [];
    const newPayments = newPaymentsResult.data || [];
    const writeOffs = writeOffsResult.data || [];
    const allocations = allocationsResult.data || [];

    // Helper map to find bill/invoice numbers by ID
    const billMap: Record<string, string> = {};
    purchases.forEach((p) => (billMap[p.id] = p.purchase_number));
    purchaseBills.forEach((p) => (billMap[p.id] = p.bill_number));
    saleBills.forEach((s) => (billMap[s.id] = s.invoice_number));

    const isCustomerOnly = party.type?.includes("customer") && !party.type?.includes("supplier");

    // 2. Build Ledger Entries
    const entries: any[] = [];

    // Add Opening Balance
    const obDate = party.opening_balance_date 
      ? party.opening_balance_date 
      : party.created_at.split("T")[0];
    const obVal = Number(party.opening_balance || 0);
    entries.push({
      date: obDate,
      particulars: "Opening Balance",
      voucherType: "Opening",
      voucherNo: "-",
      debit: obVal < 0 ? Math.abs(obVal) : 0,
      credit: obVal > 0 ? obVal : 0,
      sortOrder: 0,
    });

    // Add Purchases (Raw Materials)
    purchases.forEach((p) => {
      entries.push({
        date: p.invoice_date,
        particulars: `Raw Material Purchase #${p.purchase_number}`,
        voucherType: "Purchase",
        voucherNo: p.purchase_number,
        debit: 0,
        credit: Number(p.grand_total),
        sortOrder: 1,
      });
    });

    // Add Purchase Bills (Finished Goods Purchases)
    purchaseBills.forEach((p) => {
      entries.push({
        date: p.invoice_date,
        particulars: `Purchase Bill #${p.bill_number}`,
        voucherType: "Purchase",
        voucherNo: p.bill_number,
        debit: 0,
        credit: Number(p.grand_total),
        sortOrder: 1,
      });
    });

    // Add Sale Bills (Customer Invoices)
    saleBills.forEach((s) => {
      entries.push({
        date: s.invoice_date,
        particulars: `Sales Invoice #${s.invoice_number}`,
        voucherType: "Sale",
        voucherNo: s.invoice_number,
        debit: Number(s.grand_total),
        credit: 0,
        sortOrder: 1,
      });
    });

    // Add Purchase Returns
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

    // Add Legacy Payments
    legacyPayments.forEach((py) => {
      const mode = py.payment_mode ? py.payment_mode.replace(/_/g, " ").toUpperCase() : "PAYMENT";
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

    // Add Unified Payments (both paid & received)
    newPayments.forEach((py) => {
      const mode = py.payment_mode ? py.payment_mode.replace(/_/g, " ").toUpperCase() : "PAYMENT";
      const isAdvance = py.is_advance || Number(py.unallocated_amount) > 0;
      
      // Get allocations for this payment
      const paymentAllocs = allocations
        .filter((a) => a.payment_id === py.id)
        .map((a) => ({
          billNo: billMap[a.bill_id] || "Advance / Unallocated",
          amount: Number(a.allocated_amount),
        }));

      // Directional math:
      // received (from customer): reduces customer receivable (Credit)
      // paid (to supplier/worker): reduces supplier payable (Debit)
      const debit = py.direction === "paid" ? Number(py.amount) : 0;
      const credit = py.direction === "received" ? Number(py.amount) : 0;

      entries.push({
        id: py.id,
        date: py.payment_date,
        particulars: isAdvance 
          ? `Advance Payment (${mode}) ${py.remarks ? "— " + py.remarks : ""}`
          : `Payment received/paid via ${mode} ${py.reference_no ? "(" + py.reference_no + ")" : ""}`,
        voucherType: isAdvance ? "Advance" : "Payment",
        voucherNo: py.reference_no || py.id.substring(0, 8).toUpperCase(),
        debit,
        credit,
        allocations: paymentAllocs,
        sortOrder: 3,
      });
    });

    // Add Write-offs
    // Match write-offs that affect this party's bills
    writeOffs.forEach((wo) => {
      const affectedBillNo = billMap[wo.bill_id];
      if (affectedBillNo) {
        // If it's a customer bill (sale_bill), write-off (Loss) reduces receivable (Credit)
        // If it's a supplier bill (purchase_bill/raw_material_purchase), write-off (Gain) reduces payable (Debit)
        const isCustomerBill = wo.bill_type === "sale_bill";
        const debit = isCustomerBill ? 0 : Number(wo.amount);
        const credit = isCustomerBill ? Number(wo.amount) : 0;

        entries.push({
          date: wo.written_off_at.split("T")[0],
          particulars: `Write-off (${wo.write_off_type.toUpperCase()}) on bill ${affectedBillNo}: ${wo.remarks}`,
          voucherType: "Write-off",
          voucherNo: "-",
          debit,
          credit,
          sortOrder: 4,
        });
      }
    });

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
        // Customer: Debit (Invoices) increases, Credit (Payments/Write-offs) decreases
        runningBalance += entry.debit - entry.credit;
        return {
          ...entry,
          balance: runningBalance,
          balanceSign: runningBalance >= 0 ? "Dr" : "Cr",
          balanceStr: `₹${Math.abs(runningBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${runningBalance >= 0 ? "Dr" : "Cr"}`,
        };
      } else {
        // Supplier / Other: Credit (Purchases) increases, Debit (Payments/Returns/Write-offs) decreases
        runningBalance += entry.credit - entry.debit;
        return {
          ...entry,
          balance: runningBalance,
          balanceSign: runningBalance >= 0 ? "Cr" : "Dr",
          balanceStr: `₹${Math.abs(runningBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${runningBalance >= 0 ? "Cr" : "Dr"}`,
        };
      }
    });

    // Calculate remaining advance balance if any
    const { data: advanceData } = await supabase
      .from("advance_payments")
      .select("remaining_amount")
      .eq("party_id", id)
      .eq("business_id", businessId)
      .eq("is_settled", false);
    
    const remainingAdvance = advanceData?.reduce((sum, curr) => sum + Number(curr.remaining_amount), 0) || 0;

    return NextResponse.json({ ledger, remainingAdvance });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
