import { S3Client, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { Logger } from "@/lib/logger";

export async function POST(request: Request) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const primaryBucket = process.env.R2_BUCKET_NAME;
  const backupBucket = process.env.R2_BACKUP_BUCKET_NAME || process.env.R2_BACKUP_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !primaryBucket || !backupBucket) {
    return NextResponse.json(
      { error: "R2 primary or backup credentials not fully configured." },
      { status: 400 }
    );
  }

  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // List objects from primary bucket
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: primaryBucket,
        MaxKeys: 100,
      })
    );

    const contents = listResult.Contents || [];
    let syncedCount = 0;

    for (const obj of contents) {
      if (!obj.Key) continue;

      await s3.send(
        new CopyObjectCommand({
          Bucket: backupBucket,
          CopySource: `${primaryBucket}/${obj.Key}`,
          Key: obj.Key,
        })
      );
      syncedCount++;
    }

    Logger.debug(`[R2 Backup Sync] Successfully synced ${syncedCount} objects to backup bucket ${backupBucket}`);

    return NextResponse.json({
      success: true,
      syncedCount,
      primaryBucket,
      backupBucket,
    });
  } catch (err: any) {
    Logger.error("[R2 Backup Sync Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
