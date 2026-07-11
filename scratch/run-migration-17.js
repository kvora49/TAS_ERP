const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'aws-1-ap-northeast-2.pooler.supabase.com';
const port = 6543;
const user = 'postgres.cxekeitxvfkukujselxr';
const password = 'True_ass_Sniffers@69';
const database = 'postgres';

async function run() {
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    const migrationPath = 'c:/Project/TAS ERP/supabase/migrations/20260711000017_lot_rolls.sql';
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("Executing SQL...");
    await client.query(sql);
    console.log("Migration executed successfully!");

  } catch (err) {
    console.error("Execution failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
