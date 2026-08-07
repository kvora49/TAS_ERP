import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { SalesBillService } from "@/services/sales-bill.service";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new SalesBillRepository(supabase);
    
    // Fetch bill details and authenticated user in parallel
    const [detail, userResult] = await Promise.all([
      repo.getDetailById(params.id, businessId),
      supabase.auth.getUser()
    ]);

    if (!detail) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Role-gate profit data: only return it for owners/admins
    const user = userResult.data?.user || null;
    let profit = null;
    if (user) {
      const { data: member } = await supabase
        .from("business_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (member && (member.role === "owner" || member.role === "admin")) {
        profit = detail.profit;
      }
    }

    return NextResponse.json({
      bill: detail.bill,
      profit,
      brand: detail.brand,
      brandConfig: detail.brandConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const repo = new SalesBillRepository(supabase);
    const service = new SalesBillService(repo);

    await service.validateAndUpdate(params.id, body, businessId);

    // Fire-and-forget audit log
    void logAudit(businessId, "update", "sale_bills", params.id, {
      bill_number: body.bill_number,
      grand_total: body.grand_total,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. Fetch sales bill details
    const { data: bill, error: fetchErr } = await supabase
      .from("sale_bills")
      .select(`
        *,
        items:sale_bill_items(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !bill) {
      return NextResponse.json({ error: "Sales bill not found" }, { status: 404 });
    }

    if (bill.status === "cancelled") {
      return NextResponse.json({ error: "This sales bill is already cancelled" }, { status: 400 });
    }

    // 2. Stock Usage & Payment Lock Check
    // If payments have been received against this bill, block cancellation
    if (Number(bill.paid_amount || 0) > 0) {
      return NextResponse.json(
        { error: `Cannot cancel bill: Received payment of ₹${bill.paid_amount} exists for this bill. Please cancel or unallocate payments first.` },
        { status: 400 }
      );
    }

    const { data: allocations } = await supabase
      .from("payment_allocations")
      .select("id, amount")
      .eq("bill_id", id)
      .eq("business_id", businessId);

    if (allocations && allocations.length > 0) {
      const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      if (totalAllocated > 0) {
        return NextResponse.json(
          { error: `Cannot cancel bill: Active payment allocation of ₹${totalAllocated} linked to this bill.` },
          { status: 400 }
        );
      }
    }

    // 3. Reverse stock & record stock_ledger entries
    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      for (const item of bill.items) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        // A. Finished Goods stock reversal via ledger & reconciliation
        if (item.design_id) {
          const godownId = bill.godown_id;
          if (godownId) {
            await supabase.from("stock_ledger").insert({
              business_id: businessId,
              item_type: "finished_good",
              item_id: item.design_id,
              godown_id: godownId,
              transaction_type: "sale_bill_cancellation_inflow",
              quantity_delta: qty,
              value_delta: Number(item.amount || 0),
              reference_table: "sale_bills",
              reference_id: bill.id,
              created_by: bill.created_by || null,
            });
          }
        }

        // B. Fabric & Raw Material stock reversal
        if (item.material_type_id || item.item_type === "fabric") {
          // Restore sold fabric rolls if any
          const { data: saleRolls } = await supabase
            .from("sale_rolls")
            .select("*")
            .eq("sale_item_id", item.id);

          if (saleRolls && saleRolls.length > 0) {
            for (const sr of saleRolls) {
              if (sr.purchase_roll_id) {
                const { data: pRoll } = await supabase
                  .from("purchase_rolls")
                  .select("remaining_meters")
                  .eq("id", sr.purchase_roll_id)
                  .maybeSingle();

                if (pRoll) {
                  const restoredMeters = Number(pRoll.remaining_meters || 0) + Number(sr.meters || 0);
                  await supabase
                    .from("purchase_rolls")
                    .update({ remaining_meters: restoredMeters })
                    .eq("id", sr.purchase_roll_id);
                }
              }
            }
          }

          // Restore raw_material_current_stock & reconcile if material_type_id exists
          if (item.material_type_id) {
            await reconcileRawMaterialStock(supabase, businessId, item.material_type_id);
          }
        }
      }
    }

    // 3.5 Reverse customer party balance & soft-delete party ledger entry
    if (bill.party_id && Number(bill.grand_total || 0) > 0) {
      const { data: party } = await supabase
        .from("parties")
        .select("current_balance")
        .eq("id", bill.party_id)
        .maybeSingle();

      if (party) {
        const newBal = Math.max(0, Number(party.current_balance || 0) - Number(bill.grand_total || 0));
        await supabase
          .from("parties")
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", bill.party_id);
      }

      await supabase
        .from("party_ledger")
        .update({ deleted_at: new Date().toISOString() })
        .eq("reference_id", id);
    }

    // 3.6 Revert Sales Order linkage if created from a Sales Order
    if (bill.sale_order_id) {
      await supabase
        .from("sale_orders")
        .update({
          converted_bill_id: null,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.sale_order_id);
    }

    // 4. Update sales bill status to 'cancelled' and mark deleted_at for record keeping
    const { error: cancelErr } = await supabase
      .from("sale_bills")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 });
    }

    // 5. Trigger real-time finished stock reconciliation to restore exact stock
    if (bill.items && Array.isArray(bill.items)) {
      try {
        const designIdsToReconcile = Array.from(new Set(bill.items.map((it: any) => it.design_id).filter(Boolean)));
        for (const dId of designIdsToReconcile) {
          await reconcileFinishedStock(supabase, businessId, dId as string);
        }
      } catch (recErr) {
        console.warn("Finished stock reconciliation warning on bill cancellation:", recErr);
      }
    }

    // Fire-and-forget audit log
    void logAudit(businessId, "cancel", "sale_bills", id, {
      status: "cancelled",
      deleted_at: new Date().toISOString(),
    }, { bill_number: bill.bill_number, grand_total: bill.grand_total, status: bill.status });

    return NextResponse.json({
      success: true,
      message: `Sales Bill '${bill.bill_number}' successfully cancelled and stock restored to inventory.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
