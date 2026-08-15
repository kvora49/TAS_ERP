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
    // 1. Fetch account details
    const { data: account, error: accountError } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // 2. Fetch all transaction sources referencing this account in parallel
    const [paymentsRes, expensesRes, incomeRes, salaryRes, chequesRes, purchasePaymentsRes, jobWorkPaymentsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("id, payment_number, payment_date, amount, direction, payment_mode, party:parties(name)")
        .eq("bank_account_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled"),

      supabase
        .from("expenses")
        .select("id, expense_number, expense_date, amount, vendor_name, expense_type:expense_types(name)")
        .eq("paid_from_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("misc_income")
        .select("id, income_number, income_date, amount, income_type, party:parties(name)")
        .eq("received_in_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("salary_entries")
        .select("id, salary_month, salary_year, net_salary, payment_date, worker:parties(name)")
        .eq("bank_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("cheques")
        .select("id, cheque_number, cleared_date, amount, direction, party:parties(name)")
        .eq("received_account_id", id)
        .eq("status", "cleared")
        .eq("business_id", businessId),

      supabase
        .from("purchase_payments")
        .select("id, payment_number, payment_date, paid_amount, payment_mode, purchase:raw_material_purchases(invoice_number, supplier:parties(name))")
        .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
        .eq("business_id", businessId),

      supabase
        .from("job_work_payments")
        .select("id, payment_number, payment_date, paid_amount, payment_mode, worker:parties(name)")
        .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
        .eq("business_id", businessId)
    ]);

    // 3. Transform and unify transaction list
    const transactions: any[] = [];

    (paymentsRes.data || []).forEach((p: any) => {
      transactions.push({
        id: p.id,
        type: p.direction === "received" ? "inflow" : "outflow",
        ref_no: p.payment_number,
        date: p.payment_date,
        amount: Number(p.amount || 0),
        mode: p.payment_mode,
        details: p.direction === "received" ? "Customer Receipt" : "Supplier / Party Payment",
        partyName: (p.party as any)?.name || "Party",
      });
    });

    (expensesRes.data || []).forEach((e: any) => {
      transactions.push({
        id: e.id,
        type: "outflow",
        ref_no: e.expense_number,
        date: e.expense_date,
        amount: Number(e.amount || 0),
        mode: "expense",
        details: `Expense: ${(e.expense_type as any)?.name || "General"}`,
        partyName: e.vendor_name || "Vendor",
      });
    });

    (incomeRes.data || []).forEach((inc: any) => {
      transactions.push({
        id: inc.id,
        type: "inflow",
        ref_no: inc.income_number,
        date: inc.income_date,
        amount: Number(inc.amount || 0),
        mode: "misc_income",
        details: `Misc Income (${inc.income_type})`,
        partyName: (inc.party as any)?.name || "Other",
      });
    });

    (salaryRes.data || []).forEach((s: any) => {
      transactions.push({
        id: s.id,
        type: "outflow",
        ref_no: `SAL-${s.salary_year}-${s.salary_month}`,
        date: s.payment_date,
        amount: Number(s.net_salary || 0),
        mode: "salary",
        details: `Salary (${s.salary_month}/${s.salary_year})`,
        partyName: (s.worker as any)?.name || "Employee",
      });
    });

    (chequesRes.data || []).forEach((chq: any) => {
      transactions.push({
        id: chq.id,
        type: chq.direction === "received" ? "inflow" : "outflow",
        ref_no: chq.cheque_number,
        date: chq.cleared_date || chq.created_at,
        amount: Number(chq.amount || 0),
        mode: "cheque_cleared",
        details: `Cleared Cheque (${chq.direction})`,
        partyName: (chq.party as any)?.name || "Party",
      });
    });

    (purchasePaymentsRes.data || []).forEach((p: any) => {
      transactions.push({
        id: p.id,
        type: "outflow",
        ref_no: p.payment_number,
        date: p.payment_date,
        amount: Number(p.paid_amount || 0),
        mode: p.payment_mode,
        details: `Raw Material Purchase Payment`,
        partyName: (p.purchase as any)?.supplier?.name || "Supplier",
      });
    });

    (jobWorkPaymentsRes.data || []).forEach((jw: any) => {
      transactions.push({
        id: jw.id,
        type: "outflow",
        ref_no: jw.payment_number,
        date: jw.payment_date,
        amount: Number(jw.paid_amount || 0),
        mode: jw.payment_mode,
        details: "Job Work Worker Payment",
        partyName: (jw.worker as any)?.name || "Worker",
      });
    });

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      account,
      transactions: transactions.slice(0, 100),
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const accountId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      type,
      name,
      sub_label,
      bank_name,
      account_number,
      ifsc,
      branch,
      upi_id,
      upi_provider,
      account_category,
      is_default,
      opening_balance,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!type || !name || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Account Type, Name, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    const validCategories = ["pakka", "kacha", "both"];
    const category = validCategories.includes(account_category)
      ? account_category
      : type === "cash" ? "kacha" : "pakka";

    if (type === "bank" && (!account_number || !ifsc)) {
      return NextResponse.json(
        { error: "Account Number and IFSC Code are required for bank accounts" },
        { status: 400 }
      );
    }

    if (type === "upi" && !upi_id) {
      return NextResponse.json(
        { error: "UPI ID is required for UPI accounts" },
        { status: 400 }
      );
    }

    // If setting as default, reset others to false
    if (is_default) {
      await supabase
        .from("bank_accounts")
        .update({ is_default: false })
        .eq("business_id", businessId);
    }

    // Optimistic locking update query
    const { data: updatedAccount, error } = await supabase
      .from("bank_accounts")
      .update({
        type,
        name,
        account_category: category,
        sub_label: sub_label || null,
        bank_name: type === "bank" ? bank_name : null,
        account_number: type === "bank" ? account_number : null,
        ifsc: type === "bank" ? ifsc : null,
        branch: type === "bank" ? branch : null,
        upi_id: type === "upi" ? upi_id : null,
        upi_provider: type === "upi" ? upi_provider : null,
        is_default: !!is_default,
        opening_balance: Number(opening_balance || 0),
        is_active: is_active !== false,
      })
      .eq("id", accountId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedAccount || updatedAccount.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Bank/UPI account was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ account: updatedAccount[0] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const accountId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetAccountId = searchParams.get("target_account_id");

    // 1. Fetch account
    const { data: account, error: accountErr } = await supabase
      .from("bank_accounts")
      .select("id, name, type")
      .eq("id", accountId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (accountErr || !account) {
      return NextResponse.json({ error: "Bank/UPI Account not found" }, { status: 404 });
    }

    // 2. Query references in purchase payments, job work payments, customer payments, salary, etc.
    const { data: purchasePmts } = await supabase
      .from("purchase_payments")
      .select("id")
      .or(`bank_account_id.eq.${accountId},upi_id.eq.${accountId}`)
      .eq("business_id", businessId);

    const { data: jobWorkPmts } = await supabase
      .from("job_work_payments")
      .select("id")
      .or(`bank_account_id.eq.${accountId},upi_id.eq.${accountId}`)
      .eq("business_id", businessId);

    const { data: brandConfigs } = await supabase
      .from("brand_bill_configs")
      .select("brand_id")
      .eq("bank_account_id", accountId)
      .eq("business_id", businessId);

    const purchaseCount = purchasePmts?.length || 0;
    const jobWorkCount = jobWorkPmts?.length || 0;
    const brandConfigCount = brandConfigs?.length || 0;
    const totalTransactions = purchaseCount + jobWorkCount;
    const hasReferences = totalTransactions > 0 || brandConfigCount > 0;

    // ACTION: Check reference status
    if (action === "check") {
      return NextResponse.json({
        hasReferences,
        purchaseCount,
        jobWorkCount,
        brandConfigCount,
        totalTransactions,
      });
    }

    // ACTION: Transfer links to target bank account
    if (action === "transfer") {
      if (!targetAccountId) {
        return NextResponse.json({ error: "Target bank account is required for transfer" }, { status: 400 });
      }

      if (targetAccountId === accountId) {
        return NextResponse.json({ error: "Target account must be different from source account" }, { status: 400 });
      }

      const { data: targetAccount } = await supabase
        .from("bank_accounts")
        .select("id, name")
        .eq("id", targetAccountId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetAccount) {
        return NextResponse.json({ error: "Target account not found" }, { status: 404 });
      }

      // Re-link purchase payments
      if (purchaseCount > 0) {
        await supabase
          .from("purchase_payments")
          .update({ bank_account_id: targetAccountId, updated_at: new Date().toISOString() })
          .eq("bank_account_id", accountId)
          .eq("business_id", businessId);
      }

      // Re-link job work payments
      if (jobWorkCount > 0) {
        await supabase
          .from("job_work_payments")
          .update({ bank_account_id: targetAccountId, updated_at: new Date().toISOString() })
          .eq("bank_account_id", accountId)
          .eq("business_id", businessId);
      }

      // Re-link brand bill configs
      if (brandConfigCount > 0) {
        await supabase
          .from("brand_bill_configs")
          .update({ bank_account_id: targetAccountId })
          .eq("bank_account_id", accountId)
          .eq("business_id", businessId);
      }

      // Soft-delete account
      const { error: deleteErr } = await supabase
        .from("bank_accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", accountId)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Account '${account.name}' deleted. Transferred transactions and billing templates to '${targetAccount.name}'.`,
      });
    }

    // ACTION: Force delete (Soft-delete account while preserving past ledger links)
    if (action === "force") {
      // Re-link brand configs to null if deleted
      if (brandConfigCount > 0) {
        await supabase
          .from("brand_bill_configs")
          .update({ bank_account_id: null })
          .eq("bank_account_id", accountId)
          .eq("business_id", businessId);
      }

      // Soft-delete account
      const { error: deleteErr } = await supabase
        .from("bank_accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", accountId)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Account '${account.name}' soft-deleted. Historical transaction logs and payments remain untouched for financial audit.`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
