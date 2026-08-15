import { createClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateDatabaseBackup } from "@/lib/backup/backupEngine";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;
  const supabase = createClient();

  try {
    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    return NextResponse.json({
      settings: {
        auto_backup_enabled: serverSettings.auto_backup_enabled,
        backup_frequency: serverSettings.backup_frequency,
        backup_time: serverSettings.backup_time,
        backup_retention_days: serverSettings.backup_retention_days,
      },
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;
  const supabase = createClient();

  try {
    const body = await request.json();
    const { auto_backup_enabled, backup_frequency, backup_time, backup_retention_days } = body;

    const { error } = await supabase
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          auto_backup_enabled: !!auto_backup_enabled,
          backup_frequency: backup_frequency || "daily",
          backup_time: backup_time || "23:45",
          backup_retention_days: Number(backup_retention_days || 30),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { user, businessId } = guard.ctx;
  const supabase = createClient();

  try {
    // 1. Generate real SQL dump
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").substring(0, 19);
    const fileName = `backup_${businessId}_${timestamp}.sql`;

    const { sqlDump, fileSize } = await generateDatabaseBackup(supabase, businessId);
    const fileBuffer = Buffer.from(sqlDump, "utf8");

    let fileUrl = "";
    let fileKey = `backups/${businessId}/${fileName}`;

    // 2. Check if credentials are placeholder
    const isMock =
      !process.env.R2_ACCESS_KEY_ID ||
      process.env.R2_ACCESS_KEY_ID.includes("placeholder") ||
      !process.env.R2_ACCOUNT_ID ||
      process.env.R2_ACCOUNT_ID.includes("placeholder");

    if (isMock) {
      // Save file to private local folder
      const privateDir = path.join(process.cwd(), "private-storage", "backups", businessId);
      if (!fs.existsSync(privateDir)) {
        fs.mkdirSync(privateDir, { recursive: true });
      }
      fs.writeFileSync(path.join(privateDir, fileName), fileBuffer);
      fileUrl = `private-storage/backups/${businessId}/${fileName}`;
    } else {
      // Real upload to R2
      try {
        const s3 = new S3Client({
          region: "auto",
          endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          },
        });

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: fileKey,
            Body: fileBuffer,
            ContentType: "application/sql",
          })
        );
        fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
      } catch (uploadErr: any) {
        console.error("R2 Upload failed, falling back to private local storage:", uploadErr.message);
        const privateDir = path.join(process.cwd(), "private-storage", "backups", businessId);
        if (!fs.existsSync(privateDir)) {
          fs.mkdirSync(privateDir, { recursive: true });
        }
        fs.writeFileSync(path.join(privateDir, fileName), fileBuffer);
        fileUrl = `private-storage/backups/${businessId}/${fileName}`;
      }
    }

    // 3. Register backup record in backup_history table
    const { data: record, error: recordError } = await supabase
      .from("backup_history")
      .insert({
        business_id: businessId,
        backup_type: "manual",
        file_key: fileKey,
        file_url: fileUrl,
        file_size_bytes: fileSize,
        status: "completed",
        created_by: user.id,
      })
      .select()
      .single();

    if (recordError) {
      throw recordError;
    }

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return handleApiError(err);
  }
}

