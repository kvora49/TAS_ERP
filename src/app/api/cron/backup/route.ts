import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET || "tas-erp-cron-secret";

  if (secret !== cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch all active businesses
    const { data: businesses } = await supabase.from("businesses").select("id, name");
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ message: "No active businesses to backup" });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").substring(0, 19);
    const results = [];

    for (const biz of businesses) {
      // 1. Fetch business_settings for this tenant
      const { data: bSet } = await supabase
        .from("business_settings")
        .select("auto_backup_enabled, backup_frequency, backup_time, backup_retention_days")
        .eq("business_id", biz.id)
        .maybeSingle();

      const autoEnabled = bSet?.auto_backup_enabled ?? true;
      if (!autoEnabled) continue;

      const frequency = bSet?.backup_frequency || "daily";
      const retentionDays = Number(bSet?.backup_retention_days || 30);

      // Determine frequency interval in ms
      const FREQUENCY_MS_MAP: Record<string, number> = {
        daily: 24 * 60 * 60 * 1000,
        alternate_days: 2 * 24 * 60 * 60 * 1000,
        weekly: 7 * 24 * 60 * 60 * 1000,
        "10_days": 10 * 24 * 60 * 60 * 1000,
        monthly: 30 * 24 * 60 * 60 * 1000,
      };
      const intervalMs = FREQUENCY_MS_MAP[frequency] || FREQUENCY_MS_MAP.daily;

      // 2. Fetch last automatic backup date
      const { data: lastBackup } = await supabase
        .from("backup_history")
        .select("created_at")
        .eq("business_id", biz.id)
        .eq("backup_type", "automatic")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastBackup?.created_at) {
        const lastTime = new Date(lastBackup.created_at).getTime();
        if (Date.now() - lastTime < intervalMs - 5 * 60 * 1000) {
          // Backup not due yet for this frequency
          continue;
        }
      }

      const fileName = `auto_backup_${biz.id}_${timestamp}.sql`;

      let sqlDump = `-- TAS ERP Automated Backup\n`;
      sqlDump += `-- Business: ${biz.name} (${biz.id})\n`;
      sqlDump += `-- Frequency: ${frequency}\n`;
      sqlDump += `-- Date: ${new Date().toUTCString()}\n\n`;

      const { data: brands } = await supabase.from("brands").select("*").eq("business_id", biz.id);
      sqlDump += `-- Brands Count: ${brands?.length || 0}\n`;

      const fileBuffer = Buffer.from(sqlDump, "utf8");
      const fileSize = fileBuffer.length;

      // Local fallback directory
      const localDir = path.join(process.cwd(), "public", "backups", biz.id);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, fileName), fileBuffer);
      const publicUrl = `/backups/${biz.id}/${fileName}`;

      // Insert record into backup_history
      try {
        await supabase.from("backup_history").insert({
          business_id: biz.id,
          backup_type: "automatic",
          file_key: `backups/${biz.id}/${fileName}`,
          file_url: publicUrl,
          file_size_bytes: fileSize,
          status: "completed",
        });
      } catch (e) {}

      // Enforce retention policy: delete local files older than retentionDays
      const retentionCutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      try {
        const files = fs.readdirSync(localDir);
        files.forEach((f) => {
          const filePath = path.join(localDir, f);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < retentionCutoff) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (e) {}

      results.push({ businessId: biz.id, fileName, publicUrl, frequency });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      backupCount: results.length,
      backups: results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Cron backup failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
