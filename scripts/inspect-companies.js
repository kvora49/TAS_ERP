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

async function inspect() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log('\n--- 1. USERS TABLE ---');
    const users = await client.query('SELECT id, email, full_name, role, business_id FROM users');
    console.log(users.rows);

    console.log('\n--- 2. BUSINESSES TABLE ---');
    const businesses = await client.query('SELECT id, name, email, gstin FROM businesses');
    console.log(businesses.rows);

    console.log('\n--- 3. COMPANY_MEMBERS TABLE ---');
    const members = await client.query(`
      SELECT cm.id, cm.user_id, cm.company_id, cm.role, cm.status, b.name as company_name
      FROM company_members cm
      LEFT JOIN businesses b ON b.id = cm.company_id
    `);
    console.log(members.rows);

    console.log('\n--- 4. AUTH.USERS ---');
    const authUsers = await client.query('SELECT id, email FROM auth.users');
    console.log(authUsers.rows);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await client.end();
  }
}

inspect();
