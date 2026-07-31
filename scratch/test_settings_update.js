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

async function testSettings() {
  const { data: s } = await supabase.from('business_settings').select('*').limit(1);
  if (!s || s.length === 0) return;
  
  const id = s[0].id;
  console.log("Testing update on business_settings id:", id);
  const { error } = await supabase.from('business_settings').update({
    job_work_default_bill_type: s[0].job_work_default_bill_type || 'kacha'
  }).eq('id', id);

  console.log("Update error:", error ? error.message : "Success!");
}

testSettings();
