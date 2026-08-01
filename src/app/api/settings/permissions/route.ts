import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { APP_MODULES } from "@/components/layout/Sidebar/navigation.config";

const ROLES = ["owner", "admin", "manager", "accountant", "staff", "intern"];

function getDefaultPermission(role: string, module: string) {
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const isStaff = role === "staff";
  const isIntern = role === "intern";

  if (isOwner || isAdmin) {
    return {
      can_view: true,
      can_add: true,
      can_edit: true,
      can_delete: true,
      can_approve: true,
      can_export: true,
    };
  }

  if (isManager) {
    // Managers can do everything except delete
    return {
      can_view: true,
      can_add: true,
      can_edit: true,
      can_delete: false,
      can_approve: true,
      can_export: true,
    };
  }

  if (isAccountant) {
    // Accountants manage sales, payments, expenses, reports
    const isFin = [
      "Sales & Billing",
      "Payments & Finance",
      "Reports",
      "Dashboard",
      "Reminders & WhatsApp",
    ].includes(module);
    return {
      can_view: true,
      can_add: isFin,
      can_edit: isFin,
      can_delete: false,
      can_approve: false,
      can_export: true,
    };
  }

  if (isStaff) {
    // Staff view/add operational modules
    const isOps = [
      "Master Data",
      "Parties",
      "Purchases",
      "Production",
      "Stock",
      "Scan (PWA)",
      "Dashboard",
    ].includes(module);
    return {
      can_view: true,
      can_add: isOps,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_export: false,
    };
  }

  if (isIntern) {
    // Interns can only view operational modules
    const isViewable = [
      "Dashboard",
      "Stock",
      "Production",
      "Master Data",
      "Purchases",
    ].includes(module);
    return {
      can_view: isViewable,
      can_add: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_export: false,
    };
  }

  return {
    can_view: true,
    can_add: false,
    can_edit: false,
    can_delete: false,
    can_approve: false,
    can_export: false,
  };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch existing permissions
    const { data: existing, error } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const existingMap = new Set(
      (existing || []).map((p: any) => `${p.role}:${p.module}`)
    );

    // 2. Identify missing module-role combinations (auto-seed missing)
    const missingInserts: any[] = [];
    for (const role of ROLES) {
      for (const moduleName of APP_MODULES) {
        if (!existingMap.has(`${role}:${moduleName}`)) {
          missingInserts.push({
            business_id: businessId,
            role,
            module: moduleName,
            ...getDefaultPermission(role, moduleName),
          });
        }
      }
    }

    let allPermissions = existing || [];

    // 3. Insert missing rows if any (handles newly added modules automatically!)
    if (missingInserts.length > 0) {
      const { createClient: createAdminClient } = await import(
        "@supabase/supabase-js"
      );
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: newSeeded, error: seedError } = await supabaseAdmin
        .from("role_permissions")
        .upsert(missingInserts, { onConflict: "business_id,role,module" })
        .select();

      if (!seedError && newSeeded) {
        // Merge existing and newly seeded
        const combinedMap = new Map();
        [...allPermissions, ...newSeeded].forEach((p) => {
          combinedMap.set(`${p.role}:${p.module}`, p);
        });
        allPermissions = Array.from(combinedMap.values());
      }
    }

    // Filter to return only current active APP_MODULES
    const activeModuleSet = new Set(APP_MODULES as readonly string[]);
    const finalPermissions = allPermissions.filter((p: any) =>
      activeModuleSet.has(p.module)
    );

    return NextResponse.json({ permissions: finalPermissions });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { permissions } = body; // Array of permission updates

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "Permissions must be an array" },
        { status: 400 }
      );
    }

    const upserts = permissions.map((p: any) => ({
      business_id: businessId,
      role: p.role,
      module: p.module,
      can_view: !!p.can_view,
      can_add: !!p.can_add,
      can_edit: !!p.can_edit,
      can_delete: !!p.can_delete,
      can_approve: !!p.can_approve,
      can_export: !!p.can_export,
    }));

    const { error } = await supabase
      .from("role_permissions")
      .upsert(upserts, { onConflict: "business_id,role,module" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
