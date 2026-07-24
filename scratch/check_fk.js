const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testParamInsert() {
  const paramId = '643987cf-ae38-4d05-b280-be52d5d40b15';

  const { data: lots } = await supabase.from('production_lots').select('id, business_id').limit(1);
  const lot = lots[0];

  const { data: stages } = await supabase.from('lot_production_stages').select('id').eq('lot_id', lot.id).limit(1);
  const stage = stages[0];

  console.log("Testing stage_entry insert for Param (chakkesh)...");
  const { data: entry, error } = await supabase
    .from('stage_entries')
    .insert({
      business_id: lot.business_id,
      entry_number: 'TEST-PARAM-' + Date.now(),
      lot_id: lot.id,
      lot_stage_id: stage.id,
      entry_date: '2026-07-22',
      shift: 'day',
      qty_in: 100,
      qty_out: 100,
      wastage_qty: 0,
      wastage_percent: 0,
      qty_balance: 0,
      worker_id: paramId,
      worker_type: 'in_house',
      no_of_workers: 1,
      total_labor_cost: 0,
      status: 'completed'
    })
    .select('*');

  if (error) {
    console.error("FAIL:", error);
  } else {
    console.log("SUCCESS! Created entry:", entry[0].id);
    await supabase.from('stage_entries').delete().eq('id', entry[0].id);
  }
}

testParamInsert();
