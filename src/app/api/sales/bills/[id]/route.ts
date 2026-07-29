import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { SalesBillService } from "@/services/sales-bill.service";

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

    // 3. Reverse finished stock & record stock_ledger entries
    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      for (const item of bill.items) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        // Fetch corresponding finished_stock row
        let { data: fsRows } = await supabase
          .from("finished_stock")
          .select("*")
          .eq("business_id", businessId)
          .eq("design_id", item.design_id);

        if (item.colour_id && fsRows && fsRows.length > 0) {
          const matchCol = fsRows.filter((r) => r.colour_id === item.colour_id);
          if (matchCol.length > 0) fsRows = matchCol;
        }

        if (bill.godown_id && fsRows && fsRows.length > 0) {
          const matchGodown = fsRows.filter((r) => r.godown_id === bill.godown_id);
          if (matchGodown.length > 0) fsRows = matchGodown;
        }

        const existingFs = fsRows && fsRows.length > 0 ? fsRows[0] : null;
        const godownId = existingFs?.godown_id || bill.godown_id;

        // Insert stock_ledger entry for reversal
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

        // Add back quantities to finished_stock
        if (existingFs) {
          const currentSizeQty = existingFs.size_quantities || {};
          const sz = item.size || "all";
          const currentSzQty = Number(currentSizeQty[sz] || 0);
          const newSzQty = currentSzQty + qty;
          const newTotalQty = Number(existingFs.total_quantity || 0) + qty;
          const costPerPiece = Number(
            existingFs.cost_per_piece ||
              (existingFs.total_quantity > 0 ? existingFs.total_value / existingFs.total_quantity : 0)
          );
          const newTotalValue = newTotalQty * costPerPiece;

          const updatedSizes = { ...currentSizeQty };
          if (sz !== "all") {
            updatedSizes[sz] = newSzQty;
          }

          await supabase
            .from("finished_stock")
            .update({
              size_quantities: updatedSizes,
              total_quantity: newTotalQty,
              total_value: newTotalValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingFs.id);
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

    // 5. Audit Log Record
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action: "cancel_sales_bill",
      table_name: "sale_bills",
      record_id: id,
      old_values: { bill_number: bill.bill_number, grand_total: bill.grand_total, status: bill.status },
      new_values: { status: "cancelled", deleted_at: new Date().toISOString() },
      ip_address: "127.0.0.1",
      user_agent: "NextJS Server",
    });

    return NextResponse.json({
      success: true,
      message: `Sales Bill '${bill.bill_number}' successfully cancelled and stock restored to inventory.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
