import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch write offs
    const { data: writeOffs, error } = await supabase
      .from("write_offs")
      .select(`
        id,
        bill_type,
        bill_id,
        write_off_type,
        amount,
        remarks,
        written_off_at,
        reversed_at,
        reversal_reason,
        written_off_by
      `)
      .eq("business_id", businessId)
      .order("written_off_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Fetch all bills to map bill numbers and party names
    const [salesResult, rmPurchasesResult, fgPurchasesResult, usersResult] = await Promise.all([
      supabase
        .from("sale_bills")
        .select("id, bill_number, party:parties(name)")
        .eq("business_id", businessId),
      supabase
        .from("raw_material_purchases")
        .select("id, purchase_number, party:parties(name)")
        .eq("business_id", businessId),
      supabase
        .from("purchase_bills")
        .select("id, bill_number, party:parties(name)")
        .eq("business_id", businessId),
      supabase
        .from("users")
        .select("id, fullName")
        .eq("business_id", businessId)
    ]);

    const sales = salesResult.data || [];
    const rmPurchases = rmPurchasesResult.data || [];
    const fgPurchases = fgPurchasesResult.data || [];
    const users = usersResult.data || [];

    // Map helpers
    const billMap: Record<string, { billNo: string; partyName: string }> = {};
    sales.forEach((s: any) => {
      const p = Array.isArray(s.party) ? s.party[0] : s.party;
      billMap[s.id] = { billNo: s.bill_number, partyName: p?.name || "—" };
    });
    rmPurchases.forEach((p: any) => {
      const partyObj = Array.isArray(p.party) ? p.party[0] : p.party;
      billMap[p.id] = { billNo: p.purchase_number, partyName: partyObj?.name || "—" };
    });
    fgPurchases.forEach((p: any) => {
      const partyObj = Array.isArray(p.party) ? p.party[0] : p.party;
      billMap[p.id] = { billNo: p.bill_number, partyName: partyObj?.name || "—" };
    });

    const userMap: Record<string, string> = {};
    users.forEach((u) => {
      userMap[u.id] = u.fullName;
    });

    // Format write-offs
    const formatted = writeOffs?.map((wo) => {
      const match = billMap[wo.bill_id] || { billNo: "Unknown Bill", partyName: "—" };
      return {
        ...wo,
        bill_number: match.billNo,
        party_name: match.partyName,
        written_off_by_name: userMap[wo.written_off_by] || "System",
      };
    });

    return NextResponse.json({ writeOffs: formatted });
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

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User session not found" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, write_off_id, reversal_reason, bill_id, bill_type, write_off_type, amount, remarks } = body;

    if (action === "reverse") {
      if (!write_off_id || !reversal_reason) {
        return NextResponse.json({ error: "Missing reversal parameters" }, { status: 400 });
      }

      const { data: success, error } = await supabase.rpc("reverse_write_off", {
        p_business_id: businessId,
        p_write_off_id: write_off_id,
        p_reversed_by: userId,
        p_reversal_reason: reversal_reason,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      if (!bill_id || !bill_type || !write_off_type || !amount || !remarks) {
        return NextResponse.json({ error: "Missing write-off parameters" }, { status: 400 });
      }

      const { data: writeOffId, error } = await supabase.rpc("record_write_off", {
        p_business_id: businessId,
        p_bill_type: bill_type,
        p_bill_id: bill_id,
        p_write_off_type: write_off_type,
        p_amount: Number(amount),
        p_remarks: remarks,
        p_written_off_by: userId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, writeOffId });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
