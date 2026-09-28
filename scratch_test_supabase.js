const { createClient } = require("./node_modules/@supabase/supabase-js");
require("./node_modules/dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const businessId = "9e3507cf-a09e-4100-bf54-fd07745fe773";
  const { data: maybe, error: mErr } = await supabase
    .from("godowns")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("code", "WH-BHIW-01")
    .maybeSingle();
  console.log("maybeSingle result:", maybe, mErr);

  const { data: list } = await supabase
    .from("godowns")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("code", "WH-BHIW-01")
    .limit(1);
  console.log("list result:", list);
}
test();
