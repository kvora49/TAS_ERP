/**
 * Comprehensive Whole-Workflow Integration Test for GST E-Invoicing
 * Tests all real-world scenarios: Bill-to/Ship-to, discounts, charges, URP, cancelled IRN, HSN fallback, and IRP schema alignment.
 */

import {
  validateInvoiceForEInvoice,
  getEInvoiceAdapter,
  DEFAULT_EINVOICE_CONFIG,
  IRPInvoicePayload,
} from "../src/lib/einvoice";
import { getPlaceOfSupplyCode, isInterstateTransaction } from "../src/lib/gst-utils";
import { validateTaxBreakdown } from "../src/lib/einvoice/validation/tax-breakdown";

async function runComprehensiveTests() {
  console.log("=================================================================");
  console.log("  COMPREHENSIVE E-INVOICE WHOLE-WORKFLOW VERIFICATION SUITE       ");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string, details?: any) {
    total++;
    if (cond) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      if (details) console.error("     Details:", details);
    }
  }

  const business = {
    id: "biz-test",
    name: "TAS Apparel Mills Ltd",
    gstin: "24AAACT2727Q1Z2", // Gujarat (24) with valid checksum 2
    address: "Plot 101, GIDC Apparel Park, Sachin",
    city: "Surat",
    pincode: "394230",
    state: "Gujarat",
    state_code: "24",
    aato_bracket: "10cr_and_above" as const,
  };

  // ── SCENARIO 1: Bill-To Intra (Gujarat 24), Ship-To Inter (Maharashtra 27) ──
  console.log("--- 1. Bill-To Intra (Gujarat), Ship-To Inter (Maharashtra) ---");
  const pos1 = getPlaceOfSupplyCode({
    businessGstin: business.gstin,
    businessStateCode: business.state_code,
    partyGstin: "24AAPFU0939F1Z1", // Buyer registered in Gujarat
    consigneeGstin: "27AAPFU0939F1ZV", // Goods delivered to Maharashtra
    consigneeStateCode: "27",
    shipToSameAsBillTo: false,
  });

  assert(pos1 === "27", "Place of Supply correctly resolved to consignee state '27' for out-of-state delivery");

  const valRes1 = await validateInvoiceForEInvoice(
    {
      id: "inv-bt-st",
      bill_number: "INV-2026-001",
      bill_type: "pakka",
      bill_date: new Date().toISOString().split("T")[0],
      status: "active",
      gstin: "24AAPFU0939F1Z1",
      billing_address: "Shop 10, Ring Road, Surat 395002",
      billing_pincode: "395002",
      ship_to_same_as_bill_to: false,
      consignee_name: "Mumbai Depot",
      consignee_gstin: "27AAPFU0939F1ZV",
      consignee_state: "Maharashtra",
      consignee_state_code: "27",
      consignee_address: "Gala 4, Bhiwandi Complex, Thane 421302",
      consignee_pincode: "421302",
      taxable_amount: 10000,
      cgst: 0,
      sgst: 0,
      igst: 500, // Correct IGST for out of state delivery
      grand_total: 10500,
      items: [
        {
          id: "item-1",
          line_index: 1,
          item_name: "Cotton Kurtis",
          hsn_sac: "620412",
          quantity: 20,
          rate: 500,
          tax_percent: 5,
          amount: 10000,
        },
      ],
    },
    business,
    { config: DEFAULT_EINVOICE_CONFIG }
  );

  assert(valRes1.isValid, "Bill-to / Ship-to cross-state invoice passes validation cleanly with IGST", valRes1.errors);

  // ── SCENARIO 2: Invoice with Bill-Level Discount & Taxable Freight ──
  console.log("\n--- 2. Invoice with Bill Discount + Taxable Charges ---");
  // 2 items:
  // Item 1: 10 * 500 = 5000 (tax 5%)
  // Item 2: 10 * 500 = 5000 (tax 5%)
  // Gross Item Total: 10,000
  // Freight Charge: 1,000 (taxable at 5%)
  // Bill Discount: 2,000
  // Taxable Subtotal = 10,000 + 1,000 - 2,000 = 9,000
  // GST @ 5% = 450 (CGST 225, SGST 225)
  // Grand Total = 9,450
  const valRes2 = await validateInvoiceForEInvoice(
    {
      id: "inv-disc-chrg",
      bill_number: "INV-2026-002",
      bill_type: "pakka",
      bill_date: new Date().toISOString().split("T")[0],
      status: "active",
      gstin: "24AAPFU0939F1Z1",
      billing_address: "Shop 10, Ring Road, Surat 395002",
      billing_pincode: "395002",
      taxable_amount: 9000,
      cgst: 225,
      sgst: 225,
      igst: 0,
      grand_total: 9450,
      charges_total: 1000,
      discount_amount: 2000,
      items: [
        {
          id: "item-1",
          line_index: 1,
          item_name: "Item A",
          hsn_sac: "620412",
          quantity: 10,
          rate: 500,
          tax_percent: 5,
          amount: 5000,
        },
        {
          id: "item-2",
          line_index: 2,
          item_name: "Item B",
          hsn_sac: "620412",
          quantity: 10,
          rate: 500,
          tax_percent: 5,
          amount: 5000,
        },
      ],
    },
    business,
    { config: DEFAULT_EINVOICE_CONFIG }
  );

  assert(valRes2.isValid, "Invoice with bill-level discount and taxable freight passes without rounding or tax mismatch", valRes2.errors);

  // ── SCENARIO 3: HSN Fallback to Design/Material Master ──
  console.log("\n--- 3. HSN Fallback to Design / Material Type ---");
  const valRes3 = await validateInvoiceForEInvoice(
    {
      id: "inv-hsn-fallback",
      bill_number: "INV-2026-003",
      bill_type: "pakka",
      bill_date: new Date().toISOString().split("T")[0],
      status: "active",
      gstin: "24AAPFU0939F1Z1",
      billing_address: "Shop 10, Ring Road, Surat 395002",
      billing_pincode: "395002",
      taxable_amount: 5000,
      cgst: 125,
      sgst: 125,
      igst: 0,
      grand_total: 5250,
      items: [
        {
          id: "item-nohsn",
          line_index: 1,
          item_name: "Fancy Designer Suit",
          hsn_sac: null, // Null on line item!
          design: {
            id: "des-1",
            name: "Anarkali Suit",
            design_number: "DS-101",
            hsn_code: "620422", // Valid 6-digit HSN on design!
          },
          quantity: 10,
          rate: 500,
          tax_percent: 5,
          amount: 5000,
        },
      ],
    },
    business,
    { config: DEFAULT_EINVOICE_CONFIG }
  );

  assert(valRes3.isValid, "Item with null line hsn_sac resolves HSN from design master successfully", valRes3.errors);

  // ── SCENARIO 4: Unregistered Party (URP / B2C) Error Handling ──
  console.log("\n--- 4. Unregistered Customer (URP / B2C) ---");
  const valRes4 = await validateInvoiceForEInvoice(
    {
      id: "inv-urp",
      bill_number: "INV-2026-004",
      bill_type: "pakka",
      bill_date: new Date().toISOString().split("T")[0],
      status: "active",
      gstin: "URP", // Unregistered customer
      billing_address: "Walk-in Retail Buyer, Surat",
      billing_pincode: "395002",
      taxable_amount: 2000,
      cgst: 50,
      sgst: 50,
      igst: 0,
      grand_total: 2100,
      items: [
        {
          id: "item-1",
          line_index: 1,
          item_name: "Retail Shirt",
          hsn_sac: "620520",
          quantity: 2,
          rate: 1000,
          tax_percent: 5,
          amount: 2000,
        },
      ],
    },
    business,
    { config: DEFAULT_EINVOICE_CONFIG }
  );

  assert(
    !valRes4.isValid && valRes4.errors.some((e) => e.code === "B2C_NOT_ELIGIBLE_FOR_EINVOICE"),
    "URP / B2C customer is blocked with clear 'B2C_NOT_ELIGIBLE_FOR_EINVOICE' advisory"
  );

  // ── SCENARIO 5: Previously Cancelled IRN Prevention ──
  console.log("\n--- 5. Prevent Re-Generation on Cancelled IRN ---");
  const valRes5 = await validateInvoiceForEInvoice(
    {
      id: "inv-cancelled-irn",
      bill_number: "INV-2026-005",
      bill_type: "pakka",
      bill_date: new Date().toISOString().split("T")[0],
      status: "active",
      irn_status: "cancelled", // Already cancelled on IRP!
      gstin: "24AAPFU0939F1Z1",
      billing_address: "Shop 10, Ring Road, Surat 395002",
      billing_pincode: "395002",
      taxable_amount: 5000,
      cgst: 125,
      sgst: 125,
      igst: 0,
      grand_total: 5250,
      items: [
        {
          id: "item-1",
          line_index: 1,
          item_name: "Item",
          hsn_sac: "620412",
          quantity: 10,
          rate: 500,
          tax_percent: 5,
          amount: 5000,
        },
      ],
    },
    business,
    { config: DEFAULT_EINVOICE_CONFIG }
  );

  assert(
    !valRes5.isValid && valRes5.errors.some((e) => e.code === "INVOICE_IRN_ALREADY_CANCELLED"),
    "Previously cancelled IRN invoice is blocked from duplicate generation with INVOICE_IRN_ALREADY_CANCELLED"
  );

  // ── SCENARIO 6: IRP INV-01 Value Reconciliation Accuracy ──
  console.log("\n--- 6. Exact Line Item to ValDtls Reconciliation (NIC INV-01 Standard) ---");
  const adapter = getEInvoiceAdapter();

  const payload: IRPInvoicePayload = {
    version: "1.1",
    docDetails: {
      docType: "INV",
      docNo: "INV-2026-006",
      docDate: new Date().toISOString().split("T")[0],
    },
    transactionDetails: {
      taxScheme: "GST",
      supplyType: "B2B",
      reverseCharge: false,
      igstOnIntra: false,
    },
    sellerDetails: {
      gstin: business.gstin,
      legalName: business.name,
      addressLine1: business.address,
      location: business.city,
      pinCode: business.pincode,
      stateCode: business.state_code,
    },
    buyerDetails: {
      gstin: "27AAPFU0939F1ZV",
      legalName: "Maharashtra Wholesaler",
      addressLine1: "12, Kalbadevi Road, Mumbai",
      location: "Mumbai",
      pinCode: "400002",
      stateCode: "27",
      placeOfSupply: "27",
    },
    itemList: [
      {
        itemSeqNo: 1,
        productDescription: "Cotton Suiting",
        isService: false,
        hsnCode: "520812",
        quantity: 50,
        unit: "MTR",
        unitPrice: 200,
        grossAmount: 10000,
        discountAmount: 1000,
        preTaxValue: 9000,
        taxableValue: 9000,
        gstRate: 5,
        igstAmount: 450,
        cgstAmount: 0,
        sgstAmount: 0,
        totalItemValue: 9450,
      },
    ],
    valueSummary: {
      totalTaxableAmount: 9000,
      totalCgstAmount: 0,
      totalSgstAmount: 0,
      totalIgstAmount: 450,
      totalCessAmount: 0,
      discountAmount: 0,
      otherCharges: 0,
      roundOffAmount: 0,
      totalInvoiceValue: 9450,
    },
  };

  const genRes = await adapter.generateIRN(payload, {
    gstin: business.gstin,
    userName: "test_gsp_user",
  });

  assert(genRes.success && !!genRes.irn && genRes.irn.length === 64, "IRP Adapter generated valid 64-char IRN hash");
  assert(!!genRes.signedQrData, "IRP Adapter returned signed QR Data");
  assert(!!genRes.ackNo, "IRP Adapter returned Ack Number");

  console.log("\n=================================================================");
  console.log(`  COMPREHENSIVE TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log("=================================================================\n");
}

runComprehensiveTests().catch(console.error);
