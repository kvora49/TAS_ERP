import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { requireAuthGuard } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api-response";

export async function POST(req: Request) {
  // 1. Verify User Session
  const guard = await requireAuthGuard();
  if (!guard.success) return guard.response;
  const { user } = guard.ctx;

  try {
    const { filename, contentType, folder } = await req.json();

    if (!filename || !contentType || !folder) {
      return NextResponse.json(
        { error: "Missing file details (filename, contentType, folder)", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Server-side validation of folder and contentType
    const allowedFolders = [
      "worker-docs",
      "cheque-images",
      "attachments",
      "logos",
      "brand_logos",
      "bill_templates",
      "design_catalogs",
      "designs",
      "design_colours",
      "design_colour_images",
      "material_thumbnails",
      "lots",
      "stage-entries",
      "purchases",
      "returns",
      "stock",
      "workers",
    ];

    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    const allowedDocTypes = ["application/pdf", ...allowedImageTypes];

    const allowedTypes: Record<string, string[]> = {
      "worker-docs": allowedDocTypes,
      "cheque-images": allowedImageTypes,
      "attachments": allowedDocTypes,
      "logos": allowedImageTypes,
      "brand_logos": allowedImageTypes,
      "bill_templates": allowedDocTypes,
      "design_catalogs": allowedImageTypes,
      "design_colours": allowedImageTypes,
      "design_colour_images": allowedImageTypes,
      "material_thumbnails": allowedImageTypes,
      "lots": allowedImageTypes,
      "stage-entries": allowedDocTypes,
      "purchases": allowedDocTypes,
      "returns": allowedDocTypes,
      "stock": allowedImageTypes,
      "workers": allowedDocTypes,
    };

    if (!allowedFolders.includes(folder)) {
      return NextResponse.json(
        { error: "Invalid upload directory", code: "INVALID_FOLDER" },
        { status: 400 }
      );
    }

    if (!allowedTypes[folder]?.includes(contentType)) {
      return NextResponse.json(
        { error: `File type not allowed for ${folder}`, code: "INVALID_CONTENT_TYPE" },
        { status: 400 }
      );
    }

    const fileExt = filename.split(".").pop()?.toLowerCase();
    const safeExtensions: Record<string, string[]> = {
      "application/pdf": ["pdf"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "image/webp": ["webp"],
      "image/svg+xml": ["svg"]
    };

    const allowedExts = safeExtensions[contentType];
    if (!allowedExts || !fileExt || !allowedExts.includes(fileExt)) {
      return NextResponse.json(
        { error: "File extension does not match content type", code: "INVALID_EXTENSION" },
        { status: 400 }
      );
    }

    // 2. Check if real Cloudflare R2 credentials are set or placeholders
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const isR2Configured =
      r2AccountId &&
      r2AccessKey &&
      !r2AccountId.includes("placeholder") &&
      !r2AccessKey.includes("placeholder");

    const cleanFileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}.${fileExt}`;
    const fileKey = `${folder}/${user.id}/${cleanFileName}`;

    if (!isR2Configured) {
      // Return local placeholder mode indicator so frontend can upload as Data URL or local blob
      return NextResponse.json({
        isPlaceholder: true,
        fileKey,
        publicUrl: "",
      });
    }

    // Initialize S3 client for Cloudflare R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType,
    });

    // Generate Pre-signed PUT URL valid for 300 seconds (5 mins)
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicDomain = process.env.R2_PUBLIC_URL || "https://pub-placeholder.r2.dev";
    const publicUrl = `${publicDomain}/${fileKey}`;

    return NextResponse.json({
      isPlaceholder: false,
      uploadUrl,
      fileKey,
      publicUrl,
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

