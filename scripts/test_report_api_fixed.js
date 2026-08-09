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

async function testReportLogic() {
  const bid = "889e183e-9ff9-4145-ba1c-7f072df1b076";

  const { data: godownsList, error: gErr } = await supabase.from("godowns").select("id, name, address, code").eq("business_id", bid);
  console.log("Godowns Error:", gErr);

  const { data: finishedRawData, error: fgErr } = await supabase
    .from("finished_stock")
    .select(`
      id, godown_id, total_quantity, total_value, cost_per_piece, size_quantities, design_id, colour_id,
      design:designs(id, name, design_number, sale_price),
      colour:design_colours(id, colour_name),
      godown:godowns(id, name)
    `)
    .eq("business_id", bid);

  console.log("Finished Stock Error:", fgErr);
  console.log("Finished Stock Count:", finishedRawData?.length);

  const finishedItems = (finishedRawData || []).map((s) => {
    const qty = Number(s.total_quantity || 0);
    const unitCost = Number(s.cost_per_piece || s.design?.sale_price || 0);
    const val = Number(s.total_value || 0) > 0 ? Number(s.total_value) : qty * unitCost;
    return { ...s, qty, unitCost, val };
  });

  const totalFGQty = finishedItems.reduce((s, r) => s + r.qty, 0);
  const totalFGVal = finishedItems.reduce((s, r) => s + r.val, 0);

  console.log(`SUCCESS! Total FG Qty: ${totalFGQty}, Total FG Value: ₹${totalFGVal}`);

  const godownMap = {};
  godownsList.forEach(g => {
    godownMap[g.id] = { id: g.id, name: g.name, address: g.address, fg_qty: 0, rm_qty: 0, acc_qty: 0, qty: 0, value: 0 };
  });

  finishedItems.forEach(s => {
    const gid = s.godown_id || "no_godown";
    if (godownMap[gid]) {
      godownMap[gid].fg_qty += s.qty;
      godownMap[gid].qty += s.qty;
      godownMap[gid].value += s.val;
    }
  });

  console.log("\nGodowns in Report:", Object.values(godownMap));
}

testReportLogic();
