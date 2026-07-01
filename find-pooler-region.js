const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'ca-central-1'
];

const user = 'postgres.cxekeitxvfkukujselxr';
const password = 'tas_erp';
const database = 'postgres';

async function tryRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543, // Transaction pooler port
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000 // Fast timeout
  });

  try {
    await client.connect();
    console.log(`\nFound it! Region: ${region}`);
    console.log(`Host: ${host}`);
    await client.end();
    return true;
  } catch (err) {
    if (err.message.includes('tenant/user') && err.message.includes('not found')) {
      // Not in this region
      process.stdout.write('.');
    } else {
      console.log(`\nRegion ${region} failed with: ${err.message}`);
      if (!err.message.includes('ENOTFOUND') && !err.message.includes('ETIMEDOUT')) {
        // If it was another error (like auth failed or similar), this might still be the right region!
        console.log(`Region ${region} might be correct!`);
        return true;
      }
    }
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  console.log("Searching for project region among poolers...");
  for (const region of regions) {
    const found = await tryRegion(region);
    if (found) {
      process.exit(0);
    }
  }
  console.log("\nCould not find region.");
  process.exit(1);
}

run();
