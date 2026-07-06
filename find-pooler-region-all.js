const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'eu-south-1',
  'eu-south-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'ca-central-1',
  'me-south-1',
  'me-central-1',
  'af-south-1'
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
    console.log(`\nSUCCESS! Region: ${region}`);
    console.log(`Host: ${host}`);
    await client.end();
    return true;
  } catch (err) {
    if (err.message.includes('tenant/user') && err.message.includes('not found')) {
      // Not in this region
      process.stdout.write(`${region}: not found\n`);
    } else {
      console.log(`\nRegion ${region} failed with: ${err.message}`);
      // If it's a password auth error or connection error that isn't ENOTFOUND/not found, it means the server resolved it
      if (!err.message.includes('ENOTFOUND') && !err.message.includes('ETIMEDOUT')) {
        console.log(`Region ${region} might be correct! (Status check: host reachable)`);
        return true;
      }
    }
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  console.log("Searching for project region among all global poolers...");
  for (const region of regions) {
    const found = await tryRegion(region);
    if (found) {
      console.log("Done.");
      process.exit(0);
    }
  }
  console.log("\nCould not find region.");
  process.exit(1);
}

run();
