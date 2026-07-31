import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

/**
 * Multi-Tier Storage Resolver for Invoice PDFs:
 * Priority 1: Cloudflare R2 (`invoices/{bill_id}.pdf`)
 * Priority 2: Supabase Storage (`invoices/{bill_id}.pdf`)
 * Priority 3: Returns null (signals dynamic PDF generation fallback)
 */
export async function getInvoicePdfFromStorage(billId: string): Promise<Buffer | null> {
  const fileKey = `invoices/${billId}.pdf`;

  // --- 1. Try Cloudflare R2 ---
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = process.env.R2_BUCKET_NAME;

  const isR2Configured =
    r2AccountId &&
    r2AccessKey &&
    r2SecretKey &&
    r2Bucket &&
    !r2AccountId.includes("placeholder") &&
    !r2AccessKey.includes("placeholder");

  if (isR2Configured) {
    try {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKey!,
          secretAccessKey: r2SecretKey!,
        },
      });

      const command = new GetObjectCommand({
        Bucket: r2Bucket!,
        Key: fileKey,
      });

      const r2Response = await s3.send(command);
      if (r2Response.Body) {
        const byteArray = await r2Response.Body.transformToByteArray();
        return Buffer.from(byteArray);
      }
    } catch (r2Err: any) {
      console.warn(`[StorageResolver] Invoice ${billId} not found in R2 or R2 read skipped:`, r2Err?.message);
    }
  }

  // --- 2. Try Supabase Storage ---
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data, error } = await supabase.storage
        .from("invoices")
        .download(`${billId}.pdf`);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    }
  } catch (sbErr: any) {
    console.warn(`[StorageResolver] Invoice ${billId} not found in Supabase Storage:`, sbErr?.message);
  }

  return null;
}
