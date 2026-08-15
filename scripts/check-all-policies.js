const { Client } = require('pg');
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

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function checkAllPolicies() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
    `);

    console.log(`Total public policies: ${res.rows.length}`);
    const legacyPolicies = res.rows.filter(r => 
      (r.qual && r.qual.includes('users.business_id')) || 
      (r.with_check && r.with_check.includes('users.business_id'))
    );
    console.log(`Policies referencing users.business_id: ${legacyPolicies.length}`);
    legacyPolicies.forEach(p => {
      console.log(`- [${p.tablename}] "${p.policyname}": ${p.qual || p.with_check}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkAllPolicies();
