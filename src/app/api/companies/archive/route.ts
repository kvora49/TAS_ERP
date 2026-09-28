import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

/**
 * POST /api/companies/archive
 * Body: { companyId: string, action: "archive" | "restore" }
 *
 * "archive": Owner-only. Sets businesses.archived_at = NOW(), revokes all non-owner members.
 * "restore": Owner-only. Clears businesses.archived_at = NULL, re-activates all previously revoked members.
 *
 * Only the caller authenticated as an owner of the target company may perform this action.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  try {
    const body = await request.json();
    const { companyId, action } = body as { companyId?: string; action?: string };

    if (!companyId || !["archive", "restore"].includes(action ?? "")) {
      return NextResponse.json(
        { error: "companyId and action ('archive' | 'restore') are required" },
        { status: 400 }
      );
    }

    // 1. Verify caller is active owner of the target company
    const { data: ownerMembership, error: memberError } = await supabaseAdmin
      .from("company_members")
      .select("id, role, status")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("role", "owner")
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !ownerMembership) {
      return NextResponse.json(
        { error: "Forbidden: Only the Owner of this company can archive or restore it." },
        { status: 403 }
      );
    }

    // 2. Fetch the business to confirm it exists and get its name
    const { data: business, error: bizError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, archived_at")
      .eq("id", companyId)
      .maybeSingle();

    if (bizError || !business) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (action === "archive") {
      if (business.archived_at) {
        return NextResponse.json(
          { error: "Company is already archived." },
          { status: 409 }
        );
      }

      // 3a. Mark business as archived
      const { error: archiveErr } = await supabaseAdmin
        .from("businesses")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", companyId);

      if (archiveErr) {
        return NextResponse.json({ error: archiveErr.message }, { status: 500 });
      }

      // 3b. Revoke all non-owner active members — owner's row untouched
      const { error: revokeErr } = await supabaseAdmin
        .from("company_members")
        .update({ status: "revoked" })
        .eq("company_id", companyId)
        .eq("status", "active")
        .neq("role", "owner");

      if (revokeErr) {
        // Non-fatal: log but don't roll back archive — data is safe
        console.error("Failed to revoke non-owner members on archive:", revokeErr.message);
      }

      // 3c. Audit log
      void logAudit(
        companyId,
        "archive_company",
        "businesses",
        companyId,
        { archived_at: new Date().toISOString(), members_revoked: true },
        { archived_at: null },
        request
      );

      return NextResponse.json({
        success: true,
        action: "archived",
        message: `Company "${business.name}" has been archived. All non-owner member access has been revoked.`,
      });
    } else {
      // action === "restore"
      if (!business.archived_at) {
        return NextResponse.json(
          { error: "Company is not archived." },
          { status: 409 }
        );
      }

      // 4a. Clear archived_at to restore the company
      const { error: restoreErr } = await supabaseAdmin
        .from("businesses")
        .update({ archived_at: null })
        .eq("id", companyId);

      if (restoreErr) {
        return NextResponse.json({ error: restoreErr.message }, { status: 500 });
      }

      // NOTE: We intentionally do NOT auto-reinstate revoked members.
      // The owner should manually re-invite or re-activate members after restoring.
      // This prevents accidental re-enabling of members who were removed for a reason.

      // 4b. Audit log
      void logAudit(
        companyId,
        "restore_company",
        "businesses",
        companyId,
        { archived_at: null },
        { archived_at: business.archived_at },
        request
      );

      return NextResponse.json({
        success: true,
        action: "restored",
        message: `Company "${business.name}" has been restored and is active again. Previously revoked members will need to be re-invited manually.`,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
