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

async function inspectBills() {
  console.log("Inspecting sale_bills table...");
  const { data: bills, error } = await supabase
    .from("sale_bills")
    .select("id, bill_number, bill_date, due_date, grand_total, paid_amount, payment_status, payment_terms, status, remarks")
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching bills:", error);
    return;
  }

  console.log(`Found ${bills.length} total bills:`);
  bills.forEach((b) => {
    const outstanding = (b.grand_total || 0) - (b.paid_amount || 0);
    console.log({
      bill_number: b.bill_number,
      bill_date: b.bill_date,
      due_date: b.due_date,
      grand_total: b.grand_total,
      paid_amount: b.paid_amount,
      outstanding_amount: outstanding,
      payment_status: b.payment_status,
      payment_terms: b.payment_terms,
      status: b.status,
      remarks: b.remarks,
    });
  });
}

inspectBills();
