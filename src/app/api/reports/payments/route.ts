import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = today.toISOString().split("T")[0];

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;
  const tab = searchParams.get("tab") ?? "receivables";
  const billType = searchParams.get("bill_type");
  const partyId = searchParams.get("party_id");
  const agingBucket = searchParams.get("aging_bucket");
  const accountId = searchParams.get("account_id");
  const direction = searchParams.get("direction");
  const accountCategory = searchParams.get("account_category");
  const bid = businessId;

  const todayMs = today.getTime();
  function getAgeBucket(dateStr: string) {
    const days = Math.floor((todayMs - new Date(dateStr).getTime()) / 86400000);
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    if (days <= 90) return "61-90";
    return "90+";
  }

  try {

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: RECEIVABLES
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "receivables") {
      let billsQ = supabase
        .from("sale_bills")
        .select(`id, bill_number, bill_date, due_date, bill_type, grand_total, paid_amount, payment_status, parties(id, name, company_name)`)
        .eq("business_id", bid).eq("status", "active").is("deleted_at", null).neq("payment_status", "paid").lte("bill_date", to);

      if (billType && (billType === "kacha" || billType === "pakka")) billsQ = billsQ.eq("bill_type", billType);
      if (partyId && partyId !== "all") billsQ = billsQ.eq("party_id", partyId);

      const { data: bills } = await billsQ;

      const rows = (bills ?? []).map(b => {
        const outstanding = Number(b.grand_total) - Number(b.paid_amount);
        const dueDate = b.due_date ?? b.bill_date;
        const ageDays = Math.floor((todayMs - new Date(dueDate).getTime()) / 86400000);
        const bucket = getAgeBucket(dueDate);
        return {
          id: b.id, number: b.bill_number, date: b.bill_date, due_date: dueDate,
          bill_type: b.bill_type,
          party: (b.parties as any)?.company_name ?? (b.parties as any)?.name ?? "—",
          party_id: (b.parties as any)?.id,
          total: Number(b.grand_total), paid: Number(b.paid_amount), outstanding,
          age_days: ageDays, bucket, status: b.payment_status,
        };
      }).filter(r => agingBucket && agingBucket !== "all" ? r.bucket === agingBucket : true);

      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
      const overdueRows = rows.filter(r => r.age_days > 0);
      const overdueAmount = overdueRows.reduce((s, r) => s + r.outstanding, 0);
      const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
      for (const r of rows) aging[r.bucket] = (aging[r.bucket] ?? 0) + r.outstanding;

      // Recent receipts
      const { data: recentRec } = await supabase.from("payments")
        .select(`id, payment_number, payment_date, amount, payment_mode, bank_account:bank_accounts(name), parties(name, company_name)`)
        .eq("business_id", bid).eq("direction", "received").neq("status", "cancelled")
        .order("payment_date", { ascending: false }).limit(5);

      // Bank+cash balance
      const { data: accounts } = await supabase.from("bank_accounts")
        .select("type, current_balance, name").eq("business_id", bid).eq("is_active", true).is("deleted_at", null);
      const cashBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      // Top customers outstanding
      const byParty: Record<string, { name: string; total: number; received: number; outstanding: number }> = {};
      for (const r of rows) {
        if (!byParty[r.party_id ?? r.party]) byParty[r.party_id ?? r.party] = { name: r.party, total: 0, received: 0, outstanding: 0 };
        byParty[r.party_id ?? r.party].total += r.total;
        byParty[r.party_id ?? r.party].received += r.paid;
        byParty[r.party_id ?? r.party].outstanding += r.outstanding;
      }
      const topCustomers = Object.values(byParty).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

      const statusSummary = {
        paid: { count: 0, amount: 0 },
        partial: { count: 0, amount: 0 },
        unpaid: { count: 0, amount: 0 },
      };
      for (const r of rows) {
        const key = r.status === "paid" ? "paid" : r.status === "partial" ? "partial" : "unpaid";
        statusSummary[key].count++;
        statusSummary[key].amount += r.outstanding;
      }

      return NextResponse.json({
        tab, rows, aging,
        summary: {
          totalOutstanding, overdueAmount,
          totalBills: rows.length,
          totalReceived: rows.reduce((s, r) => s + r.paid, 0),
          cashBalance,
        },
        topCustomers, statusSummary,
        recentReceipts: (recentRec ?? []).map(r => ({
          id: r.id, number: r.payment_number, date: r.payment_date,
          party: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "—",
          mode: r.payment_mode, account: (r.bank_account as any)?.name ?? "—",
          amount: Number(r.amount),
        })),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: PAYABLES
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "payables") {
      let rmQ = supabase.from("raw_material_purchases")
        .select(`id, purchase_number, invoice_date, due_date, grand_total, paid_amount, payment_status, gst_type, category, parties(id, name, company_name)`)
        .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").is("deleted_at", null).lte("invoice_date", to);

      let pgQ = supabase.from("purchase_bills")
        .select(`id, bill_number, invoice_date, due_date, grand_total, paid_amount, payment_status, bill_type, parties(id, name, company_name)`)
        .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").lte("invoice_date", to);

      if (partyId && partyId !== "all") {
        rmQ = rmQ.eq("party_id", partyId);
        pgQ = pgQ.eq("supplier_id", partyId);
      }

      const [rmRes, pgRes] = await Promise.all([rmQ, pgQ]);

      const mapType = (cat: string | null, gstType: string | null) => {
        if (cat === "accessory") return "Accessories";
        if (cat === "others") return "Others";
        return "Raw Material";
      };

      const rmRows = (rmRes.data ?? []).map(p => {
        const outstanding = Number(p.grand_total) - Number(p.paid_amount);
        const dueDate = p.due_date ?? p.invoice_date;
        const ageDays = Math.floor((todayMs - new Date(dueDate).getTime()) / 86400000);
        return {
          id: p.id, number: p.purchase_number, date: p.invoice_date, due_date: dueDate,
          type: mapType((p as any).category, p.gst_type),
          bill_type: p.gst_type === "without_gst" ? "kacha" : "pakka",
          party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
          party_id: (p.parties as any)?.id,
          total: Number(p.grand_total), paid: Number(p.paid_amount), outstanding,
          age_days: ageDays, bucket: getAgeBucket(dueDate), status: p.payment_status,
        };
      });
      const pgRows = (pgRes.data ?? []).map(p => {
        const outstanding = Number(p.grand_total) - Number(p.paid_amount);
        const dueDate = p.due_date ?? p.invoice_date;
        const ageDays = Math.floor((todayMs - new Date(dueDate).getTime()) / 86400000);
        return {
          id: p.id, number: p.bill_number, date: p.invoice_date, due_date: dueDate,
          type: "Finished Goods",
          bill_type: p.bill_type === "kacha" ? "kacha" : "pakka",
          party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
          party_id: (p.parties as any)?.id,
          total: Number(p.grand_total), paid: Number(p.paid_amount), outstanding,
          age_days: ageDays, bucket: getAgeBucket(dueDate), status: p.payment_status,
        };
      });

      const rows = [...rmRows, ...pgRows]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .filter(r => agingBucket && agingBucket !== "all" ? r.bucket === agingBucket : true);

      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
      const overdueAmount = rows.filter(r => r.age_days > 0).reduce((s, r) => s + r.outstanding, 0);
      const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
      for (const r of rows) aging[r.bucket] = (aging[r.bucket] ?? 0) + r.outstanding;

      // Top suppliers outstanding
      const byParty: Record<string, { name: string; total: number; paid: number; outstanding: number }> = {};
      for (const r of rows) {
        const key = r.party_id ?? r.party;
        if (!byParty[key]) byParty[key] = { name: r.party, total: 0, paid: 0, outstanding: 0 };
        byParty[key].total += r.total;
        byParty[key].paid += r.paid;
        byParty[key].outstanding += r.outstanding;
      }
      const topSuppliers = Object.values(byParty).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

      // Recent payments
      const { data: recentPay } = await supabase.from("payments")
        .select(`id, payment_number, payment_date, amount, payment_mode, bank_account:bank_accounts(name), parties(name, company_name)`)
        .eq("business_id", bid).eq("direction", "paid").neq("status", "cancelled")
        .order("payment_date", { ascending: false }).limit(5);

      // Bank+cash outflow
      const { data: accounts } = await supabase.from("bank_accounts")
        .select("type, current_balance").eq("business_id", bid).eq("is_active", true).is("deleted_at", null);
      const cashBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      const statusSummary = { paid: { count: 0, amount: 0 }, partial: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0 } };
      for (const r of rows) {
        const key = r.status === "paid" ? "paid" : r.status === "partial" ? "partial" : "unpaid";
        statusSummary[key].count++;
        statusSummary[key].amount += r.outstanding;
      }

      return NextResponse.json({
        tab, rows, aging,
        summary: {
          totalOutstanding, overdueAmount, totalBills: rows.length,
          totalPaid: rows.reduce((s, r) => s + r.paid, 0), cashBalance,
        },
        topSuppliers, statusSummary,
        recentPayments: (recentPay ?? []).map(r => ({
          id: r.id, number: r.payment_number, date: r.payment_date,
          party: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "—",
          mode: r.payment_mode, account: (r.bank_account as any)?.name ?? "—",
          amount: Number(r.amount),
        })),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: RECEIPTS (payments direction=received)
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "receipts") {
      let q = supabase.from("payments")
        .select(`id, payment_number, payment_date, payment_mode, amount, reference_no, remarks, is_advance,
          bank_account:bank_accounts(id, name, type, account_category),
          parties(id, name, company_name)`)
        .eq("business_id", bid).eq("direction", "received").neq("status", "cancelled")
        .gte("payment_date", from).lte("payment_date", to)
        .order("payment_date", { ascending: false });

      if (partyId && partyId !== "all") q = q.eq("party_id", partyId);

      const { data: recs } = await q;
      const rows = (recs ?? []).map(r => {
        const ba = r.bank_account as any;
        return {
          id: r.id, number: r.payment_number, date: r.payment_date,
          party: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "—",
          party_id: (r.parties as any)?.id,
          type: r.is_advance ? "Advance" : "Invoice",
          mode: r.payment_mode, account: ba?.name ?? "Cash",
          account_type: ba?.type ?? "cash",
          account_category: ba?.account_category ?? (r.payment_mode === "cash" ? "kacha" : "pakka"),
          reference: r.reference_no ?? "—", amount: Number(r.amount),
        };
      });

      const totalReceived = rows.reduce((s, r) => s + r.amount, 0);
      const advanceReceived = rows.filter(r => r.type === "Advance").reduce((s, r) => s + r.amount, 0);
      const invoiceReceived = rows.filter(r => r.type === "Invoice").reduce((s, r) => s + r.amount, 0);

      const byMode: Record<string, number> = {};
      for (const r of rows) byMode[r.mode] = (byMode[r.mode] ?? 0) + r.amount;

      const byType: Record<string, number> = {};
      for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + r.amount;

      // Daily trend
      const dailyMap: Record<string, number> = {};
      for (const r of rows) { dailyMap[r.date] = (dailyMap[r.date] ?? 0) + r.amount; }
      const dailyTrend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
        .slice(-14).map(([date, amount]) => ({ date: date.slice(5), amount }));

      // Top customers by receipts
      const byParty: Record<string, { name: string; amount: number; pct: number }> = {};
      for (const r of rows) {
        const k = r.party_id ?? r.party;
        if (!byParty[k]) byParty[k] = { name: r.party, amount: 0, pct: 0 };
        byParty[k].amount += r.amount;
      }
      const topCustomers = Object.values(byParty)
        .map(p => ({ ...p, pct: totalReceived > 0 ? (p.amount / totalReceived) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount).slice(0, 5);

      // Bank balance
      const { data: accounts } = await supabase.from("bank_accounts")
        .select("current_balance").eq("business_id", bid).eq("is_active", true).is("deleted_at", null);
      const cashBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      return NextResponse.json({
        tab, rows, byMode, byType, dailyTrend,
        summary: { totalReceived, advanceReceived, invoiceReceived, otherReceived: 0, cashBalance },
        topCustomers,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: PAYMENTS (direction=paid)
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "payments") {
      let q = supabase.from("payments")
        .select(`id, payment_number, payment_date, payment_mode, amount, reference_no, remarks, is_advance,
          bank_account:bank_accounts(id, name, type, account_category),
          parties(id, name, company_name, type)`)
        .eq("business_id", bid).eq("direction", "paid").neq("status", "cancelled")
        .gte("payment_date", from).lte("payment_date", to)
        .order("payment_date", { ascending: false });

      if (partyId && partyId !== "all") q = q.eq("party_id", partyId);

      const { data: pays } = await q;
      const rows = (pays ?? []).map(r => {
        const ba = r.bank_account as any;
        const partyType = (r.parties as any)?.type;
        const purposeType = r.is_advance ? "Advance Payment" : partyType === "supplier" ? "Purchase Payment" : "Expense Payment";
        return {
          id: r.id, number: r.payment_number, date: r.payment_date,
          payee: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "—",
          party_id: (r.parties as any)?.id,
          party_type: partyType,
          purpose_type: purposeType,
          mode: r.payment_mode, account: ba?.name ?? "Cash",
          account_type: ba?.type ?? "cash",
          reference: r.reference_no ?? "—", amount: Number(r.amount),
        };
      });

      const totalPaid = rows.reduce((s, r) => s + r.amount, 0);

      const byMode: Record<string, number> = {};
      for (const r of rows) byMode[r.mode] = (byMode[r.mode] ?? 0) + r.amount;

      const byType: Record<string, number> = {};
      for (const r of rows) byType[r.purpose_type] = (byType[r.purpose_type] ?? 0) + r.amount;

      const dailyMap: Record<string, number> = {};
      for (const r of rows) { dailyMap[r.date] = (dailyMap[r.date] ?? 0) + r.amount; }
      const dailyTrend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
        .slice(-14).map(([date, amount]) => ({ date: date.slice(5), amount }));

      const byParty: Record<string, { name: string; amount: number; pct: number }> = {};
      for (const r of rows) {
        const k = r.party_id ?? r.payee;
        if (!byParty[k]) byParty[k] = { name: r.payee, amount: 0, pct: 0 };
        byParty[k].amount += r.amount;
      }
      const topSuppliers = Object.values(byParty)
        .map(p => ({ ...p, pct: totalPaid > 0 ? (p.amount / totalPaid) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount).slice(0, 5);

      // Bank & cash outflow
      const { data: accounts } = await supabase.from("bank_accounts")
        .select("current_balance").eq("business_id", bid).eq("is_active", true).is("deleted_at", null);
      const cashBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      return NextResponse.json({
        tab, rows, byMode, byType, dailyTrend,
        summary: {
          totalPaid,
          supplierPayments: rows.filter(r => r.party_type === "supplier").reduce((s, r) => s + r.amount, 0),
          workerPayments: rows.filter(r => r.purpose_type?.includes("Worker") || r.purpose_type?.includes("Job")).reduce((s, r) => s + r.amount, 0),
          otherPayments: rows.filter(r => r.purpose_type === "Expense Payment").reduce((s, r) => s + r.amount, 0),
          cashBalance,
        },
        topSuppliers,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: ACCOUNTS (cash/bank/UPI balances + transactions)
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "accounts") {
      const { data: accountsData } = await supabase.from("bank_accounts")
        .select("id, name, type, sub_label, account_category, opening_balance, current_balance, bank_name, account_number, upi_id, is_active")
        .eq("business_id", bid).is("deleted_at", null).eq("is_active", true)
        .order("type").order("name");

      // For each account, calculate period received and paid
      const acctIds = (accountsData ?? []).map(a => a.id);

      let txQuery = supabase.from("payments")
        .select("bank_account_id, direction, amount, payment_date, payment_mode, payment_number, parties(name, company_name)")
        .eq("business_id", bid).neq("status", "cancelled")
        .gte("payment_date", from).lte("payment_date", to);

      if (accountId && accountId !== "all") txQuery = txQuery.eq("bank_account_id", accountId);

      const { data: txData } = await txQuery;

      // Build account summary
      const acctMap: Record<string, { received: number; paid: number }> = {};
      for (const t of txData ?? []) {
        const k = t.bank_account_id ?? "cash";
        if (!acctMap[k]) acctMap[k] = { received: 0, paid: 0 };
        if (t.direction === "received") acctMap[k].received += Number(t.amount);
        else acctMap[k].paid += Number(t.amount);
      }

      const accounts = (accountsData ?? []).map(a => ({
        id: a.id, name: a.name, type: a.type, sub_label: a.sub_label,
        account_category: a.account_category,
        opening_balance: Number(a.opening_balance ?? 0),
        current_balance: Number(a.current_balance ?? 0),
        received: acctMap[a.id]?.received ?? 0,
        paid: acctMap[a.id]?.paid ?? 0,
        transfers: 0,
        closing_balance: Number(a.current_balance ?? 0),
      }));

      const totalCash = accounts.filter(a => a.type === "cash").reduce((s, a) => s + a.current_balance, 0);
      const totalBank = accounts.filter(a => a.type === "bank").reduce((s, a) => s + a.current_balance, 0);
      const totalUPI = accounts.filter(a => a.type === "upi").reduce((s, a) => s + a.current_balance, 0);
      const totalBalance = totalCash + totalBank + totalUPI;

      // Account transactions (for the selected account)
      const txRows = (txData ?? [])
        .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        .slice(0, 50)
        .map(t => ({
          date: t.payment_date, number: t.payment_number,
          type: t.direction === "received" ? "Receipt" : "Payment",
          party: (t.parties as any)?.company_name ?? (t.parties as any)?.name ?? "—",
          mode: t.payment_mode,
          debit: t.direction === "paid" ? Number(t.amount) : 0,
          credit: t.direction === "received" ? Number(t.amount) : 0,
          amount: Number(t.amount),
        }));

      return NextResponse.json({
        tab, accounts, txRows,
        summary: { totalCash, totalBank, totalUPI, totalBalance, netTransfers: 0 },
        accountOptions: accounts.map(a => ({ id: a.id, label: `${a.name} (${a.type.toUpperCase()})`, type: a.type })),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: CHEQUES
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "cheques") {
      const [receivedRes, issuedRes] = await Promise.all([
        supabase.from("cheques")
          .select(`id, cheque_number, cheque_date, due_date, amount, status, bank_name, account_no, bounce_charges,
            deposited_date, cleared_date, bounce_reason, remarks,
            party:parties(id, name, company_name),
            received_account:bank_accounts(id, name)`)
          .eq("business_id", bid).eq("direction", "received")
          .gte("cheque_date", from).lte("cheque_date", to)
          .order("cheque_date", { ascending: false }),

        supabase.from("cheques")
          .select(`id, cheque_number, cheque_date, due_date, amount, status, bank_name, account_no,
            deposited_date, cleared_date, bounce_reason, remarks,
            party:parties(id, name, company_name)`)
          .eq("business_id", bid).eq("direction", "issued")
          .gte("cheque_date", from).lte("cheque_date", to)
          .order("cheque_date", { ascending: false }),
      ]);

      const daysToCheque = (d: string) => Math.floor((new Date(d).getTime() - todayMs) / 86400000);

      const received = (receivedRes.data ?? []).map(c => ({
        id: c.id, number: c.cheque_number, date: c.cheque_date, cheque_date: c.cheque_date,
        party: (c.party as any)?.company_name ?? (c.party as any)?.name ?? "—",
        bank: c.bank_name, account: c.account_no,
        amount: Number(c.amount), status: c.status,
        days_left: daysToCheque(c.cheque_date),
        deposited_date: c.deposited_date, cleared_date: c.cleared_date,
        received_account: (c.received_account as any)?.name ?? "—",
      }));

      const issued = (issuedRes.data ?? []).map(c => ({
        id: c.id, number: c.cheque_number, date: c.cheque_date, cheque_date: c.cheque_date,
        party: (c.party as any)?.company_name ?? (c.party as any)?.name ?? "—",
        bank: c.bank_name, account: c.account_no,
        amount: Number(c.amount), status: c.status,
        days_left: daysToCheque(c.cheque_date),
        deposited_date: c.deposited_date, cleared_date: c.cleared_date,
      }));

      // All cheques for status summary
      const allReceived = received;
      const allIssued = issued;

      const byStatus = (arr: Array<{ status: string; amount: number }>) => arr.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + c.amount;
        return acc;
      }, {} as Record<string, number>);

      const pdcReceived = received.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
      const pdcIssued = issued.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
      const bounced = [...received, ...issued].filter(c => c.status === "bounced").reduce((s, c) => s + c.amount, 0);
      const cleared = [...received, ...issued].filter(c => c.status === "cleared").reduce((s, c) => s + c.amount, 0);

      return NextResponse.json({
        tab, received, issued,
        summary: {
          totalReceived: received.reduce((s, c) => s + c.amount, 0),
          totalIssued: issued.reduce((s, c) => s + c.amount, 0),
          pdcReceived, pdcIssued, bounced, cleared,
        },
        byStatusReceived: byStatus(allReceived),
        byStatusIssued: byStatus(allIssued),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: ADVANCES
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "advances") {
      const [custAdvQ, suppAdvQ] = await Promise.all([
        supabase.from("advance_payments")
          .select(`id, advance_amount, settled_amount, remaining_amount, is_settled, created_at,
            payments(id, payment_number, payment_date, payment_mode, bank_account:bank_accounts(name)),
            parties(id, name, company_name, type)`)
          .eq("business_id", bid)
          .order("created_at", { ascending: false }),

        supabase.from("advance_payments")
          .select(`id, advance_amount, settled_amount, remaining_amount, is_settled, created_at,
            payments(id, payment_number, payment_date, payment_mode, bank_account:bank_accounts(name)),
            parties(id, name, company_name, type)`)
          .eq("business_id", bid)
          .order("created_at", { ascending: false }),
      ]);

      const allAdvances = (custAdvQ.data ?? []).map(a => {
        const p = a.payments as any;
        const party = a.parties as any;
        return {
          id: a.id,
          advance_number: p?.payment_number ?? "—",
          date: p?.payment_date ?? (a.created_at as string).split("T")[0],
          party: party?.company_name ?? party?.name ?? "—",
          party_type: party?.type ?? "customer",
          type: "Advance",
          mode: p?.payment_mode ?? "—",
          account: (p?.bank_account as any)?.name ?? "Cash",
          amount: Number(a.advance_amount),
          adjusted: Number(a.settled_amount),
          balance: Number(a.remaining_amount),
          status: a.is_settled ? "Adjusted" : Number(a.settled_amount) > 0 ? "Partial" : "Unadjusted",
        };
      });

      const custAdv = allAdvances.filter(a => a.party_type === "customer");
      const suppAdv = allAdvances.filter(a => a.party_type === "supplier");

      const custTotal = custAdv.reduce((s, a) => s + a.amount, 0);
      const custBalance = custAdv.reduce((s, a) => s + a.balance, 0);
      const suppTotal = suppAdv.reduce((s, a) => s + a.amount, 0);
      const suppBalance = suppAdv.reduce((s, a) => s + a.balance, 0);

      const thisMonth = new Date(to).toISOString().slice(0, 7);
      const adjusted = allAdvances.filter(a => (a.date ?? "").startsWith(thisMonth)).reduce((s, a) => s + a.adjusted, 0);

      return NextResponse.json({
        tab, customerAdvances: custAdv, supplierAdvances: suppAdv,
        summary: {
          customerAdvances: custTotal, supplierAdvances: suppTotal,
          totalAdvances: custTotal + suppTotal,
          adjustedThisPeriod: adjusted,
          outstandingAdvances: custBalance + suppBalance,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: TRANSFERS (bank-to-bank payments with remarks "transfer")
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "transfers") {
      // Transfers = payments where a party_id is same business or payment_mode is transfer
      // In TAS, transfers are tracked as paired payments (paid+received at same time)
      // We'll surface them as payments with specific mode or where party is self
      const { data: txData } = await supabase.from("payments")
        .select(`id, payment_number, payment_date, payment_mode, amount, reference_no, remarks, direction,
          bank_account:bank_accounts(id, name, type),
          parties(id, name, company_name)`)
        .eq("business_id", bid).neq("status", "cancelled")
        .in("payment_mode", ["bank_transfer", "neft", "rtgs", "cheque", "upi"])
        .gte("payment_date", from).lte("payment_date", to)
        .order("payment_date", { ascending: false });

      const rows = (txData ?? []).map(t => {
        const ba = t.bank_account as any;
        return {
          id: t.id, number: t.payment_number, date: t.payment_date,
          direction: t.direction, mode: t.payment_mode,
          from_account: t.direction === "paid" ? ba?.name ?? "—" : "Party",
          to_account: t.direction === "received" ? ba?.name ?? "—" : "Party",
          party: (t.parties as any)?.company_name ?? (t.parties as any)?.name ?? "—",
          reference: t.reference_no ?? "—", remarks: t.remarks ?? "—",
          amount: Number(t.amount), status: "Completed",
        };
      });

      const totalTransfers = rows.reduce((s, r) => s + r.amount, 0);
      const byMode: Record<string, number> = {};
      for (const r of rows) byMode[r.mode] = (byMode[r.mode] ?? 0) + r.amount;

      return NextResponse.json({
        tab, rows, byMode,
        summary: { totalTransfers, totalRows: rows.length },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB: ALL TRANSACTIONS (master register)
    // ─────────────────────────────────────────────────────────────────────────
    if (tab === "all_transactions") {
      const [payRes, chqRes, advRes] = await Promise.all([
        supabase.from("payments")
          .select(`id, payment_number, payment_date, direction, payment_mode, amount, reference_no, is_advance, status,
            bank_account:bank_accounts(id, name, type),
            parties(id, name, company_name)`)
          .eq("business_id", bid).neq("status", "cancelled")
          .gte("payment_date", from).lte("payment_date", to)
          .order("payment_date", { ascending: false }),

        supabase.from("cheques")
          .select(`id, cheque_number, cheque_date, direction, amount, status, bank_name,
            party:parties(id, name, company_name)`)
          .eq("business_id", bid)
          .gte("cheque_date", from).lte("cheque_date", to)
          .order("cheque_date", { ascending: false }),

        supabase.from("advance_payments")
          .select(`id, advance_amount, settled_amount, remaining_amount, is_settled, created_at,
            parties(id, name, company_name, type)`)
          .eq("business_id", bid),
      ]);

      const allRows: any[] = [];

      for (const p of payRes.data ?? []) {
        const ba = p.bank_account as any;
        const type = p.is_advance ? (p.direction === "received" ? "Advance Received" : "Advance Paid") :
          p.direction === "received" ? "Receipt" : "Payment";
        allRows.push({
          id: p.id, date: p.payment_date, voucher_no: p.payment_number,
          type, party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
          mode: p.payment_mode,
          from_account: p.direction === "paid" ? ba?.name ?? "Cash" : "—",
          to_account: p.direction === "received" ? ba?.name ?? "Cash" : "—",
          debit: p.direction === "paid" ? Number(p.amount) : 0,
          credit: p.direction === "received" ? Number(p.amount) : 0,
          amount: Number(p.amount), status: p.status, reference: p.reference_no ?? "—",
        });
      }

      for (const c of chqRes.data ?? []) {
        allRows.push({
          id: c.id, date: c.cheque_date, voucher_no: c.cheque_number,
          type: c.direction === "received" ? "Cheque Received" : "Cheque Issued",
          party: (c.party as any)?.company_name ?? (c.party as any)?.name ?? "—",
          mode: "cheque", from_account: "—", to_account: c.bank_name ?? "—",
          debit: c.direction === "issued" ? Number(c.amount) : 0,
          credit: c.direction === "received" ? Number(c.amount) : 0,
          amount: Number(c.amount), status: c.status, reference: "—",
        });
      }

      allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalReceipts = allRows.filter(r => r.credit > 0).reduce((s, r) => s + r.credit, 0);
      const totalPayments = allRows.filter(r => r.debit > 0).reduce((s, r) => s + r.debit, 0);
      const advanceRows = allRows.filter(r => r.type.includes("Advance"));
      const totalAdvances = advanceRows.reduce((s, r) => s + r.amount, 0);
      const chequeRows = allRows.filter(r => r.type.includes("Cheque"));
      const totalCheques = chequeRows.reduce((s, r) => s + r.amount, 0);

      const byType: Record<string, { count: number; amount: number }> = {};
      for (const r of allRows) {
        if (!byType[r.type]) byType[r.type] = { count: 0, amount: 0 };
        byType[r.type].count++;
        byType[r.type].amount += r.amount;
      }

      const byMode: Record<string, number> = {};
      for (const r of allRows) { byMode[r.mode] = (byMode[r.mode] ?? 0) + r.amount; }

      const byParty: Record<string, { name: string; credit: number; debit: number; net: number }> = {};
      for (const r of allRows) {
        const k = r.party;
        if (!byParty[k]) byParty[k] = { name: k, credit: 0, debit: 0, net: 0 };
        byParty[k].credit += r.credit;
        byParty[k].debit += r.debit;
        byParty[k].net = byParty[k].credit - byParty[k].debit;
      }
      const topParties = Object.values(byParty).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 5);

      const { data: accounts } = await supabase.from("bank_accounts")
        .select("current_balance").eq("business_id", bid).eq("is_active", true).is("deleted_at", null);
      const closingBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      return NextResponse.json({
        tab, rows: allRows, byType, byMode, topParties,
        summary: {
          totalTransactions: allRows.length,
          totalReceipts, totalPayments, totalAdvances, totalCheques,
          netCashFlow: totalReceipts - totalPayments,
          closingBalance,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEGACY: UPI / Bank / Cash / Combined (kept for backward compat)
    // ─────────────────────────────────────────────────────────────────────────
    const modeFilter: Record<string, string[]> = {
      upi: ["upi", "gpay", "phonepe", "paytm", "qr"],
      bank: ["bank_transfer", "neft", "rtgs", "cheque", "bank", "net_banking", "card", "online", "pdc", "imps"],
      cash: ["cash", "cash_payment"],
      combined: [],
    };

    let paymentsQuery = supabase
      .from("payments")
      .select(`id, payment_number, payment_date, direction, payment_mode, amount, reference_no, remarks, status, bank_account_id,
        bank_account:bank_accounts(id, name, bank_name, type, account_category),
        parties(id, name, company_name)`)
      .eq("business_id", bid).neq("status", "cancelled")
      .gte("payment_date", from).lte("payment_date", to)
      .order("payment_date", { ascending: false });

    if (tab !== "combined" && modeFilter[tab] && modeFilter[tab].length > 0) {
      paymentsQuery = paymentsQuery.in("payment_mode", modeFilter[tab]);
    }
    if (direction && (direction === "received" || direction === "paid")) {
      paymentsQuery = paymentsQuery.eq("direction", direction);
    }
    if (partyId && partyId !== "all") paymentsQuery = paymentsQuery.eq("party_id", partyId);

    const { data: paymentsData } = await paymentsQuery;

    const allPaymentRows = (paymentsData ?? []).map((p: any) => {
      const ba = p.bank_account as any;
      const category = ba?.account_category || (p.payment_mode === "cash" ? "kacha" : "pakka");
      return {
        id: p.id, number: p.payment_number, date: p.payment_date,
        direction: p.direction, mode: p.payment_mode,
        account_name: ba?.name || (p.payment_mode === "cash" ? "Cash Register" : "Bank Account"),
        account_category: category,
        party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
        amount: Number(p.amount), reference: p.reference_no ?? "—", remarks: p.remarks ?? "—",
      };
    });

    const rows = accountCategory && accountCategory !== "all"
      ? allPaymentRows.filter(r => r.account_category === accountCategory || r.account_category === "both")
      : allPaymentRows;

    const totalIn = rows.filter(r => r.direction === "received").reduce((s, r) => s + r.amount, 0);
    const totalOut = rows.filter(r => r.direction === "paid").reduce((s, r) => s + r.amount, 0);
    const totalInPakka = rows.filter(r => r.direction === "received" && (r.account_category === "pakka" || r.account_category === "both")).reduce((s, r) => s + r.amount, 0);
    const totalInKacha = rows.filter(r => r.direction === "received" && r.account_category === "kacha").reduce((s, r) => s + r.amount, 0);
    const totalOutPakka = rows.filter(r => r.direction === "paid" && (r.account_category === "pakka" || r.account_category === "both")).reduce((s, r) => s + r.amount, 0);
    const totalOutKacha = rows.filter(r => r.direction === "paid" && r.account_category === "kacha").reduce((s, r) => s + r.amount, 0);

    const byMode = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + r.amount;
      return acc;
    }, {});

    const monthMap: Record<string, { received: number; paid: number }> = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { received: 0, paid: 0 };
      if (r.direction === "received") monthMap[m].received += r.amount;
      else monthMap[m].paid += r.amount;
    }
    const monthlyTrend = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        received: vals.received, paid: vals.paid,
      }));

    return NextResponse.json({
      tab, from, to, rows,
      summary: { totalIn, totalOut, net: totalIn - totalOut, totalInPakka, totalInKacha, totalOutPakka, totalOutKacha, totalTransactions: rows.length },
      byMode, monthlyTrend,
    });

  } catch (err: any) {
    console.error("[reports/payments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
