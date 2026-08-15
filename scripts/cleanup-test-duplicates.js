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

async function cleanup() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Delete the 2 duplicate attempts
    const dupIds = ['70965329-eb9a-4212-a4a3-f9dab7a5dd2a', 'bd435051-4139-487c-a75d-fe6fd969b0e2'];
    await client.query('DELETE FROM company_members WHERE company_id = ANY($1)', [dupIds]);
    await client.query('DELETE FROM businesses WHERE id = ANY($1)', [dupIds]);

    // Ensure users.business_id points to 889e183e-9ff9-4145-ba1c-7f072df1b076 or 98d5189a-3d60-465d-87a3-f14ab17f627b
    await client.query(`
      UPDATE users 
      SET business_id = '889e183e-9ff9-4145-ba1c-7f072df1b076' 
      WHERE business_id = ANY($1)
    `, [dupIds]);

    console.log('Cleaned test duplicates.');

    const businesses = await client.query('SELECT id, name, gstin FROM businesses');
    console.log('\nCurrent Businesses:', businesses.rows);

    const members = await client.query(`
      SELECT cm.id, cm.user_id, cm.company_id, cm.role, b.name as company_name
      FROM company_members cm
      JOIN businesses b ON b.id = cm.company_id
    `);
    console.log('\nCurrent Memberships:', members.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

cleanup();
