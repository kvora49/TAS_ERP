import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { generateDatabaseBackup } from "@/lib/backup/backupEngine";
import { processBackupSync } from "@/lib/backup/backupSync";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function runBackupJob() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration for backup job");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all active businesses
  const { data: businesses, error: bizError } = await supabase.from("businesses").select("id, name");
  if (bizError) {
    throw bizError;
  }
  if (!businesses || businesses.length === 0) {
    return { success: true, message: "No active businesses to backup", backupCount: 0, backups: [] };
  }

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").substring(0, 19);
  const results = [];

  let cfBucket: any = null;
  try {
    const cfContext = getCloudflareContext();
    if ((cfContext?.env as any)?.R2_BUCKET) {
      cfBucket = (cfContext.env as any).R2_BUCKET;
    }
  } catch {
    // Non-worker or local dev
  }

  for (const biz of businesses) {
    const { data: bSet } = await supabase
      .from("business_settings")
      .select("auto_backup_enabled, backup_frequency, backup_time, backup_retention_days")
      .eq("business_id", biz.id)
      .maybeSingle();

    const autoEnabled = bSet?.auto_backup_enabled ?? true;
    if (!autoEnabled) continue;

    const frequency = bSet?.backup_frequency || "daily";
    const retentionDays = Number(bSet?.backup_retention_days || 30);

    const FREQUENCY_MS_MAP: Record<string, number> = {
      thrice_daily: 8 * 60 * 60 * 1000,
      twice_daily: 12 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      alternate_days: 2 * 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      "10_days": 10 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    const intervalMs = FREQUENCY_MS_MAP[frequency] || FREQUENCY_MS_MAP.daily;

    const { data: lastBackup } = await supabase
      .from("backup_history")
      .select("created_at")
      .eq("business_id", biz.id)
      .eq("backup_type", "automatic")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nowMs = Date.now();
    const lastBackupMs = lastBackup?.created_at ? new Date(lastBackup.created_at).getTime() : 0;
    const elapsedMs = nowMs - lastBackupMs;

    // Check if frequency interval has elapsed
    if (lastBackupMs > 0 && elapsedMs < intervalMs - 50 * 60 * 1000) {
      continue;
    }

    // For daily/periodic frequencies, verify if current hour matches user's preferred backup_time
    if (bSet?.backup_time && ["daily", "alternate_days", "weekly", "10_days", "monthly"].includes(frequency)) {
      const [prefHourStr] = bSet.backup_time.split(":");
      const preferredHour = parseInt(prefHourStr, 10);
      if (!isNaN(preferredHour)) {
        // Calculate current IST hour (UTC + 5:30)
        const istHour = new Date(nowMs + 5.5 * 60 * 60 * 1000).getUTCHours();
        // If not overdue by more than 24h, wait for preferred hour
        if (istHour !== preferredHour && elapsedMs < intervalMs + 24 * 60 * 60 * 1000) {
          continue;
        }
      }
    }

    const fileName = `auto_backup_${biz.id}_${timestamp}.sql`;
    const storageKey = `backups/${biz.id}/${fileName}`;

    // Generate real SQL dump
    const { sqlDump, fileSize } = await generateDatabaseBackup(supabase, biz.id);
    const fileBuffer = Buffer.from(sqlDump, "utf8");

    if (cfBucket) {
      await cfBucket.put(storageKey, fileBuffer, {
        httpMetadata: { contentType: "application/sql" },
      });
    } else {
      try {
        const privateDir = path.join(process.cwd(), "private-storage", "backups", biz.id);
        if (!fs.existsSync(privateDir)) {
          fs.mkdirSync(privateDir, { recursive: true });
        }
        fs.writeFileSync(path.join(privateDir, fileName), fileBuffer);
      } catch (fsErr) {
        console.warn("[Backup Job] Local filesystem write skipped or unsupported:", fsErr);
      }
    }

    // Insert record into backup_history
    try {
      await supabase.from("backup_history").insert({
        business_id: biz.id,
        backup_type: "automatic",
        file_key: storageKey,
        file_url: storageKey,
        file_size_bytes: fileSize,
        status: "completed",
      });
    } catch (e) {}

    // Enforce retention policy
    const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      await supabase
        .from("backup_history")
        .delete()
        .eq("business_id", biz.id)
        .lt("created_at", retentionCutoff);
    } catch (e) {}

    results.push({ businessId: biz.id, fileName, storageKey, frequency });
  }

  // Cross-account secondary R2 sync if backups were created
  if (results.length > 0) {
    try {
      await processBackupSync();
    } catch (_syncErr) {}
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    backupCount: results.length,
    backups: results,
  };
}
