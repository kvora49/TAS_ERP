import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuthGuard } from "@/lib/auth/guards";

const DOCUMENT_TYPES = new Set(["aadhaar", "pan", "bank_passbook", "other"]);
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

function isOwnedWorkerUpload(fileUrl: unknown, userId: string, businessId: string): boolean {
  if (typeof fileUrl !== "string") return false;
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicBase) return false;
  return fileUrl.startsWith(`${publicBase}/workers/${businessId}/${userId}/`);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const guard = await requireAuthGuard(undefined, supabase);
  if (!guard.success) return guard.response;
  const { businessId, user } = guard.ctx;

  const { id: workerId } = params;

  try {
    const body = await request.json();
    const { doc_type, file_url, file_name, file_size_bytes } = body;

    if (!DOCUMENT_TYPES.has(doc_type) || !file_url) {
      return NextResponse.json(
        { error: "A supported document type and file URL are required" },
        { status: 400 }
      );
    }

    const size = Number(file_size_bytes || 0);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_DOCUMENT_SIZE_BYTES) {
      return NextResponse.json({ error: "Invalid document size" }, { status: 400 });
    }

    if (!isOwnedWorkerUpload(file_url, user.id, businessId)) {
      return NextResponse.json(
        { error: "Document URL is not an upload owned by the active user and business" },
        { status: 400 }
      );
    }

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("id", workerId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (workerError) return NextResponse.json({ error: workerError.message }, { status: 500 });
    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

    const { data: document, error } = await supabase
      .from("worker_documents")
      .insert({
        business_id: businessId,
        worker_id: workerId,
        doc_type,
        file_url,
        file_name: file_name || null,
        file_size_bytes: file_size_bytes || null,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit trail
    await logAudit(businessId, "upload_document", "worker_documents", document.id, document);

    return NextResponse.json({ document });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const guard = await requireAuthGuard(undefined, supabase);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;

  const { id: workerId } = params;
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("docId");

  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  }

  try {
    const { data: document, error: documentError } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("id", docId)
      .eq("worker_id", workerId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const { error } = await supabase
      .from("worker_documents")
      .delete()
      .eq("id", docId)
      .eq("worker_id", workerId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit trail
    await logAudit(businessId, "delete_document", "worker_documents", docId, null, document);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
