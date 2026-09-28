import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: accounts, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    // Parallel fetch of all transaction sources to compute live balances
    const [
      paymentsRes,
      expensesRes,
      incomeRes,
      salaryRes,
      chequesRes,
      purchasePaymentsRes,
      jobWorkPaymentsRes,
    ] = await Promise.all([
      supabase
        .from("payments")
        .select("bank_account_id, amount, direction")
        .eq("business_id", businessId)
        .neq("status", "cancelled"),

      supabase
        .from("expenses")
        .select("paid_from_account_id, amount")
        .eq("business_id", businessId),

      supabase
        .from("misc_income")
        .select("received_in_account_id, amount")
        .eq("business_id", businessId),

      supabase
        .from("salary_entries")
        .select("bank_account_id, net_salary")
        .eq("business_id", businessId),

      supabase
        .from("cheques")
        .select("received_account_id, amount, direction")
        .eq("status", "cleared")
        .eq("business_id", businessId),

      supabase
        .from("purchase_payments")
        .select("bank_account_id, upi_id, paid_amount")
        .eq("business_id", businessId),

      supabase
        .from("job_work_payments")
        .select("bank_account_id, upi_id, paid_amount")
        .eq("business_id", businessId),
    ]);

    const netMap: Record<string, number> = {};

    const addDelta = (accId: string | null | undefined, delta: number) => {
      if (!accId) return;
      netMap[accId] = (netMap[accId] || 0) + delta;
    };

    (paymentsRes.data || []).forEach((p: any) => {
      const amt = Number(p.amount || 0);
      addDelta(p.bank_account_id, p.direction === "received" ? amt : -amt);
    });

    (expensesRes.data || []).forEach((e: any) => {
      addDelta(e.paid_from_account_id, -Number(e.amount || 0));
    });

    (incomeRes.data || []).forEach((inc: any) => {
      addDelta(inc.received_in_account_id, Number(inc.amount || 0));
    });

    (salaryRes.data || []).forEach((s: any) => {
      addDelta(s.bank_account_id, -Number(s.net_salary || 0));
    });

    (chequesRes.data || []).forEach((chq: any) => {
      const amt = Number(chq.amount || 0);
      addDelta(chq.received_account_id, chq.direction === "received" ? amt : -amt);
    });

    (purchasePaymentsRes.data || []).forEach((p: any) => {
      const amt = Number(p.paid_amount || 0);
      addDelta(p.bank_account_id || p.upi_id, -amt);
    });

    (jobWorkPaymentsRes.data || []).forEach((jw: any) => {
      const amt = Number(jw.paid_amount || 0);
      addDelta(jw.bank_account_id || jw.upi_id, -amt);
    });

    const accountsWithBalance = accounts.map((acc: any) => {
      const liveCurrentBalance = Number(acc.opening_balance || 0) + (netMap[acc.id] || 0);
      return {
        ...acc,
        current_balance: liveCurrentBalance,
      };
    });

    // Auto-heal any balance drift in the database so RPCs always see fresh balance
    const driftsToSync = accounts.filter((acc: any) => {
      const live = Number(acc.opening_balance || 0) + (netMap[acc.id] || 0);
      return Number(acc.current_balance) !== live;
    });

    if (driftsToSync.length > 0) {
      Promise.all(
        driftsToSync.map((acc: any) => {
          const live = Number(acc.opening_balance || 0) + (netMap[acc.id] || 0);
          return supabase
            .from("bank_accounts")
            .update({ current_balance: live, updated_at: new Date().toISOString() })
            .eq("id", acc.id)
            .eq("business_id", businessId);
        })
      ).catch(() => {});
    }

    return NextResponse.json({ accounts: accountsWithBalance });
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
    } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: "Account Type and Name are required" },
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

    const { data: account, error } = await supabase
      .from("bank_accounts")
      .insert({
        business_id: businessId,
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
        current_balance: Number(opening_balance || 0),
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
