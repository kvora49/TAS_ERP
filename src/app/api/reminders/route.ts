import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function parseDaysFromTerms(terms?: string | null): number {
  if (!terms) return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function computeDueDate(billDateStr: string, dueDateStr: string | null, terms: string | null): string {
  if (dueDateStr) return dueDateStr;
  if (!billDateStr) return new Date().toISOString().split("T")[0];
  const d = new Date(billDateStr);
  const addDays = parseDaysFromTerms(terms);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "bills";

  try {
    const today = new Date().toISOString().split("T")[0];
    const todayMs = new Date(today).getTime();

    if (type === "cheques") {
      const [chequesRes, templatesRes] = await Promise.all([
        supabase
          .from("cheques")
          .select(`
            id, cheque_number, bank_name, amount, cheque_date, status, direction,
            party:parties(id, name, company_name, phone)
          `)
          .eq("business_id", businessId)
          .eq("direction", "received")
          .in("status", ["pending", "deposited"])
          .order("cheque_date", { ascending: true }),
        supabase
          .from("whatsapp_templates")
          .select("*")
          .eq("business_id", businessId),
      ]);

      const cheques = (chequesRes.data || []).map((c: any) => {
        const dueMs = new Date(c.cheque_date).getTime();
        const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
        return {
          id: c.id,
          bill_number: c.cheque_number ? `PDC #${c.cheque_number}` : `Cheque`,
          bank_name: c.bank_name,
          bill_date: c.cheque_date,
          due_date: c.cheque_date,
          grand_total: Number(c.amount || 0),
          outstanding_amount: Number(c.amount || 0),
          party: Array.isArray(c.party) ? c.party[0] : c.party,
          days_overdue: daysOverdue,
          cheque_status: c.status,
        };
      });

      const overdueOnly = cheques.filter((c) => c.days_overdue >= 0);

      return NextResponse.json({
        type: "cheques",
        overdue_bills: cheques,
        templates: templatesRes.data || [],
        stats: {
          total_overdue: overdueOnly.length,
          total_outstanding: cheques.reduce((s, c) => s + c.outstanding_amount, 0),
          critical: cheques.filter((c) => c.days_overdue > 30).length,
        },
      });
    }

    const [billsRes, templatesRes] = await Promise.all([
      supabase
        .from("sale_bills")
        .select(`
          id, bill_number, bill_date, due_date, payment_terms, grand_total, paid_amount,
          payment_status, status, party:parties(id, name, company_name, phone)
        `)
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null)
        .neq("payment_status", "paid")
        .order("bill_date", { ascending: false }),
      supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("business_id", businessId),
    ]);

    const pendingBills = (billsRes.data || [])
      .map((b: any) => {
        const grandTotal = Number(b.grand_total || 0);
        const paidAmount = Number(b.paid_amount || 0);
        const outstandingAmount = Math.max(0, grandTotal - paidAmount);
        const effectiveDueDate = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
        const dueMs = new Date(effectiveDueDate).getTime();
        const daysOverdue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

        return {
          ...b,
          due_date: effectiveDueDate,
          outstanding_amount: outstandingAmount,
          party: Array.isArray(b.party) ? b.party[0] : b.party,
          days_overdue: daysOverdue,
        };
      })
      .filter((b) => b.outstanding_amount > 0);

    pendingBills.sort((a, b) => b.days_overdue - a.days_overdue);

    const overdueOnly = pendingBills.filter((b) => b.days_overdue >= 0);

    return NextResponse.json({
      type: "bills",
      overdue_bills: pendingBills,
      templates: templatesRes.data || [],
      stats: {
        total_overdue: overdueOnly.length,
        total_outstanding: pendingBills.reduce((s, b) => s + b.outstanding_amount, 0),
        critical: pendingBills.filter((b) => b.days_overdue > 30).length,
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
    const { action, template_type, template_text, bill_ids, target_type } = body;

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
      if (!bill_ids?.length) return NextResponse.json({ error: "No items selected" }, { status: 400 });

      const itemType = target_type || "bills";
      const selectedTemplateType = template_type || (itemType === "cheques" ? "pdc_reminder" : "payment_reminder");

      if (itemType === "cheques") {
        const [chequesRes, templateRes] = await Promise.all([
          supabase
            .from("cheques")
            .select("id, cheque_number, bank_name, amount, cheque_date, status, party:parties(id, name, company_name, phone)")
            .in("id", bill_ids)
            .eq("business_id", businessId),
          supabase
            .from("whatsapp_templates")
            .select("template_text")
            .eq("business_id", businessId)
            .eq("template_type", selectedTemplateType)
            .maybeSingle(),
        ]);

        const cheques = chequesRes.data || [];
        const defaultTemplates: Record<string, string> = {
          pdc_reminder: "Dear {name}, your PDC cheque {bill} of ₹{amount} is due on {due}. Please ensure sufficient balance.",
          payment_reminder: "Dear {name}, your PDC cheque {bill} of ₹{amount} is due on {due}. Kindly ensure funds. Thank you.",
        };
        const rawTemplateText = templateRes.data?.template_text || defaultTemplates[selectedTemplateType] || defaultTemplates.pdc_reminder;

        const groupedByParty: Record<string, { party: any; items: any[] }> = {};
        for (const c of cheques) {
          const party = Array.isArray(c.party) ? c.party[0] : c.party;
          const key = party?.id || party?.phone || party?.name || "unknown";
          if (!groupedByParty[key]) groupedByParty[key] = { party, items: [] };
          groupedByParty[key].items.push(c);
        }

        const links = Object.values(groupedByParty).map(({ party, items: partyCheques }) => {
          const partyName = party?.company_name || party?.name || "Customer";
          const phone = (party?.phone || "").replace(/\D/g, "");

          const chequeNos = partyCheques.map((c) => c.cheque_number ? `PDC #${c.cheque_number}` : "Cheque").join(", ");
          const totalAmount = partyCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
          const dueDates = partyCheques.map((c) => new Date(c.cheque_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }));
          const uniqueDueDates = Array.from(new Set(dueDates)).join(", ");

          let msg = rawTemplateText
            .replace(/\{\{party_name\}\}/g, partyName)
            .replace(/\{name\}/g, partyName)
            .replace(/\{\{invoice_no\}\}/g, chequeNos)
            .replace(/\{bill\}/g, chequeNos)
            .replace(/\{\{amount\}\}/g, totalAmount.toLocaleString("en-IN"))
            .replace(/\{amount\}/g, totalAmount.toLocaleString("en-IN"))
            .replace(/\{\{due_date\}\}/g, uniqueDueDates)
            .replace(/\{due\}/g, uniqueDueDates)
            .replace(/\s+,/g, ",");

          return {
            bill_id: partyCheques[0]?.id || "",
            bill_number: chequeNos,
            bill_count: partyCheques.length,
            party_name: partyName,
            phone,
            message: msg,
            whatsapp_url: phone ? `https://web.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(msg)}` : null,
          };
        });

        return NextResponse.json({ success: true, links });
      }

      const [billsRes, templateRes] = await Promise.all([
        supabase
          .from("sale_bills")
          .select("id, bill_number, grand_total, paid_amount, bill_date, due_date, payment_terms, party:parties(id, name, company_name, phone)")
          .in("id", bill_ids)
          .eq("business_id", businessId),
        supabase
          .from("whatsapp_templates")
          .select("template_text")
          .eq("business_id", businessId)
          .eq("template_type", selectedTemplateType)
          .maybeSingle(),
      ]);

      const bills = billsRes.data || [];
      const defaultTemplates: Record<string, string> = {
        payment_reminder: "Dear {{party_name}}, your bill {{invoice_no}} of ₹{{amount}} is due on {{due_date}}. Kindly make payment at earliest. Thank you.",
        overdue_reminder: "Dear {{party_name}}, your bill {{invoice_no}} of ₹{{amount}} is overdue by {days} days. Please clear your dues immediately.",
        bill_share: "Dear {{party_name}}, please find your bill {{invoice_no}} for ₹{{amount}} dated {date}.\n\nView Bill:\n{bill_url}\n\nThank you for your business.",
        pdc_reminder: "Dear {{party_name}}, your PDC cheque of ₹{{amount}} for bill {{invoice_no}} is due on {{due_date}}. Please ensure sufficient balance.",
      };

      const rawTemplateText = templateRes.data?.template_text || defaultTemplates[selectedTemplateType] || defaultTemplates.payment_reminder;

      const todayStr = new Date().toISOString().split("T")[0];
      const todayMs = new Date(todayStr).getTime();
      const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/sales")[0] || "";

      // Group bills by party (customer)
      const groupedByParty: Record<string, { party: any; bills: any[] }> = {};

      for (const b of bills) {
        const party = Array.isArray(b.party) ? b.party[0] : b.party;
        const key = party?.id || party?.phone || party?.name || "unknown";
        if (!groupedByParty[key]) {
          groupedByParty[key] = { party, bills: [] };
        }
        groupedByParty[key].bills.push(b);
      }

      const links = Object.values(groupedByParty).map(({ party, bills: partyBills }) => {
        const partyName = (party?.company_name || party?.name || "Customer").trim();
        const phone = (party?.phone || "").replace(/\D/g, "");

        const billNumbers = partyBills.map((b) => b.bill_number).join(", ");
        const totalOutstanding = partyBills.reduce((sum, b) => {
          const grandTotal = Number(b.grand_total || 0);
          const paidAmount = Number(b.paid_amount || 0);
          return sum + Math.max(0, grandTotal - paidAmount);
        }, 0);

        const dueDates = partyBills.map((b) => {
          const effDueDate = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
          return new Date(effDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
        });
        const uniqueDueDates = Array.from(new Set(dueDates)).join(", ");

        const billDates = partyBills.map((b) => {
          return b.bill_date ? new Date(b.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "";
        }).filter(Boolean);
        const uniqueBillDates = Array.from(new Set(billDates)).join(", ");

        const daysOverdueList = partyBills.map((b) => {
          const effDueDate = computeDueDate(b.bill_date, b.due_date, b.payment_terms);
          const dueMs = new Date(effDueDate).getTime();
          return Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
        });
        const maxDaysOverdue = Math.max(...daysOverdueList, 0);

        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "") : origin;

        const billUrl = partyBills.length > 0 && appBaseUrl
          ? `${appBaseUrl}/p/bill/${partyBills[0].id}`
          : "";

        let msg = rawTemplateText
          .replace(/\{\{party_name\}\}/g, partyName)
          .replace(/\{name\}/g, partyName)
          .replace(/\{\{invoice_no\}\}/g, billNumbers)
          .replace(/\{bill\}/g, billNumbers)
          .replace(/\{\{amount\}\}/g, totalOutstanding.toLocaleString("en-IN"))
          .replace(/\{amount\}/g, totalOutstanding.toLocaleString("en-IN"))
          .replace(/\{\{due_date\}\}/g, uniqueDueDates)
          .replace(/\{due\}/g, uniqueDueDates)
          .replace(/\{\{date\}\}/g, uniqueBillDates)
          .replace(/\{date\}/g, uniqueBillDates)
          .replace(/\{\{days\}\}/g, maxDaysOverdue.toString())
          .replace(/\{\{bill_url\}\}/g, billUrl ? `\n\n${billUrl}\n\n` : "")
          .replace(/\{bill_url\}/g, billUrl ? `\n\n${billUrl}\n\n` : "")
          .replace(/\s+,/g, ",")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        return {
          bill_id: partyBills[0]?.id || "",
          bill_number: billNumbers,
          bill_count: partyBills.length,
          party_name: partyName,
          phone,
          message: msg,
          whatsapp_url: phone ? `https://web.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(msg)}` : null,
        };
      });

      return NextResponse.json({ success: true, links });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
