import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch overdue bills (outstanding > 0 and due date passed)
    const today = new Date().toISOString().split("T")[0];

    const [overdueResult, templates] = await Promise.all([
      supabase
        .from("sale_bills")
        .select(`
          id, bill_number, bill_date, due_date, grand_total, outstanding_amount,
          payment_status, party:parties(id, name, company_name, phone)
        `)
        .eq("business_id", businessId)
        .neq("payment_status", "paid")
        .lt("due_date", today)
        .gt("outstanding_amount", 0)
        .order("due_date", { ascending: true })
        .limit(50),
      supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("business_id", businessId),
    ]);

    const overdueBills = (overdueResult.data || []).map((b: any) => ({
      ...b,
      party: Array.isArray(b.party) ? b.party[0] : b.party,
      days_overdue: Math.floor(
        (new Date().getTime() - new Date(b.due_date).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({
      overdue_bills: overdueBills,
      templates: templates.data || [],
      stats: {
        total_overdue: overdueBills.length,
        total_outstanding: overdueBills.reduce((s, b) => s + Number(b.outstanding_amount), 0),
        critical: overdueBills.filter((b) => b.days_overdue > 30).length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, template_type, template_text, bill_ids } = body;

    if (action === "save_template") {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .upsert(
          { business_id: businessId, template_type, template_text, updated_at: new Date().toISOString() },
          { onConflict: "business_id,template_type" }
        )
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, template: data });
    }

    if (action === "send_reminders") {
      // Generate WhatsApp deep links for each bill
      if (!bill_ids?.length) return NextResponse.json({ error: "No bills selected" }, { status: 400 });

      const { data: bills } = await supabase
        .from("sale_bills")
        .select("id, bill_number, outstanding_amount, due_date, party:parties(name, phone)")
        .in("id", bill_ids)
        .eq("business_id", businessId);

      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("template_text")
        .eq("business_id", businessId)
        .eq("template_type", "payment_reminder")
        .single();

      const links = (bills || []).map((b: any) => {
        const party = Array.isArray(b.party) ? b.party[0] : b.party;
        const tpl = template?.template_text || "Dear {name}, your bill {bill} of ₹{amount} is overdue since {due}. Please pay at earliest.";
        const msg = tpl
          .replace("{name}", party?.name || "Customer")
          .replace("{bill}", b.bill_number)
          .replace("{amount}", Number(b.outstanding_amount).toLocaleString("en-IN"))
          .replace("{due}", new Date(b.due_date).toLocaleDateString("en-IN"));
        const phone = (party?.phone || "").replace(/\D/g, "");
        return {
          bill_number: b.bill_number,
          party_name: party?.name,
          phone,
          message: msg,
          whatsapp_url: phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : null,
        };
      });

      return NextResponse.json({ success: true, links });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
