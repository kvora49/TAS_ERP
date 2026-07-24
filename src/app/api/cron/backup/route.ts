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
      const fileName = `auto_backup_${biz.id}_${timestamp}.sql`;

      let sqlDump = `-- TAS ERP Automated Backup\n`;
      sqlDump += `-- Business: ${biz.name} (${biz.id})\n`;
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
          file_name: fileName,
          file_size: `${(fileSize / 1024).toFixed(1)} KB`,
          file_url: publicUrl,
          type: "automatic",
          status: "completed",
        });
      } catch (e) {}

      // Enforce 30-day retention: delete local files older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      try {
        const files = fs.readdirSync(localDir);
        files.forEach((f) => {
          const filePath = path.join(localDir, f);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (e) {}

      results.push({ businessId: biz.id, fileName, publicUrl });
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
