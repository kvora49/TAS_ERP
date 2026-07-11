import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
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
    // 1. Fetch Party Details
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (partyError || !party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // 2. Fetch Bank Details
    const { data: bankDetails } = await supabase
      .from("party_bank_details")
      .select("*")
      .eq("party_id", id)
      .eq("business_id", businessId);

    // Initialize stats & history arrays
    let purchases: any[] = [];
    let returns: any[] = [];
    let sales: any[] = [];
    let stageAssignments: any[] = [];
    
    let totalPurchased = 0;
    let totalPurchasedPaid = 0;
    let totalPurchasedOutstanding = 0;

    let totalSold = 0;
    let totalSoldPaid = 0;
    let totalSoldOutstanding = 0;

    const isSupplier = party.type?.includes("supplier");
    const isCustomer = party.type?.includes("customer");
    const isWorker = party.type?.includes("worker");

    // 3. Fetch Supplier History
    if (isSupplier) {
      const { data: rawPurchases } = await supabase
        .from("raw_material_purchases")
        .select("id, purchase_number, invoice_no, invoice_date, grand_total, paid_amount, payment_status, created_at")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false });

      purchases = rawPurchases || [];
      
      // Calculate sums
      purchases.forEach((p) => {
        totalPurchased += Number(p.grand_total || 0);
        totalPurchasedPaid += Number(p.paid_amount || 0);
      });
      totalPurchasedOutstanding = totalPurchased - totalPurchasedPaid;

      // Fetch Returns
      const { data: rawReturns } = await supabase
        .from("purchase_returns")
        .select("id, return_number, return_date, return_type, grand_total, status, created_at")
        .eq("supplier_id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("return_date", { ascending: false });

      returns = rawReturns || [];
    }

    // 4. Fetch Customer History
    if (isCustomer) {
      const { data: rawSales } = await supabase
        .from("sale_bills")
        .select("id, bill_number, bill_type, bill_date, grand_total, paid_amount, payment_status, status, created_at")
        .eq("party_id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("bill_date", { ascending: false });

      sales = rawSales || [];

      // Calculate sums
      sales.forEach((s) => {
        totalSold += Number(s.grand_total || 0);
        totalSoldPaid += Number(s.paid_amount || 0);
      });
      totalSoldOutstanding = totalSold - totalSoldPaid;
    }

    // 5. Fetch Worker Assignments
    if (isWorker) {
      const { data: rawStages } = await supabase
        .from("lot_stages")
        .select(`
          id,
          stage_name,
          qty_in,
          qty_out,
          qty_balance,
          job_work_rate,
          total_job_work_amount,
          payment_status,
          status,
          created_at,
          production_lots (
            lot_number
          )
        `)
        .eq("worker_id", id)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      stageAssignments = rawStages || [];
    }

    return NextResponse.json({
      party: {
        ...party,
        bank_details: bankDetails || [],
      },
      supplierStats: {
        purchases,
        returns,
        totalPurchased,
        totalPurchasedPaid,
        totalPurchasedOutstanding,
      },
      customerStats: {
        sales,
        totalSold,
        totalSoldPaid,
        totalSoldOutstanding,
      },
      workerStats: {
        stageAssignments,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
