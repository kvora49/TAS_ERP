const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const masterFile = path.join(migrationsDir, 'master_combined_migration.sql');

async function merge() {
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && f !== 'master_combined_migration.sql')
      .sort(); // Sort sequentially by timestamp prefix
      
    console.log(`Found ${files.length} SQL migration files to merge:`, files);
    
    let combinedSql = `-- =========================================================\n`;
    combinedSql += `-- MASTER COMBINED MIGRATION SCRIPT FOR TAS ERP (ALL PHASES)\n`;
    combinedSql += `-- Run this script once in your Supabase SQL Editor Dashboard.\n`;
    combinedSql += `-- =========================================================\n\n`;
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      combinedSql += `-- ---------------------------------------------------------\n`;
      combinedSql += `-- MIGRATION: ${file}\n`;
      combinedSql += `-- ---------------------------------------------------------\n\n`;
      combinedSql += content;
      combinedSql += `\n\n`;
    }
    
    // Add grants & reload command
    combinedSql += `-- ---------------------------------------------------------\n`;
    combinedSql += `-- POST-MIGRATION GRANTS & SCHEMA REFRESH\n`;
    combinedSql += `-- ---------------------------------------------------------\n\n`;
    combinedSql += `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;\n`;
    combinedSql += `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;\n`;
    combinedSql += `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;\n`;
    combinedSql += `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;\n`;
    combinedSql += `NOTIFY pgrst, 'reload schema';\n`;
    
    fs.writeFileSync(masterFile, combinedSql);
    console.log(`\nSuccess! Combined migration written to: ${masterFile}`);
  } catch (err) {
    console.error("Failed to merge migrations:", err.message);
  }
}

merge();
