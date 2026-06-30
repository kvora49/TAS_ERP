import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workerId } = params;

  try {
    const body = await request.json();
    const { doc_type, file_url, file_name, file_size_bytes } = body;

    if (!doc_type || !file_url) {
      return NextResponse.json(
        { error: "Missing required fields (doc_type, file_url)" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const { data: document, error } = await supabase
      .from("worker_documents")
      .insert({
        business_id: businessId,
        worker_id: workerId,
        doc_type,
        file_url,
        file_name: file_name || null,
        file_size_bytes: file_size_bytes || null,
        uploaded_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 450 });
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
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workerId } = params;
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("docId");

  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  }

  try {
    const { data: document } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("id", docId)
      .eq("worker_id", workerId)
      .eq("business_id", businessId)
      .single();

    const { error } = await supabase
      .from("worker_documents")
      .delete()
      .eq("id", docId)
      .eq("worker_id", workerId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (document) {
      // Log audit trail
      await logAudit(businessId, "delete_document", "worker_documents", docId, null, document);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
