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
    const { data: entry } = await supabase
      .from("calendar_entries")
      .select("id")
      .eq("id", entryId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    // File validation
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    // Determine file category
    const mime = file.type.toLowerCase();
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
        upsert: true,
      });

    let publicUrl = "";
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("calendar-attachments")
        .getPublicUrl(storagePath);
      publicUrl = urlData.publicUrl;
    } else {
      console.warn("[Attachments API] Storage upload warning (falling back to path):", uploadError.message);
    }

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
    const { data: attachment } = await supabase
      .from("calendar_attachments")
      .select("id, storage_path")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    // Remove from storage
    if (attachment.storage_path) {
      await supabase.storage.from("calendar-attachments").remove([attachment.storage_path]);
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
