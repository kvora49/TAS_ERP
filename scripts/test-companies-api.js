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

async function testApi() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const userRes = await client.query('SELECT id, email FROM users LIMIT 1');
    const user = userRes.rows[0];

    const memberships = await client.query(`
      SELECT 
        cm.id,
        cm.role,
        cm.status,
        cm.created_at,
        b.id as business_id,
        b.name as business_name,
        b.gstin,
        b.pan,
        b.address,
        b.phone,
        b.email,
        b.website,
        b.logo_url,
        b.currency,
        b.financial_year_start
      FROM company_members cm
      JOIN businesses b ON b.id = cm.company_id
      WHERE cm.user_id = $1 AND cm.status = 'active'
      ORDER BY cm.created_at ASC;
    `, [user.id]);

    console.log(`User ${user.email} has ${memberships.rows.length} company memberships:`);
    memberships.rows.forEach((m, idx) => {
      console.log(`${idx + 1}. [${m.business_id}] "${m.business_name}" (Role: ${m.role}, Status: ${m.status})`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

testApi();
