import { SupabaseClient } from "@supabase/supabase-js";

// Tables to export in foreign key dependency order
const TENANT_TABLES = [
  "businesses",
  "business_settings",
  "users",
  "roles",
  "user_roles",
  "brands",
  "godowns",
  "raw_material_types",
  "size_sets",
  "designs",
  "expense_types",
  "gst_rates",
  "bank_accounts",
  "units",
  "garment_types",
  "parties",
  "raw_material_purchases",
  "raw_material_purchase_items",
  "purchase_returns",
  "purchase_return_items",
  "purchase_rolls",
  "sale_bills",
  "sale_bill_items",
  "sale_bill_charges",
  "sale_rolls",
  "sales_orders",
  "sales_order_items",
  "sales_returns",
  "sales_return_items",
  "credit_notes",
  "finished_stock",
  "stock_ledger",
  "stock_transfers",
  "stock_adjustments",
  "production_lots",
  "production_lot_stages",
  "production_lot_materials",
  "production_stage_entries",
  "job_work_orders",
  "job_work_entries",
  "payments",
  "expenses",
  "cheques",
  "worker_payments",
  "audit_logs",
  "reminders",
  "notifications",
];

// Helper to escape values for raw SQL string
function formatSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export interface BackupResult {
  sqlDump: string;
  fileSize: number;
  tableCounts: Record<string, number>;
  dataPayload: Record<string, any[]>;
}

export async function generateDatabaseBackup(
  supabase: SupabaseClient,
  businessId: string
): Promise<BackupResult> {
  const timestamp = new Date().toISOString();
  const tableDataMap: Record<string, any[]> = {};
  const tableCounts: Record<string, number> = {};

  let sqlDump = `-- ========================================================\n`;
  sqlDump += `-- TAS ERP DATABASE BACKUP DUMP\n`;
  sqlDump += `-- Business ID: ${businessId}\n`;
  sqlDump += `-- Generated At: ${timestamp}\n`;
  sqlDump += `-- ========================================================\n\n`;
  sqlDump += `SET statement_timeout = 0;\n`;
  sqlDump += `SET lock_timeout = 0;\n`;
  sqlDump += `SET client_encoding = 'UTF8';\n\n`;
  sqlDump += `BEGIN;\n\n`;

  for (const tableName of TENANT_TABLES) {
    try {
      let query = supabase.from(tableName).select("*");
      
      // Filter by business_id if column exists or applicable
      if (tableName === "businesses") {
        query = query.eq("id", businessId);
      } else if (
        tableName !== "roles" && 
        tableName !== "user_roles"
      ) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) {
        // Table might not exist or error occurred, log comment
        sqlDump += `-- Note: Could not fetch ${tableName}: ${error.message}\n`;
        tableCounts[tableName] = 0;
        continue;
      }

      const rows = data || [];
      tableDataMap[tableName] = rows;
      tableCounts[tableName] = rows.length;

      if (rows.length > 0) {
        sqlDump += `-- Table: ${tableName} (${rows.length} rows)\n`;
        for (const row of rows) {
          const keys = Object.keys(row);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const vals = keys.map((k) => formatSqlValue(row[k])).join(", ");

          // Create ON CONFLICT clause if 'id' exists
          const conflictClause = row.id ? ` ON CONFLICT ("id") DO NOTHING` : ``;

          sqlDump += `INSERT INTO "${tableName}" (${cols}) VALUES (${vals})${conflictClause};\n`;
        }
        sqlDump += `\n`;
      }
    } catch (err: any) {
      sqlDump += `-- Note: Error reading table ${tableName}: ${err.message}\n`;
    }
  }

  sqlDump += `COMMIT;\n\n`;

  // Embed structured JSON payload for ultra-fast web-app restoration
  const jsonString = JSON.stringify({
    businessId,
    timestamp,
    tables: tableDataMap,
  });

  sqlDump += `-- DATA_JSON_START\n`;
  sqlDump += `-- ${Buffer.from(jsonString, "utf8").toString("base64")}\n`;
  sqlDump += `-- DATA_JSON_END\n`;

  const fileSize = Buffer.byteLength(sqlDump, "utf8");

  return {
    sqlDump,
    fileSize,
    tableCounts,
    dataPayload: tableDataMap,
  };
}

export interface RestoreResult {
  success: boolean;
  restoredCounts: Record<string, number>;
  message: string;
}

export async function restoreDatabaseBackup(
  supabase: SupabaseClient,
  businessId: string,
  sqlOrJsonContent: string
): Promise<RestoreResult> {
  const restoredCounts: Record<string, number> = {};

  try {
    let tableData: Record<string, any[]> | null = null;

    // 1. Check if content has embedded base64 JSON payload
    const jsonMatch = sqlOrJsonContent.match(/-- DATA_JSON_START\s*\n-- ([A-Za-z0-9+/=]+)\s*\n-- DATA_JSON_END/);
    if (jsonMatch && jsonMatch[1]) {
      const decoded = Buffer.from(jsonMatch[1], "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      
      // Multi-tenant check: Backup businessId must match or be compatible
      if (parsed.businessId && parsed.businessId !== businessId) {
        throw new Error(`Backup business ID (${parsed.businessId}) does not match active tenant ID (${businessId}).`);
      }
      tableData = parsed.tables;
    } else {
      // 2. Try parsing direct JSON format
      try {
        const directJson = JSON.parse(sqlOrJsonContent);
        if (directJson.tables) {
          tableData = directJson.tables;
        }
      } catch (_e) {
        // Not direct JSON
      }
    }

    if (!tableData) {
      throw new Error("Invalid or unsupported SQL backup file format. Could not extract restore dataset.");
    }

    // 3. Upsert tables in dependency order
    for (const tableName of TENANT_TABLES) {
      const rows = tableData[tableName];
      if (!rows || rows.length === 0) {
        restoredCounts[tableName] = 0;
        continue;
      }

      // Enforce business_id alignment for all rows
      const sanitizedRows = rows.map((r) => {
        const copy = { ...r };
        if (tableName !== "businesses" && tableName !== "roles" && tableName !== "user_roles" && copy.business_id) {
          copy.business_id = businessId;
        }
        return copy;
      });

      // Upsert in batches of 100
      let batchSuccessCount = 0;
      for (let i = 0; i < sanitizedRows.length; i += 100) {
        const chunk = sanitizedRows.slice(i, i + 100);
        const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: "id" });
        if (error) {
          console.warn(`[Restore Warning] Upsert on ${tableName} partial failure:`, error.message);
        } else {
          batchSuccessCount += chunk.length;
        }
      }

      restoredCounts[tableName] = batchSuccessCount;
    }

    return {
      success: true,
      restoredCounts,
      message: "Database restore completed successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      restoredCounts: {},
      message: err.message || "Database restore failed.",
    };
  }
}
