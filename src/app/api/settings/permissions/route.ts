import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MODULES = [
  "Dashboard",
  "Master Data",
  "Raw Materials",
  "Production",
  "Sales & Billing",
  "Reports",
  "Expenses",
];

const ROLES = ["owner", "admin", "manager", "accountant", "staff", "intern"];

function getDefaultPermission(role: string, module: string) {
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const isStaff = role === "staff";
  const isIntern = role === "intern";

  if (isOwner) {
    return { can_view: true, can_add: true, can_edit: true, can_delete: true, can_approve: true, can_export: true };
  }

  if (isAdmin) {
    return { can_view: true, can_add: true, can_edit: true, can_delete: true, can_approve: true, can_export: true };
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
    // Accountants view everything, manage sales, expenses, reports
    const isFin = ["Sales & Billing", "Expenses", "Reports", "Dashboard"].includes(module);
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
    // Staff view/add raw materials & production, view others
    const isOps = ["Raw Materials", "Production", "Dashboard"].includes(module);
    return {
      can_view: ["Dashboard", "Raw Materials", "Production", "Master Data"].includes(module),
      can_add: isOps,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_export: false,
    };
  }

  if (isIntern) {
    // Interns can only view Dashboard, Raw Materials, Production
    return {
      can_view: ["Dashboard", "Raw Materials", "Production"].includes(module),
      can_add: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_export: false,
    };
  }

  return { can_view: false, can_add: false, can_edit: false, can_delete: false, can_approve: false, can_export: false };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch permissions
    const { data: permissions, error } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. If empty, seed defaults
    if (!permissions || permissions.length === 0) {
      const inserts: any[] = [];
      for (const role of ROLES) {
        for (const moduleName of MODULES) {
          inserts.push({
            business_id: businessId,
            role,
            module: moduleName,
            ...getDefaultPermission(role, moduleName),
          });
        }
      }

      const { data: seeded, error: seedError } = await supabase
        .from("role_permissions")
        .insert(inserts)
        .select();

      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      return NextResponse.json({ permissions: seeded });
    }

    return NextResponse.json({ permissions });
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
      return NextResponse.json({ error: "Permissions must be an array" }, { status: 400 });
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
