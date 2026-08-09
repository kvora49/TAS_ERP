import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { Logger } from "@/lib/logger";

export async function processBackupSync() {
  const primaryAccountId = process.env.R2_ACCOUNT_ID;
  const primaryAccessKey = process.env.R2_ACCESS_KEY_ID;
  const primarySecretKey = process.env.R2_SECRET_ACCESS_KEY;
  const primaryBucket = process.env.R2_BUCKET_NAME;

  const backupAccountId = process.env.R2_BACKUP_ACCOUNT_ID || primaryAccountId;
  const backupAccessKey = process.env.R2_BACKUP_ACCESS_KEY_ID || primaryAccessKey;
  const backupSecretKey = process.env.R2_BACKUP_SECRET_ACCESS_KEY || primarySecretKey;
  const backupBucket = process.env.R2_BACKUP_BUCKET_NAME || process.env.R2_BACKUP_BUCKET;

  if (
    !primaryAccountId ||
    !primaryAccessKey ||
    !primarySecretKey ||
    !backupAccountId ||
    !backupAccessKey ||
    !backupSecretKey ||
    !primaryBucket ||
    !backupBucket
  ) {
    return {
      success: false,
      error: "R2 primary or backup credentials not configured.",
    };
  }

  // Check for mock credentials
  if (
    primaryAccessKey.includes("placeholder") ||
    primaryAccountId.includes("placeholder")
  ) {
    return {
      success: true,
      syncedCount: 0,
      message: "Using mock/local fallback storage. R2 sync skipped.",
    };
  }

  try {
    const primaryS3 = new S3Client({
      region: "auto",
      endpoint: `https://${primaryAccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: primaryAccessKey,
        secretAccessKey: primarySecretKey,
      },
    });

    const backupS3 = new S3Client({
      region: "auto",
      endpoint: `https://${backupAccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: backupAccessKey,
        secretAccessKey: backupSecretKey,
      },
    });

    let syncedCount = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const listResult: ListObjectsV2CommandOutput = await primaryS3.send(
        new ListObjectsV2Command({
          Bucket: primaryBucket,
          Prefix: "backups/",
          ContinuationToken: continuationToken,
        })
      );

      const contents = listResult.Contents || [];

      for (const obj of contents) {
        if (!obj.Key) continue;

        // Fetch stream from primary R2 account
        const getObjRes = await primaryS3.send(
          new GetObjectCommand({
            Bucket: primaryBucket,
            Key: obj.Key,
          })
        );

        if (!getObjRes.Body) continue;
        const byteArray = await getObjRes.Body.transformToByteArray();

        // Write stream to secondary R2 account
        await backupS3.send(
          new PutObjectCommand({
            Bucket: backupBucket,
            Key: obj.Key,
            Body: byteArray,
            ContentType: getObjRes.ContentType || "application/sql",
          })
        );

        syncedCount++;
      }

      continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
    } while (continuationToken);

    Logger.debug(`[R2 Backup Sync] Successfully synced ${syncedCount} objects to secondary backup bucket ${backupBucket}`);

    return {
      success: true,
      syncedCount,
      primaryBucket,
      backupBucket,
    };
  } catch (err: any) {
    Logger.error("[R2 Backup Sync Error]", err);
    return {
      success: false,
      error: err.message || "R2 Cross-account backup sync failed.",
    };
  }
}
