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
    const { error } = await supabase
      .from("units")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", unitId)
      .eq("business_id", businessId);

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
