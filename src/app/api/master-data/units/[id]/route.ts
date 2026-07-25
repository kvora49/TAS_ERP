import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const unitId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      abbreviation,
      base_unit_id,
      conversion_factor,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Unit Name is required" },
        { status: 400 }
      );
    }
    if (!abbreviation) {
      return NextResponse.json(
        { error: "Abbreviation is required" },
        { status: 400 }
      );
    }

    const { data: updatedUnit, error } = await supabase
      .from("units")
      .update({
        name,
        abbreviation,
        base_unit_id: base_unit_id || null,
        conversion_factor: conversion_factor !== undefined ? Number(conversion_factor) : 1.0,
      })
      .eq("id", unitId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedUnit || updatedUnit.length === 0) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ unit: updatedUnit[0] });
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
  const unitId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetUnitId = searchParams.get("target_unit_id");

    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id, name, abbreviation")
      .eq("id", unitId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Query raw materials referencing this unit
    const { data: rawMaterials } = await supabase
      .from("raw_material_types")
      .select("id, name")
      .eq("unit", unit.abbreviation)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const materialsCount = rawMaterials?.length || 0;

    if (action === "check") {
      return NextResponse.json({
        hasReferences: materialsCount > 0,
        materialsCount,
      });
    }

    if (action === "transfer") {
      if (!targetUnitId) {
        return NextResponse.json({ error: "Target unit is required for transfer" }, { status: 400 });
      }

      const { data: targetUnit } = await supabase
        .from("units")
        .select("id, name, abbreviation")
        .eq("id", targetUnitId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetUnit) {
        return NextResponse.json({ error: "Target unit not found" }, { status: 404 });
      }

      // Re-assign raw_material_types unit abbreviation
      if (materialsCount > 0) {
        await supabase
          .from("raw_material_types")
          .update({ unit: targetUnit.abbreviation })
          .eq("unit", unit.abbreviation)
          .eq("business_id", businessId);
      }

      await supabase
        .from("units")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", unitId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Unit '${unit.name}' deleted. Re-assigned ${materialsCount} raw materials to '${targetUnit.name}'.`,
      });
    }

    if (action === "force") {
      await supabase
        .from("units")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", unitId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Unit '${unit.name}' soft-deleted. Historical stock ledgers continue to preserve past unit symbols.`,
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
