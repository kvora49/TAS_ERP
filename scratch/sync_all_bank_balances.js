const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      break;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function syncAllBalances() {
  console.log("=== SYNCING ALL BANK, UPI, AND CASH BALANCES ===");

  const { data: accounts, error } = await supabase.from("bank_accounts").select("*");
  if (error || !accounts) {
    console.error("Error fetching bank accounts:", error);
    return;
  }

  for (const acc of accounts) {
    const id = acc.id;
    const businessId = acc.business_id;

    // Fetch all movements for this account
    const [paymentsRes, expensesRes, incomeRes, salaryRes, chequesRes, purchasePaymentsRes, jobWorkPaymentsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, direction")
        .eq("bank_account_id", id)
        .eq("business_id", businessId)
        .neq("status", "cancelled"),

      supabase
        .from("expenses")
        .select("amount")
        .eq("paid_from_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("misc_income")
        .select("amount")
        .eq("received_in_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("salary_entries")
        .select("net_salary")
        .eq("bank_account_id", id)
        .eq("business_id", businessId),

      supabase
        .from("cheques")
        .select("amount, direction")
        .eq("received_account_id", id)
        .eq("status", "cleared")
        .eq("business_id", businessId),

      supabase
        .from("purchase_payments")
        .select("paid_amount, amount")
        .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
        .eq("business_id", businessId),

      supabase
        .from("job_work_payments")
        .select("paid_amount")
        .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
        .eq("business_id", businessId)
    ]);

    let totalInflow = 0;
    let totalOutflow = 0;

    (paymentsRes.data || []).forEach(p => {
      if (p.direction === "received") totalInflow += Number(p.amount || 0);
      else totalOutflow += Number(p.amount || 0);
    });

    (expensesRes.data || []).forEach(e => {
      totalOutflow += Number(e.amount || 0);
    });

    (incomeRes.data || []).forEach(inc => {
      totalInflow += Number(inc.amount || 0);
    });

    (salaryRes.data || []).forEach(s => {
      totalOutflow += Number(s.net_salary || 0);
    });

    (chequesRes.data || []).forEach(chq => {
      if (chq.direction === "received") totalInflow += Number(chq.amount || 0);
      else totalOutflow += Number(chq.amount || 0);
    });

    (purchasePaymentsRes.data || []).forEach(p => {
      totalOutflow += Number(p.paid_amount || p.amount || 0);
    });

    (jobWorkPaymentsRes.data || []).forEach(jw => {
      totalOutflow += Number(jw.paid_amount || 0);
    });

    const computedBalance = Number(acc.opening_balance || 0) + totalInflow - totalOutflow;

    console.log(`Account '${acc.name}' (${acc.type}): Opening = ${acc.opening_balance}, Inflows = ${totalInflow}, Outflows = ${totalOutflow} => Computed Current Balance = ₹${computedBalance}`);

    await supabase
      .from("bank_accounts")
      .update({ current_balance: computedBalance, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  console.log("=== SYNC COMPLETED SUCCESSFULLY ===");
}

syncAllBalances();
