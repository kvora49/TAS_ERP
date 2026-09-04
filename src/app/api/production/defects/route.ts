import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lot_id");
  const workerId = searchParams.get("worker_id");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("lot_defects")
      .select(`
        *,
        lot:production_lots (
          id,
          lot_number,
          lot_name,
          design_id,
          design:designs (id, name, code:design_number),
          colour:design_colours (id, colour_name, hex_code:colour_hex)
        ),
        colour:design_colours!colour_id (id, colour_name, hex_code:colour_hex),
        responsible_worker:parties (
          id,
          name,
          code
        ),
        detected_at_stage:lot_production_stages!detected_at_stage_id (
          id,
          stage_name,
          sequence_no
        ),
        responsible_stage:lot_production_stages!responsible_stage_id (
          id,
          stage_name,
          sequence_no
        ),
        resolutions:defect_resolutions (
          id,
          resolution_type,
          resolution_date,
          qty_recovered,
          qty_b_grade,
          qty_scrapped,
          recovered_size_quantities,
          b_grade_size_quantities,
          scrapped_size_quantities,
          deduction_amount,
          cloth_cost_recovery,
          rework_cost,
          rework_cost_mode,
          material_write_off_value,
          waste_reason,
          remarks,
          target_godown:godowns (id, name),
          created_at
        )
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (lotId) query = query.eq("lot_id", lotId);
    if (workerId) query = query.eq("responsible_worker_id", workerId);
    if (status && status !== "all") {
      if (status === "in_rework" || status === "sent_for_rework") {
        query = query.in("status", ["sent_for_rework", "in_rework"]);
      } else {
        query = query.eq("status", status);
      }
    }
    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`defect_number.ilike.%${term}%,description.ilike.%${term}%,defect_category.ilike.%${term}%`);
    }

    const { data: defects, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ defects: defects || [] });
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
      lot_id,
      defect_date,
      detected_at_stage_id,
      defect_category,   // free-text — any string allowed, no enum restriction
      size_quantities,   // { "28": 5, "30": 8, "32": 7 } — required instead of quantity
      colour_id,         // optional: specific colour variant affected
      description,
      responsible_worker_id,
      responsible_stage_id,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!lot_id || !defect_category) {
      return NextResponse.json(
        { error: "Lot ID and defect category are required." },
        { status: 400 }
      );
    }

    if (!size_quantities || typeof size_quantities !== "object") {
      return NextResponse.json(
        { error: "size_quantities is required — provide per-size breakdown e.g. {\"28\": 5, \"30\": 8}." },
        { status: 400 }
      );
    }

    // Calculate total quantity from size_quantities
    const qty = Object.values(size_quantities as Record<string, number>).reduce(
      (sum, v) => sum + Math.max(0, Number(v) || 0),
      0
    );

    if (qty <= 0) {
      return NextResponse.json(
        { error: "Total defective quantity must be greater than 0. Provide non-zero values in size_quantities." },
        { status: 400 }
      );
    }

    // ── Fetch and validate lot ─────────────────────────────────────────────
    const { data: lot, error: lotError } = await supabase
      .from("production_lots")
      .select("id, lot_number, status, total_quantity, defect_quantity")
      .eq("id", lot_id)
      .eq("business_id", businessId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found." }, { status: 404 });
    }

    // BUG 6 FIX: Allow logging defects on completed lots as "post_stock" defects
    const isCompletedLot = lot.status === "completed";
    const source = isCompletedLot ? "post_stock" : "in_production";

    // sent_for_rework: immediately deducts pieces from the live lot (in_production only)
    const sentForRework = !!(body.sent_for_rework) && source === "in_production";

    // If sent_for_rework is requested, ensure lot has sufficient live pieces to deduct
    if (sentForRework && Number(lot.total_quantity || 0) < qty) {
      return NextResponse.json(
        {
          error: `Cannot send ${qty} piece(s) for rework — lot only has ${lot.total_quantity} live piece(s) remaining.`,
        },
        { status: 400 }
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // ── Generate defect number: DEF-YYMM-XXXX ─────────────────────────────────
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `DEF-${yy}${mm}`;

    const { data: lastDefects } = await supabase
      .from("lot_defects")
      .select("defect_number")
      .eq("business_id", businessId)
      .like("defect_number", `${prefix}-%`)
      .order("defect_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastDefects && lastDefects.length > 0) {
      const numPart = lastDefects[0].defect_number.substring(prefix.length + 1);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const defectNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

    // ── Insert defect ──────────────────────────────────────────────────────
    const initialStatus = sentForRework ? "sent_for_rework" : "pending";

    const { data: defect, error: insertError } = await supabase
      .from("lot_defects")
      .insert({
        business_id: businessId,
        lot_id,
        defect_number: defectNumber,
        defect_date: defect_date || new Date().toISOString().split("T")[0],
        detected_at_stage_id: detected_at_stage_id || null,
        defect_category,                        // free text — no constraint
        size_quantities,                        // per-size breakdown
        quantity: qty,                          // computed total
        colour_id: colour_id || null,           // specific colour if provided
        source,                                 // in_production or post_stock
        description: description || null,
        responsible_worker_id: responsible_worker_id || null,
        responsible_stage_id: responsible_stage_id || null,
        sent_for_rework: sentForRework,
        status: initialStatus,
        created_by: userId,
      })
      .select(`
        *,
        lot:production_lots (id, lot_number),
        colour:design_colours!colour_id (id, colour_name, hex_code:colour_hex),
        responsible_worker:parties (id, name, code)
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // ── Update lot defect_quantity aggregate ───────────────────────────────
    await supabase
      .from("production_lots")
      .update({ defect_quantity: Number(lot.defect_quantity || 0) + qty })
      .eq("id", lot_id);

    // ── If sent_for_rework: deduct pieces from live lot immediately ────────
    if (sentForRework) {
      // 1. Deduct from production_lots.total_quantity
      await supabase
        .from("production_lots")
        .update({
          total_quantity: Math.max(0, Number(lot.total_quantity || 0) - qty),
        })
        .eq("id", lot_id);

      // 2. Deduct per-size from lot_size_quantities matching colour_id
      for (const [size, sizeQty] of Object.entries(size_quantities as Record<string, number>)) {
        const numQty = Math.max(0, Number(sizeQty) || 0);
        if (numQty <= 0) continue;

        let query = supabase
          .from("lot_size_quantities")
          .select("id, quantity, colour_id")
          .eq("lot_id", lot_id)
          .eq("size", size)
          .eq("business_id", businessId);

        if (colour_id) {
          query = query.eq("colour_id", colour_id);
        }

        const { data: existingSqs } = await query;
        if (existingSqs && existingSqs.length > 0) {
          let remToDeduct = numQty;
          for (const sq of existingSqs) {
            if (remToDeduct <= 0) break;
            const curQty = Number(sq.quantity || 0);
            const deduct = Math.min(curQty, remToDeduct);
            await supabase
              .from("lot_size_quantities")
              .update({ quantity: Math.max(0, curQty - deduct) })
              .eq("id", sq.id);
            remToDeduct -= deduct;
          }
        }
      }
    }

    await logAudit(businessId, "create", "lot_defects", defect.id, defect, {}, request);

    const response: any = { defect };
    if (sentForRework) {
      response.info = `${qty} pieces marked as in-rework and deducted from lot. Lot effective quantity is now ${Math.max(0, Number(lot.total_quantity || 0) - qty)}.`;
    }
    if (source === "post_stock") {
      response.warning =
        "This lot has already been moved to finished stock. Defect resolution will require selecting which finished stock entry to deduct from.";
    }

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
