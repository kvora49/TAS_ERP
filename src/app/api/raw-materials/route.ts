import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { RawMaterialRepository } from "@/repositories/raw-material.repository";
import { RawMaterialService } from "@/services/raw-material.service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new RawMaterialRepository(supabase);
    const service = new RawMaterialService(repo);
    const materialTypes = await service.getMaterialTypes(businessId);

    return NextResponse.json({ materialTypes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const repo = new RawMaterialRepository(supabase);
    const service = new RawMaterialService(repo);

    const materialType = await service.createMaterialType(businessId, {
      name: body.name,
      description: body.description,
      category: body.category,
      unit: body.unit,
      image_url: body.image_url,
      default_supplier_id: body.default_supplier_id,
      reorder_level: Number(body.reorder_level || 0),
      is_active: body.is_active !== false,
    });

    return NextResponse.json({ materialType });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
