/**
 * Verification test script for TAS ERP GST E-Invoicing & Local Validation Engine
 * Tests Phase 0 & Phase 2 functionality thoroughly.
 */

import {
  validateInvoiceForEInvoice,
  validateGSTIN,
  calculateGSTINChecksum,
  DEFAULT_EINVOICE_CONFIG,
  MockEInvoiceAdapter,
  getFriendlyIRPErrorMessage,
} from "../src/lib/einvoice";

async function runTestSuite() {
  console.log("=================================================");
  console.log("  TAS ERP GST E-INVOICING VALIDATION TEST SUITE  ");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, failureDetails?: any) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (failureDetails) console.error("     Details:", failureDetails);
    }
  }

  // ── TEST 1: Mod-36 GSTIN Checksum Algorithm ──────────────────────
  console.log("--- 1. Testing GSTIN Validation & Checksum ---");
  // Known valid GSTINs
  const validGstin1 = "27AAPFU0939F1ZV"; // Checksum V
  const validGstin2 = "27AAACT2727Q1ZW"; // Checksum W (TCS)
  const validGstin3 = "29AAACI4740D1ZT"; // Checksum T (Infosys)
  const invalidGstinChecksum = "27AAPFU0939F1Z9"; // Checksum mismatch
  const invalidGstinLength = "27AAPFU0939F1Z";
  const invalidGstinFormat = "27AAPFU0939F1Z$";

  assert(calculateGSTINChecksum("27AAPFU0939F1Z") === "V", "Mod-36 Checksum for 27AAPFU0939F1Z is 'V'");
  assert(calculateGSTINChecksum("27AAACT2727Q1Z") === "W", "Mod-36 Checksum for 27AAACT2727Q1Z is 'W'");
  assert(calculateGSTINChecksum("29AAACI4740D1Z") === "T", "Mod-36 Checksum for 29AAACI4740D1Z is 'T'");

  const errsValid1 = validateGSTIN(validGstin1, "Seller");
  assert(errsValid1.length === 0, "Valid GSTIN 27AAPFU0939F1ZV produces 0 errors");

  const errsChecksum = validateGSTIN(invalidGstinChecksum, "Seller");
  assert(
    errsChecksum.some((e) => e.code === "GSTIN_CHECKSUM_FAILED"),
    "Invalid checksum digit triggers GSTIN_CHECKSUM_FAILED"
  );

  const errsLength = validateGSTIN(invalidGstinLength, "Seller");
  assert(
    errsLength.some((e) => e.code === "GSTIN_INVALID_LENGTH"),
    "Short GSTIN triggers GSTIN_INVALID_LENGTH"
  );

  const errsFormat = validateGSTIN(invalidGstinFormat, "Seller");
  assert(
    errsFormat.some((e) => e.code === "GSTIN_INVALID_FORMAT"),
    "Special characters trigger GSTIN_INVALID_FORMAT"
  );

  // ── TEST 2: Valid Complete Pakka Invoice ─────────────────────────
  console.log("\n--- 2. Testing Valid Complete Invoice Pre-Validation ---");
  const validBusiness = {
    id: "biz-101",
    name: "TAS Textiles Pvt Ltd",
    gstin: "27AAACT2727Q1ZW",
    address: "Unit 401, Textile Tower, Lower Parel",
    city: "Mumbai",
    pincode: "400013",
    state: "Maharashtra",
    state_code: "27",
    aato_bracket: "below_5cr" as const,
  };

  const validInvoice = {
    id: "inv-201",
    bill_number: "INV-2026-001",
    bill_type: "pakka" as const,
    bill_date: new Date().toISOString().split("T")[0],
    status: "active",
    gstin: "27AAPFU0939F1ZV", // Intra-state (both 27)
    billing_address: "Shop 12, Fashion Street, Fort, Mumbai - 400001",
    billing_pincode: "400001",
    taxable_amount: 10000,
    cgst: 250,
    sgst: 250,
    igst: 0,
    grand_total: 10500,
    charges_total: 0,
    discount_amount: 0,
    items: [
      {
        id: "item-1",
        line_index: 1,
        item_name: "Cotton Shirt Fabric",
        hsn_sac: "5208", // 4 digits valid for below 5cr
        quantity: 100,
        rate: 100,
        tax_percent: 5,
        amount: 10000,
      },
    ],
  };

  const resultValid = await validateInvoiceForEInvoice(validInvoice, validBusiness, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(resultValid.isValid, "Valid intra-state invoice passes pre-validation with isValid=true", resultValid.errors);
  assert(resultValid.errors.length === 0, "Valid invoice produces exactly 0 errors");

  // ── TEST 3: HSN Digit Requirement across AATO Brackets ───────────
  console.log("\n--- 3. Testing HSN Digit Requirement (4 vs 6 digits) ---");
  const businessAbove5Cr = {
    ...validBusiness,
    aato_bracket: "5cr_to_10cr" as const,
  };

  const invoice4DigitHsn = {
    ...validInvoice,
    items: [
      {
        id: "item-1",
        line_index: 1,
        item_name: "Silk Garment",
        hsn_sac: "6204", // 4 digits - invalid for > 5Cr
        quantity: 50,
        rate: 200,
        tax_percent: 5,
        amount: 10000,
      },
    ],
  };

  const resultHsnFail = await validateInvoiceForEInvoice(invoice4DigitHsn, businessAbove5Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(
    resultHsnFail.warnings.some((w) => w.code === "HSN_DIGITS_INSUFFICIENT") && resultHsnFail.errors.length === 0,
    "Turnover > ₹5 Cr flags 4-digit HSN as advisory warning HSN_DIGITS_INSUFFICIENT (ignorable)"
  );

  const invoice6DigitHsn = {
    ...invoice4DigitHsn,
    items: [
      {
        ...invoice4DigitHsn.items[0],
        hsn_sac: "620412", // 6 digits - valid
      },
    ],
  };
  const resultHsnPass = await validateInvoiceForEInvoice(invoice6DigitHsn, businessAbove5Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(resultHsnPass.isValid, "6-digit HSN passes for > ₹5 Cr turnover business");

  // ── TEST 4: 30-Day Reporting Window Rule for >= ₹10 Cr Turnover ───
  console.log("\n--- 4. Testing 30-Day Reporting Window for >= ₹10 Cr Turnover ---");
  const businessAbove10Cr = {
    ...validBusiness,
    aato_bracket: "10cr_and_above" as const,
  };

  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
  const oldDateStr = oldDate.toISOString().split("T")[0];

  const oldInvoice = {
    ...invoice6DigitHsn,
    bill_date: oldDateStr,
  };

  const resultOldInvoice10Cr = await validateInvoiceForEInvoice(oldInvoice, businessAbove10Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(
    resultOldInvoice10Cr.warnings.some((w) => w.code === "INVOICE_DATE_EXCEEDS_30_DAYS"),
    "Invoice older than 30 days is flagged as advisory warning for >= ₹10 Cr turnover business"
  );

  const resultOldInvoiceBelow10Cr = await validateInvoiceForEInvoice(oldInvoice, validBusiness, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(
    !resultOldInvoiceBelow10Cr.warnings.some((w) => w.code === "INVOICE_DATE_EXCEEDS_30_DAYS") &&
    !resultOldInvoiceBelow10Cr.errors.some((e) => e.code === "INVOICE_DATE_EXCEEDS_30_DAYS"),
    "30-day reporting restriction is NOT applied to businesses below ₹10 Cr"
  );

  // ── TEST 5: Tax Split (Intra-state vs Inter-state) ────────────────
  console.log("\n--- 5. Testing Intra-State vs Inter-State Tax Alignment ---");
  // Inter-state buyer: 29 (Karnataka) vs Seller: 27 (Maharashtra)
  const interstateInvoice = {
    ...invoice6DigitHsn,
    gstin: "29AAACI4740D1ZT", // Karnataka
    billing_address: "Electronic City, Bengaluru, Karnataka - 560100",
    billing_pincode: "560100",
    cgst: 250, // WRONG! Inter-state must have IGST, not CGST/SGST
    sgst: 250,
    igst: 0,
  };

  const resultTaxSplitFail = await validateInvoiceForEInvoice(interstateInvoice, businessAbove5Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(
    resultTaxSplitFail.errors.some((e) => e.code === "INVALID_TAX_SPLIT_INTERSTATE"),
    "Inter-state transaction with CGST/SGST flags INVALID_TAX_SPLIT_INTERSTATE"
  );

  const correctedInterstateInvoice = {
    ...interstateInvoice,
    cgst: 0,
    sgst: 0,
    igst: 500,
  };
  const resultTaxSplitPass = await validateInvoiceForEInvoice(correctedInterstateInvoice, businessAbove5Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(resultTaxSplitPass.isValid, "Corrected inter-state invoice with IGST passes validation");

  // ── TEST 6: Rounding Discrepancy Tolerance ────────────────────────
  console.log("\n--- 6. Testing Rounding Discrepancy Tolerance ---");
  const roundedDiscrepancyInvoice = {
    ...correctedInterstateInvoice,
    grand_total: 10550, // Should be 10500, difference of ₹50 exceeds tolerance of ₹1.00
  };

  const resultRoundingFail = await validateInvoiceForEInvoice(roundedDiscrepancyInvoice, businessAbove5Cr, {
    config: DEFAULT_EINVOICE_CONFIG,
  });
  assert(
    resultRoundingFail.errors.some((e) => e.code === "ROUNDING_TOLERANCE_EXCEEDED"),
    "Discrepancy of ₹50 between items and grand total flags ROUNDING_TOLERANCE_EXCEEDED"
  );

  // ── TEST 7: Mock E-Invoice Adapter Execution ──────────────────────
  console.log("\n--- 7. Testing Mock E-Invoice Adapter Execution ---");
  const adapter = new MockEInvoiceAdapter();
  const auth = await adapter.authenticate({
    gstin: validBusiness.gstin,
    clientId: "iris_client_test_123",
    clientSecret: "iris_secret_test_456",
    userName: "test_gsp_user",
    password: "TestPass@123",
  });
  assert(!!auth.token && auth.token.length > 20, "Adapter authenticate returns valid session token");

  const irnResult = await adapter.generateIRN(
    {
      version: "1.1",
      docDetails: {
        docType: "INV",
        docNo: correctedInterstateInvoice.bill_number,
        docDate: correctedInterstateInvoice.bill_date,
      },
      transactionDetails: {
        taxScheme: "GST",
        supplyType: "B2B",
        reverseCharge: false,
        igstOnIntra: false,
      },
      sellerDetails: {
        gstin: validBusiness.gstin,
        legalName: validBusiness.name,
        addressLine1: validBusiness.address,
        location: validBusiness.city,
        pinCode: validBusiness.pincode,
        stateCode: validBusiness.state_code,
      },
      buyerDetails: {
        gstin: correctedInterstateInvoice.gstin,
        legalName: "Infosys Limited",
        addressLine1: correctedInterstateInvoice.billing_address,
        location: "Bengaluru",
        pinCode: correctedInterstateInvoice.billing_pincode,
        stateCode: "29",
      },
      itemList: [
        {
          itemSeqNo: 1,
          productDescription: "Silk Garment",
          isService: false,
          hsnCode: "620412",
          quantity: 50,
          unit: "PCS",
          unitPrice: 200,
          grossAmount: 10000,
          discountAmount: 0,
          preTaxValue: 10000,
          taxableValue: 10000,
          gstRate: 5,
          igstAmount: 500,
          cgstAmount: 0,
          sgstAmount: 0,
          totalItemValue: 10500,
        },
      ],
      valueSummary: {
        totalTaxableAmount: 10000,
        totalCgstAmount: 0,
        totalSgstAmount: 0,
        totalIgstAmount: 500,
        totalCessAmount: 0,
        discountAmount: 0,
        otherCharges: 0,
        roundOffAmount: 0,
        totalInvoiceValue: 10500,
      },
    },
    { gstin: validBusiness.gstin, clientId: "test", clientSecret: "test" },
    { vehicleNo: "MH02AB1234", transporterId: "27AAACT2727Q1ZW", transportMode: "1" }
  );

  assert(irnResult.success, "Adapter generateIRN succeeded with IRN and QR code");
  assert(irnResult.irn?.length === 64, "Generated IRN is exactly 64-character SHA-256 hash");
  assert(!!irnResult.ackNo, "Generated Ack No is present");
  assert(!!irnResult.signedQrData, "Signed QR Data is present");
  assert(!!irnResult.ewbNo, "E-Way Bill was generated simultaneously when transport details were provided");

  const cancelResult = await adapter.cancelIRN(irnResult.irn!, "1", "Duplicate entry test", {
    gstin: validBusiness.gstin,
    clientId: "test",
    clientSecret: "test",
  });
  assert(cancelResult.success, "Adapter cancelIRN cancelled IRN successfully within 24 hours");

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("=================================================\n");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
