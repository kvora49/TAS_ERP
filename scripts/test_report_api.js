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

  const { data: godownsList } = await supabase.from("godowns").select("id, name, location, code").eq("business_id", bid);
  console.log("Master Godowns:", godownsList);

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
  console.log("Finished Stock Items:", finishedRawData);

  const { data: rawMaterialsRawData, error: rmErr } = await supabase
    .from("raw_material_current_stock")
    .select(`
      id, godown_id, current_stock, unit_cost, stock_value,
      godown:godowns(id, name),
      material_type:raw_material_types(id, name, category, unit)
    `)
    .eq("business_id", bid);

  console.log("Raw Material Error:", rmErr);
  console.log("Raw Material Count:", rawMaterialsRawData?.length);

  const godownMap = {};
  godownsList.forEach(g => {
    godownMap[g.id] = { id: g.id, name: g.name, location: g.location, fg_qty: 0, rm_qty: 0, acc_qty: 0, qty: 0, value: 0 };
  });

  (finishedRawData || []).forEach(s => {
    const gid = s.godown_id || "no_godown";
    if (godownMap[gid]) {
      const q = Number(s.total_quantity || 0);
      const v = Number(s.total_value || 0);
      godownMap[gid].fg_qty += q;
      godownMap[gid].qty += q;
      godownMap[gid].value += v;
    }
  });

  (rawMaterialsRawData || []).forEach(r => {
    const gid = r.godown_id || "no_godown";
    if (godownMap[gid]) {
      const q = Number(r.current_stock || 0);
      const v = Number(r.stock_value || 0);
      const isAcc = (r.material_type?.category || "").toLowerCase().includes("button");
      if (isAcc) godownMap[gid].acc_qty += q;
      else godownMap[gid].rm_qty += q;
      godownMap[gid].qty += q;
      godownMap[gid].value += v;
    }
  });

  console.log("\nGodown Map Results:", Object.values(godownMap));
}

testReportLogic();
