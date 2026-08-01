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
    // 1. Fetch Party/Worker Details and Transactions in Parallel
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
      creditNotesResult,
      debitNotesResult,
      stageEntriesResult,
      jobWorkPaymentsResult,
      salaryAdvancesResult,
      salaryEntriesResult,
    ] = await Promise.all([
      supabase
        .from("parties")
        .select("id, name, type, opening_balance, opening_balance_date, created_at")
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
        .select("id, bill_number, bill_date, grand_total, status")
        .eq("party_id", id)
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
      supabase
        .from("credit_notes")
        .select("id, cn_number, cn_date, amount, reason")
        .eq("party_id", id)
        .eq("business_id", businessId),
      supabase
        .from("debit_notes")
        .select("id, dn_number, dn_date, amount, reason")
        .eq("party_id", id)
        .eq("business_id", businessId),
      supabase
        .from("stage_entries")
        .select("id, entry_number, entry_date, qty_out, job_work_rate, total_job_work_amount")
        .eq("worker_id", id)
        .eq("business_id", businessId),
      supabase
        .from("job_work_payments")
        .select("id, payment_number, payment_date, paid_amount, payment_mode, reference_no, status")
        .eq("worker_id", id)
        .eq("business_id", businessId)
        .eq("status", "success"),
      supabase
        .from("salary_advances")
        .select("id, advance_date, amount, payment_mode, notes")
        .or(`worker_id.eq.${id},party_id.eq.${id}`)
        .eq("business_id", businessId),
      supabase
        .from("salary_entries")
        .select("id, salary_month, salary_year, net_salary, payment_mode, payment_date, reference_no, remarks")
        .or(`worker_id.eq.${id},party_id.eq.${id}`)
        .eq("business_id", businessId),
    ]);

    let party: any = partyResult.data;
    if (!party) {
      const { data: workerParty } = await supabase
        .from("workers")
        .select("id, name, opening_balance, created_at")
        .eq("id", id)
        .eq("business_id", businessId)
        .single();

      if (workerParty) {
        party = {
          ...workerParty,
          type: ["worker"],
          opening_balance_date: workerParty.created_at ? workerParty.created_at.split("T")[0] : null,
        };
      }
    }

    if (!party) {
      return NextResponse.json({ error: "Party/Worker not found" }, { status: 404 });
    }

    const purchases = purchasesResult.data || [];
    const purchaseBills = purchaseBillsResult.data || [];
    const saleBills = saleBillsResult.data || [];
    const returns = returnsResult.data || [];
    const legacyPayments = legacyPaymentsResult.data || [];
    const newPayments = newPaymentsResult.data || [];
    const writeOffs = writeOffsResult.data || [];
    const allocations = allocationsResult.data || [];
    const creditNotes = creditNotesResult.data || [];
    const debitNotes = debitNotesResult.data || [];
    const stageEntries = stageEntriesResult.data || [];
    const jobWorkPayments = jobWorkPaymentsResult.data || [];
    const salaryAdvances = salaryAdvancesResult.data || [];
    const salaryEntries = salaryEntriesResult.data || [];

    // Helper map to find bill/invoice numbers by ID
    const billMap: Record<string, string> = {};
    purchases.forEach((p) => (billMap[p.id] = p.purchase_number));
    purchaseBills.forEach((p) => (billMap[p.id] = p.bill_number));
    saleBills.forEach((s) => (billMap[s.id] = s.bill_number));

    const isCustomerOnly = party.type?.includes("customer") && !party.type?.includes("supplier") && !party.type?.includes("worker");

    // 2. Build Ledger Entries
    const entries: any[] = [];

    // Add Opening Balance
    const obDate = party.opening_balance_date 
      ? party.opening_balance_date 
      : (party.created_at ? party.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
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
        date: s.bill_date,
        particulars: `Sales Invoice #${s.bill_number}`,
        voucherType: "Sale",
        voucherNo: s.bill_number,
        debit: Number(s.grand_total),
        credit: 0,
        sortOrder: 1,
      });
    });

    // Add Production Stage Entries (Worker Job Work Piece-Rate Earnings -> Credit)
    stageEntries.forEach((se: any) => {
      const qty = Number(se.qty_out || 0);
      const rate = Number(se.job_work_rate || 0);
      const total = Number(se.total_job_work_amount || qty * rate);
      entries.push({
        date: se.entry_date,
        particulars: `Production Job Work #${se.entry_number || se.id.substring(0, 8)} (${qty} Pcs @ ₹${rate.toFixed(2)})`,
        voucherType: "Job Work",
        voucherNo: se.entry_number || "-",
        debit: 0,
        credit: total,
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

    // Add Credit Notes
    creditNotes.forEach((cn: any) => {
      entries.push({
        date: cn.cn_date,
        particulars: `Credit Note #${cn.cn_number} ${cn.reason ? "(" + cn.reason + ")" : ""}`,
        voucherType: "Credit Note",
        voucherNo: cn.cn_number,
        debit: 0,
        credit: Number(cn.amount),
        sortOrder: 2,
      });
    });

    // Add Debit Notes
    debitNotes.forEach((dn: any) => {
      entries.push({
        date: dn.dn_date,
        particulars: `Debit Note #${dn.dn_number} ${dn.reason ? "(" + dn.reason + ")" : ""}`,
        voucherType: "Debit Note",
        voucherNo: dn.dn_number,
        debit: Number(dn.amount),
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

    // Add Job Work Payments (Payouts to Worker -> Debit)
    jobWorkPayments.forEach((jp: any) => {
      const mode = jp.payment_mode ? jp.payment_mode.replace(/_/g, " ").toUpperCase() : "PAYMENT";
      entries.push({
        date: jp.payment_date,
        particulars: `Job Work Payment (${mode}) ${jp.reference_no ? "(" + jp.reference_no + ")" : ""}`,
        voucherType: "Payment",
        voucherNo: jp.payment_number || jp.reference_no || "-",
        debit: Number(jp.paid_amount || 0),
        credit: 0,
        sortOrder: 3,
      });
    });

    // Add Salary Advances (Advances paid to Worker -> Debit)
    salaryAdvances.forEach((sa: any) => {
      const mode = sa.payment_mode ? sa.payment_mode.replace(/_/g, " ").toUpperCase() : "ADVANCE";
      entries.push({
        date: sa.advance_date,
        particulars: `Salary Advance (${mode}) ${sa.notes ? "— " + sa.notes : ""}`,
        voucherType: "Advance",
        voucherNo: "-",
        debit: Number(sa.amount || 0),
        credit: 0,
        sortOrder: 3,
      });
    });

    // Add Salary Entries (Salary Payouts to Worker -> Debit)
    salaryEntries.forEach((se: any) => {
      const mode = se.payment_mode ? se.payment_mode.toUpperCase() : "PAID";
      const dateStr = se.payment_date || `${se.salary_year}-${String(se.salary_month).padStart(2, "0")}-01`;
      entries.push({
        date: dateStr,
        particulars: `Salary Payout ${se.salary_month}/${se.salary_year} (${mode}) ${se.remarks ? "— " + se.remarks : ""}`,
        voucherType: "Salary",
        voucherNo: se.reference_no || "-",
        debit: Number(se.net_salary || 0),
        credit: 0,
        sortOrder: 3,
      });
    });

    // Add Unified Payments (both paid & received)
    newPayments.forEach((py) => {
      const mode = py.payment_mode ? py.payment_mode.replace(/_/g, " ").toUpperCase() : "PAYMENT";
      const isAdvance = py.is_advance || Number(py.unallocated_amount) > 0;
      
      const paymentAllocs = allocations
        .filter((a) => a.payment_id === py.id)
        .map((a) => ({
          billNo: billMap[a.bill_id] || "Advance / Unallocated",
          amount: Number(a.allocated_amount),
        }));

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
    writeOffs.forEach((wo) => {
      const affectedBillNo = billMap[wo.bill_id];
      if (affectedBillNo) {
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
        runningBalance += entry.debit - entry.credit;
        return {
          ...entry,
          balance: runningBalance,
          balanceSign: runningBalance >= 0 ? "Dr" : "Cr",
          balanceStr: `₹${Math.abs(runningBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${runningBalance >= 0 ? "Dr" : "Cr"}`,
        };
      } else {
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

    return NextResponse.json({ party, ledger, remainingAdvance });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
