import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const expenseTypeId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      icon,
      color,
      applicable_for,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !applicable_for || !Array.isArray(applicable_for) || applicable_for.length === 0 || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name, applicable areas list, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedExpenseType, error } = await supabase
      .from("expense_types")
      .update({
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        applicable_for,
        is_active: is_active !== false,
      })
      .eq("id", expenseTypeId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedExpenseType || updatedExpenseType.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Expense Type was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ expenseType: updatedExpenseType[0] });
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
  const expenseTypeId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetExpenseTypeId = searchParams.get("target_expense_type_id");

    const { data: expType, error: expErr } = await supabase
      .from("expense_types")
      .select("id, name")
      .eq("id", expenseTypeId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (expErr || !expType) {
      return NextResponse.json({ error: "Expense Type not found" }, { status: 404 });
    }

    // Check expense vouchers referencing this category
    const { data: vouchers } = await supabase
      .from("expenses")
      .select("id")
      .eq("category_id", expenseTypeId)
      .eq("business_id", businessId);

    const voucherCount = vouchers?.length || 0;

    if (action === "check") {
      return NextResponse.json({
        hasReferences: voucherCount > 0,
        voucherCount,
      });
    }

    if (action === "transfer") {
      if (!targetExpenseTypeId) {
        return NextResponse.json({ error: "Target Expense Type is required for transfer" }, { status: 400 });
      }

      const { data: targetType } = await supabase
        .from("expense_types")
        .select("id, name")
        .eq("id", targetExpenseTypeId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetType) {
        return NextResponse.json({ error: "Target Expense Type not found" }, { status: 404 });
      }

      if (voucherCount > 0) {
        await supabase
          .from("expenses")
          .update({ category_id: targetExpenseTypeId })
          .eq("category_id", expenseTypeId)
          .eq("business_id", businessId);
      }

      await supabase
        .from("expense_types")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseTypeId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Expense Type '${expType.name}' deleted. Re-classified ${voucherCount} expense vouchers to '${targetType.name}'.`,
      });
    }

    if (action === "force") {
      await supabase
        .from("expense_types")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseTypeId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Expense Type '${expType.name}' soft-deleted. Historical expense vouchers remain intact.`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
