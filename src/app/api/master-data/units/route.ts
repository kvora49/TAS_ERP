import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: units, error } = await supabase
      .from("units")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ units });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  
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

    const { data: unit, error } = await supabase
      .from("units")
      .insert({
        business_id: businessId,
        name,
        abbreviation,
        base_unit_id: base_unit_id || null,
        conversion_factor: conversion_factor !== undefined ? Number(conversion_factor) : 1.0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unit });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
