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

function parseDaysFromTerms(terms) {
  if (!terms) return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function computeDueDate(billDateStr, dueDateStr, terms) {
  if (dueDateStr) return dueDateStr;
  if (!billDateStr) return new Date().toISOString().split("T")[0];
  const d = new Date(billDateStr);
  const addDays = parseDaysFromTerms(terms);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().split("T")[0];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRemindersLogic() {
  const today = new Date().toISOString().split("T")[0];
  const todayMs = new Date(today).getTime();

  const { data: bills, error } = await supabase
    .from("sale_bills")
    .select("id, bill_number, bill_date, due_date, payment_terms, grand_total, paid_amount, payment_status, status, party:parties(id, name, phone)")
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("payment_status", "paid");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const pendingBills = (bills || [])
    .map((b) => {
      const grandTotal = Number(b.grand_total || 0);
      const paidAmount = Number(b.paid_amount || 0);
      const outstandingAmount = Math.max(0, grandTotal - paidAmount);
      const effectiveDueDate = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
      const dueMs = new Date(effectiveDueDate).getTime();
      const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

      return {
        bill_number: b.bill_number,
        bill_date: b.bill_date,
        due_date: effectiveDueDate,
        payment_terms: b.payment_terms,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        days_overdue: daysOverdue,
        party: b.party,
      };
    })
    .filter((b) => b.outstanding_amount > 0);

  console.log("Reminders logic output:", JSON.stringify(pendingBills, null, 2));
}

testRemindersLogic();
