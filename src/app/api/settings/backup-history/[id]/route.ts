import { createClient } from "@/lib/supabase/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api-response";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;
  const supabase = createClient();
  const backupId = params.id;

  try {
    // 1. Retrieve the backup record
    const { data: record, error: fetchError } = await supabase
      .from("backup_history")
      .select("*")
      .eq("id", backupId)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: "Backup record not found" }, { status: 404 });
    }

    // 2. Delete file from storage
    if (record.file_url?.includes("private-storage/backups/") || record.file_url?.startsWith("/backups/")) {
      // Local file deletion
      try {
        const localPath = record.file_url.startsWith("/")
          ? path.join(process.cwd(), "public", record.file_url)
          : path.join(process.cwd(), record.file_url);

        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (err: any) {
        console.warn("Failed to delete local backup file:", err.message);
      }
    } else if (record.file_key && process.env.R2_ACCOUNT_ID) {
      // R2 file deletion
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
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: record.file_key,
          })
        );
      } catch (err: any) {
        console.warn("Failed to delete R2 backup file:", err.message);
      }
    }

    // 3. Delete from Database
    const { error: deleteError } = await supabase
      .from("backup_history")
      .delete()
      .eq("id", backupId)
      .eq("business_id", businessId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}

