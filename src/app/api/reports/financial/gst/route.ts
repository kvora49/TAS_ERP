import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = today.toISOString().split("T")[0];

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  try {
    const [saleBillsRes, rmPurchasesRes, expensesRes] = await Promise.all([
      // Pakka sale bills only for output GST
      supabase
        .from("sale_bills")
        .select("id, bill_date, bill_number, grand_total, taxable_amount, cgst, sgst, igst, bill_type, party:parties(name, company_name, gstin)")
        .eq("business_id", businessId)
        .eq("status", "active")
        .eq("bill_type", "pakka")
        .is("deleted_at", null)
        .gte("bill_date", from)
        .lte("bill_date", to)
        .order("bill_date", { ascending: false }),

      // RM purchases — all GST types
      supabase
        .from("raw_material_purchases")
        .select("id, invoice_date, purchase_number, grand_total, total_taxable_value, total_gst_amount, gst_type, supplier:parties(name, company_name, gstin)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .neq("gst_type", "without_gst") // exclude kaccha
        .gte("invoice_date", from)
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false }),

      // Expenses with GST
      supabase
        .from("expenses")
        .select("id, expense_date, expense_number, amount, gst_amount, gst_percent, vendor_name, expense_type:expense_types(name)")
        .eq("business_id", businessId)
        .gt("gst_percent", 0)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false }),
    ]);

    const saleBills = saleBillsRes.data ?? [];
    const rmPurchases = rmPurchasesRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    // ── Output GST (from pakka sale bills) ────────────────────────────────────
    let outputCGST = 0, outputSGST = 0, outputIGST = 0, outputTaxable = 0;
    const outputRows = saleBills.map((bill) => {
      const taxable = Number(bill.taxable_amount || 0);
      const cgst = Number(bill.cgst || 0);
      const sgst = Number(bill.sgst || 0);
      const igst = Number(bill.igst || 0);
      outputTaxable += taxable;
      outputCGST += cgst;
      outputSGST += sgst;
      outputIGST += igst;
      const party = Array.isArray(bill.party) ? bill.party[0] : bill.party;
      return {
        id: bill.id,
        date: bill.bill_date,
        doc_number: bill.bill_number,
        party_name: party?.company_name || party?.name || "—",
        gstin: party?.gstin || "—",
        taxable_value: Math.round(taxable * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total_gst: Math.round((cgst + sgst + igst) * 100) / 100,
        total: Math.round(Number(bill.grand_total) * 100) / 100,
        type: "output",
      };
    });

    // ── Input GST (RM purchases — normal with_gst) ────────────────────────────
    let inputCGST = 0, inputSGST = 0, inputIGST = 0, inputTaxable = 0;
    let rcmCGST = 0, rcmSGST = 0, rcmIGST = 0, rcmTaxable = 0;
    const inputRows: any[] = [];
    const rcmRows: any[] = [];

    for (const p of rmPurchases) {
      const taxable = Number(p.total_taxable_value || 0);
      const totalGst = Number(p.total_gst_amount || 0);
      // Split CGST / SGST assuming intrastate (50/50) — IGST if inter-state
      // raw_material_purchases doesn't store cgst/sgst separately so compute from gst_type context
      // We use total_gst_amount; assume 50/50 split for intrastate, 100% IGST for inter-state
      // Without place_of_supply we default to intrastate (conservative)
      const cgst = Math.round((totalGst / 2) * 100) / 100;
      const sgst = Math.round((totalGst / 2) * 100) / 100;
      const igst = 0; // Will show in igst if purchase is inter-state (future enhancement)
      const supplier = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
      const row = {
        id: p.id,
        date: p.invoice_date,
        doc_number: p.purchase_number,
        party_name: supplier?.company_name || supplier?.name || "—",
        gstin: supplier?.gstin || "—",
        taxable_value: Math.round(taxable * 100) / 100,
        cgst,
        sgst,
        igst,
        total_gst: Math.round(totalGst * 100) / 100,
        total: Math.round(Number(p.grand_total) * 100) / 100,
        gst_type: p.gst_type,
      };

      if (p.gst_type === "reverse_charge") {
        rcmTaxable += taxable;
        rcmCGST += cgst;
        rcmSGST += sgst;
        rcmIGST += igst;
        rcmRows.push({ ...row, type: "rcm" });
      } else {
        // with_gst
        inputTaxable += taxable;
        inputCGST += cgst;
        inputSGST += sgst;
        inputIGST += igst;
        inputRows.push({ ...row, type: "input" });
      }
    }

    // ── Expense GST (ITC on expenses) ─────────────────────────────────────────
    let expInputCGST = 0, expInputSGST = 0, expInputTaxable = 0;
    const expInputRows = expenses.map((e) => {
      const taxable = Number(e.amount || 0);
      const gstAmt = Number(e.gst_amount || 0);
      const cgst = Math.round((gstAmt / 2) * 100) / 100;
      const sgst = Math.round((gstAmt / 2) * 100) / 100;
      expInputTaxable += taxable;
      expInputCGST += cgst;
      expInputSGST += sgst;
      const expType = Array.isArray(e.expense_type) ? e.expense_type[0] : e.expense_type;
      return {
        id: e.id,
        date: e.expense_date,
        doc_number: e.expense_number,
        party_name: e.vendor_name || "—",
        gstin: "—",
        expense_type: expType?.name || "Expense",
        taxable_value: Math.round(taxable * 100) / 100,
        cgst,
        sgst,
        igst: 0,
        total_gst: Math.round(gstAmt * 100) / 100,
        total: Math.round((taxable + gstAmt) * 100) / 100,
        type: "input_expense",
      };
    });

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalInputCGST = inputCGST + expInputCGST;
    const totalInputSGST = inputSGST + expInputSGST;
    const totalInputIGST = inputIGST;
    const totalInput = totalInputCGST + totalInputSGST + totalInputIGST;
    const totalOutput = outputCGST + outputSGST + outputIGST;
    const totalRcm = rcmCGST + rcmSGST + rcmIGST;

    const netITCCGST = outputCGST - totalInputCGST;
    const netITCSGST = outputSGST - totalInputSGST;
    const netITCIGST = outputIGST - totalInputIGST;
    const netGSTPayable = netITCCGST + netITCSGST + netITCIGST; // positive = payable, negative = refund

    return NextResponse.json({
      from,
      to,
      output_gst: {
        rows: outputRows,
        totals: {
          taxable_value: Math.round(outputTaxable * 100) / 100,
          cgst: Math.round(outputCGST * 100) / 100,
          sgst: Math.round(outputSGST * 100) / 100,
          igst: Math.round(outputIGST * 100) / 100,
          total: Math.round(totalOutput * 100) / 100,
        },
        note: "Output GST: Pakka sale bills only (Kaccha excluded)",
      },
      input_gst: {
        rows: inputRows,
        expense_rows: expInputRows,
        totals: {
          purchases_taxable: Math.round(inputTaxable * 100) / 100,
          expenses_taxable: Math.round(expInputTaxable * 100) / 100,
          cgst: Math.round(totalInputCGST * 100) / 100,
          sgst: Math.round(totalInputSGST * 100) / 100,
          igst: Math.round(totalInputIGST * 100) / 100,
          total: Math.round(totalInput * 100) / 100,
        },
        note: "ITC: RM purchases with GST + expense GST. Kaccha (without_gst) excluded.",
      },
      rcm: {
        rows: rcmRows,
        totals: {
          taxable_value: Math.round(rcmTaxable * 100) / 100,
          cgst: Math.round(rcmCGST * 100) / 100,
          sgst: Math.round(rcmSGST * 100) / 100,
          igst: Math.round(rcmIGST * 100) / 100,
          total: Math.round(totalRcm * 100) / 100,
        },
        note: "Reverse Charge Mechanism: GST paid by buyer. Not eligible for ITC offset.",
      },
      summary: {
        output_gst: {
          cgst: Math.round(outputCGST * 100) / 100,
          sgst: Math.round(outputSGST * 100) / 100,
          igst: Math.round(outputIGST * 100) / 100,
          total: Math.round(totalOutput * 100) / 100,
        },
        input_gst: {
          cgst: Math.round(totalInputCGST * 100) / 100,
          sgst: Math.round(totalInputSGST * 100) / 100,
          igst: Math.round(totalInputIGST * 100) / 100,
          total: Math.round(totalInput * 100) / 100,
        },
        rcm_gst: {
          cgst: Math.round(rcmCGST * 100) / 100,
          sgst: Math.round(rcmSGST * 100) / 100,
          igst: Math.round(rcmIGST * 100) / 100,
          total: Math.round(totalRcm * 100) / 100,
        },
        net_payable: {
          cgst: Math.round(netITCCGST * 100) / 100,
          sgst: Math.round(netITCSGST * 100) / 100,
          igst: Math.round(netITCIGST * 100) / 100,
          total: Math.round(netGSTPayable * 100) / 100,
          direction: netGSTPayable >= 0 ? "payable" : "refund",
        },
      },
    });
  } catch (err: any) {
    console.error("[reports/financial/gst]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
