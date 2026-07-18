import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Verify User Session
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { filename, contentType, folder } = await req.json();

    if (!filename || !contentType || !folder) {
      return NextResponse.json(
        { error: "Missing file details" },
        { status: 400 }
      );
    }

    // Server-side validation of folder and contentType
    const allowedFolders = ["worker-docs", "cheque-images", "attachments"];
    const allowedTypes: Record<string, string[]> = {
      "worker-docs": ["application/pdf", "image/jpeg", "image/png"],
      "cheque-images": ["image/jpeg", "image/png"],
      "attachments": ["application/pdf", "image/jpeg", "image/png"]
    };

    if (!allowedFolders.includes(folder)) {
      return NextResponse.json(
        { error: "Invalid upload directory" },
        { status: 400 }
      );
    }

    if (!allowedTypes[folder].includes(contentType)) {
      return NextResponse.json(
        { error: `File type not allowed for ${folder}` },
        { status: 400 }
      );
    }

    const fileExt = filename.split(".").pop()?.toLowerCase();
    const safeExtensions: Record<string, string[]> = {
      "application/pdf": ["pdf"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"]
    };

    const allowedExts = safeExtensions[contentType];
    if (!allowedExts || !fileExt || !allowedExts.includes(fileExt)) {
      return NextResponse.json(
        { error: "File extension does not match content type" },
        { status: 400 }
      );
    }

    // 2. Initialize S3 client for Cloudflare R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const cleanFileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}.${fileExt}`;
    const fileKey = `${folder}/${user.id}/${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType,
    });

    // Generate Pre-signed PUT URL valid for 300 seconds (5 mins)
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileKey}`;

    return NextResponse.json({
      uploadUrl,
      fileKey,
      publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Presigned URL generation failed" },
      { status: 500 }
    );
  }
}
