import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─── POST /api/calendar/attachments ─────────────────────────────────────────
// Handles file upload for calendar entries
export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entryId = formData.get("entry_id") as string | null;

    if (!file || !entryId) {
      return NextResponse.json({ error: "file and entry_id are required" }, { status: 400 });
    }

    // Verify entry exists and belongs to business
    const { data: entry, error: entryError } = await supabase
      .from("calendar_entries")
      .select("id")
      .eq("id", entryId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 });
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    // File validation
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    // Determine file category. Do not accept SVG or arbitrary MIME types: SVG is active
    // content and public storage/viewers otherwise turn an attachment into an XSS vector.
    const mime = file.type.toLowerCase();
    const allowedMimeTypes = new Set([
      "image/jpeg", "image/png", "image/webp", "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
    ]);
    if (!allowedMimeTypes.has(mime)) {
      return NextResponse.json({ error: "Unsupported attachment type" }, { status: 400 });
    }
    let fileType = "other";
    if (mime.startsWith("image/")) fileType = "image";
    else if (mime.includes("pdf")) fileType = "pdf";
    else if (mime.includes("excel") || mime.includes("spreadsheet") || mime.includes("csv")) fileType = "excel";
    else if (mime.includes("word") || mime.includes("wordprocessing")) fileType = "word";
    else if (mime.startsWith("audio/")) fileType = "audio";

    // Upload to Supabase Storage bucket 'calendar-attachments'
    const sanitizeFilename = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const storagePath = `${businessId}/${entryId}/${Date.now()}_${sanitizeFilename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("calendar-attachments")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Attachment upload failed", code: "STORAGE_UPLOAD_FAILED" }, { status: 502 });
    }

    const { data: urlData } = supabase.storage
      .from("calendar-attachments")
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Insert database record
    const { data: attachment, error: dbError } = await supabase
      .from("calendar_attachments")
      .insert({
        business_id: businessId,
        entry_id: entryId,
        file_name: file.name,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        public_url: publicUrl || null,
        uploaded_by: user?.id || null,
      })
      .select("*")
      .single();

    if (dbError) {
      const { error: cleanupError } = await supabase.storage.from("calendar-attachments").remove([storagePath]);
      if (cleanupError) console.error("[Attachments API] Failed to clean up orphaned object:", cleanupError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/calendar/attachments ───────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id parameter required" }, { status: 400 });

    // Get attachment to find storage path
    const { data: attachment, error: attachmentError } = await supabase
      .from("calendar_attachments")
      .select("id, storage_path")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (attachmentError) return NextResponse.json({ error: attachmentError.message }, { status: 500 });
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    // Remove from storage
    if (attachment.storage_path) {
      const { error: storageError } = await supabase.storage.from("calendar-attachments").remove([attachment.storage_path]);
      if (storageError) return NextResponse.json({ error: "Attachment storage deletion failed" }, { status: 502 });
    }

    // Delete DB record
    const { error } = await supabase
      .from("calendar_attachments")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
