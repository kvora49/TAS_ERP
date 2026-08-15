import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getInvoicePdfFromStorage } from "@/lib/storage/invoice-storage";
import { handleApiError } from "@/lib/api-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid invoice identifier format", code: "INVALID_ID" }, { status: 400 });
    }

    const url = new URL(request.url);
    const forceDownload = url.searchParams.get("download") === "true";

    // 1. Multi-tier storage check (Cloudflare R2 -> Supabase Storage)
    const storedPdfBuffer = await getInvoicePdfFromStorage(id);
    if (storedPdfBuffer) {
      const disposition = forceDownload ? `attachment; filename="Invoice-${id}.pdf"` : `inline; filename="Invoice-${id}.pdf"`;
      return new NextResponse(new Uint8Array(storedPdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 2. Fetch bill details from Supabase to verify existence
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: bill, error: billErr } = await supabase
      .from("sale_bills")
      .select("id, bill_number, grand_total, bill_date")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (billErr || !bill) {
      return NextResponse.json({ error: "Invoice not found or expired", code: "NOT_FOUND" }, { status: 404 });
    }

    // 3. Fallback: Redirect to public bill view with auto-print/download mode
    const origin = url.origin || process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.redirect(`${origin}/p/bill/${id}?autoPrint=true`);
  } catch (err: any) {
    return handleApiError(err);
  }
}

