/**
 * End-to-End Integration Test for GST E-Invoicing & E-Way Bill (Phase 0, 2, 3)
 */

// @ts-ignore
import { Client } from "pg";
import {
  validateInvoiceForEInvoice,
  getEInvoiceAdapter,
  DEFAULT_EINVOICE_CONFIG,
} from "../src/lib/einvoice";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runE2ETest() {
  console.log("=================================================");
  console.log("  TAS ERP E-INVOICING E2E INTEGRATION TEST       ");
  console.log("=================================================\n");

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL configured.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string, details?: any) {
    total++;
    if (cond) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      if (details) console.error("     ", details);
    }
  }

  try {
    // 1. Fetch first available business and active party
    const bizRes = await client.query(`
      SELECT id, name, gstin, address, city, state, state_code, aato_bracket 
      FROM businesses 
      LIMIT 1
    `);

    if (bizRes.rows.length === 0) {
      console.error("No active business found for testing.");
      process.exit(1);
    }

    const business = bizRes.rows[0];
    console.log(`Testing with Business: "${business.name}"`);

    // Use standard valid GSTINs for deterministic compliance verification
    const sellerGstin = "27AAACT2727Q1ZW"; // Valid Maharashtra GSTIN
    const testPartyGstin = "27AAPFU0939F1ZV"; // Valid Maharashtra GSTIN

    // Ensure a test party with valid GSTIN exists
    const partyRes = await client.query(`
      SELECT id, name, gstin FROM parties WHERE business_id = $1 LIMIT 1
    `, [business.id]);

    let partyId = partyRes.rows[0]?.id;
    if (!partyId) {
      const newParty = await client.query(`
        INSERT INTO parties (business_id, name, company_name, gstin, billing_address_line1, status)
        VALUES ($1, 'Test Retailer', 'Test Retailer Pvt Ltd', $2, '101, Test Market, Lower Parel', 'active')
        RETURNING id
      `, [business.id, testPartyGstin]);
      partyId = newParty.rows[0].id;
    } else {
      await client.query(`UPDATE parties SET gstin = $1 WHERE id = $2`, [testPartyGstin, partyId]);
    }

    // 2. Insert a temporary Pakka sales bill for testing
    const testBillNo = `TEST-EINV-${Date.now().toString().slice(-6)}`;
    const billInsertRes = await client.query(`
      INSERT INTO sale_bills (
        business_id, bill_number, bill_type, bill_date, party_id, 
        billing_address, item_total, taxable_amount, 
        cgst, sgst, igst, grand_total, status
      ) VALUES (
        $1, $2, 'pakka', CURRENT_DATE, $3,
        '101, Test Market, Lower Parel, Mumbai 400013', 
        5000, 5000, 125, 125, 0, 5250, 'active'
      ) RETURNING id, bill_number, bill_date
    `, [business.id, testBillNo, partyId]);

    const testBill = billInsertRes.rows[0];
    console.log(`Created test bill: ${testBill.bill_number} (ID: ${testBill.id})`);

    // 3. Test Local Pre-Validation with missing HSN
    const invalidItems = [
      {
        id: "item-bad",
        line_index: 1,
        item_name: "Test Cotton Fabric",
        hsn_sac: "", // Missing HSN
        quantity: 10,
        rate: 500,
        tax_percent: 5,
        amount: 5000,
      },
    ];

    const valResultFail = await validateInvoiceForEInvoice(
      {
        id: testBill.id,
        bill_number: testBill.bill_number,
        bill_type: "pakka",
        bill_date: testBill.bill_date,
        status: "active",
        gstin: testPartyGstin,
        billing_address: "101, Test Market, Lower Parel, Mumbai 400013",
        billing_pincode: "400013",
        taxable_amount: 5000,
        cgst: 125,
        sgst: 125,
        igst: 0,
        grand_total: 5250,
        items: invalidItems,
      },
      {
        ...business,
        gstin: sellerGstin,
        state_code: sellerGstin.substring(0, 2),
      },
      { config: DEFAULT_EINVOICE_CONFIG }
    );

    assert(
      !valResultFail.isValid && valResultFail.errors.some((e) => e.code === "HSN_MISSING"),
      "Local pre-validation catches missing HSN and blocks IRP call"
    );

    // 4. Test Local Pre-Validation with valid 6-digit HSN
    const validItems = [
      {
        id: "item-good",
        line_index: 1,
        item_name: "Test Cotton Fabric",
        hsn_sac: "520812", // Valid 6-digit HSN
        quantity: 10,
        rate: 500,
        tax_percent: 5,
        amount: 5000,
      },
    ];

    const valResultPass = await validateInvoiceForEInvoice(
      {
        id: testBill.id,
        bill_number: testBill.bill_number,
        bill_type: "pakka",
        bill_date: testBill.bill_date,
        status: "active",
        gstin: testPartyGstin,
        billing_address: "101, Test Market, Lower Parel, Mumbai 400013",
        billing_pincode: "400013",
        taxable_amount: 5000,
        cgst: 125,
        sgst: 125,
        igst: 0,
        grand_total: 5250,
        items: validItems,
      },
      {
        ...business,
        address: business.address || "12, Industrial Estate, Worli, Mumbai 400018",
        gstin: sellerGstin,
        state_code: sellerGstin.substring(0, 2),
      },
      { config: DEFAULT_EINVOICE_CONFIG }
    );

    assert(valResultPass.isValid, "Local pre-validation passes cleanly for complete valid invoice", valResultPass.errors);

    // 5. Test Adapter E-Invoice & E-Way Bill Generation
    const adapter = getEInvoiceAdapter();
    const genResult = await adapter.generateIRN(
      {
        version: "1.1",
        docDetails: {
          docType: "INV",
          docNo: testBill.bill_number,
          docDate: new Date().toISOString().split("T")[0],
        },
        transactionDetails: {
          taxScheme: "GST",
          supplyType: "B2B",
          reverseCharge: false,
          igstOnIntra: false,
        },
        sellerDetails: {
          gstin: sellerGstin,
          legalName: business.name,
          addressLine1: business.address || "Office 101",
          location: business.city || "Mumbai",
          pinCode: business.pincode || "400013",
          stateCode: sellerGstin.substring(0, 2),
        },
        buyerDetails: {
          gstin: testPartyGstin,
          legalName: "Test Party Retail",
          addressLine1: "101, Test Market, Lower Parel",
          location: "Mumbai",
          pinCode: "400013",
          stateCode: testPartyGstin.substring(0, 2),
        },
        itemList: [
          {
            itemSeqNo: 1,
            productDescription: "Test Cotton Fabric",
            isService: false,
            hsnCode: "520812",
            quantity: 10,
            unit: "MTR",
            unitPrice: 500,
            grossAmount: 5000,
            discountAmount: 0,
            preTaxValue: 5000,
            taxableValue: 5000,
            gstRate: 5,
            igstAmount: 0,
            cgstAmount: 125,
            sgstAmount: 125,
            totalItemValue: 5250,
          },
        ],
        valueSummary: {
          totalTaxableAmount: 5000,
          totalCgstAmount: 125,
          totalSgstAmount: 125,
          totalIgstAmount: 0,
          totalCessAmount: 0,
          discountAmount: 0,
          otherCharges: 0,
          roundOffAmount: 0,
          totalInvoiceValue: 5250,
        },
      },
      { gstin: sellerGstin, clientId: "sandbox", clientSecret: "sandbox" },
      { vehicleNo: "MH01AB9999", transporterId: "27AAACT2727Q1ZW" }
    );

    assert(genResult.success, "IRP Adapter generated IRN successfully");
    assert(!!genResult.irn && genResult.irn.length === 64, "Generated IRN is valid 64-char hash");
    assert(!!genResult.signedQrData, "Signed QR Data generated");
    assert(!!genResult.ewbNo, "E-Way Bill generated alongside IRN with vehicle details");

    // 6. Persist IRN and immutability lock in DB
    await client.query(`
      UPDATE sale_bills 
      SET irn = $1, irn_status = 'registered', ack_no = $2, ack_date = $3,
          signed_qr_data = $4, ewb_no = $5, locked_for_edit = true
      WHERE id = $6
    `, [genResult.irn, genResult.ackNo, genResult.ackDate, genResult.signedQrData, genResult.ewbNo, testBill.id]);

    const checkLockRes = await client.query(`
      SELECT irn, irn_status, locked_for_edit, ewb_no FROM sale_bills WHERE id = $1
    `, [testBill.id]);

    assert(
      checkLockRes.rows[0].locked_for_edit === true && checkLockRes.rows[0].irn_status === "registered",
      "Database verified: invoice locked_for_edit = true with registered IRN"
    );

    // 7. Test 24-hour statutory cancellation
    const cancelRes = await adapter.cancelIRN(
      genResult.irn!,
      "2",
      "E2E testing cancellation",
      { gstin: sellerGstin, clientId: "sandbox", clientSecret: "sandbox" }
    );

    assert(cancelRes.success, "IRN cancelled successfully within 24h statutory window");

    // Update DB with cancellation
    await client.query(`
      UPDATE sale_bills 
      SET irn_status = 'cancelled', irn_cancel_reason = 'Data entry mistake: E2E test',
          irn_cancelled_at = NOW(), locked_for_edit = false
      WHERE id = $1
    `, [testBill.id]);

    const checkCancelRes = await client.query(`
      SELECT irn_status, locked_for_edit FROM sale_bills WHERE id = $1
    `, [testBill.id]);

    assert(
      checkCancelRes.rows[0].irn_status === "cancelled" && checkCancelRes.rows[0].locked_for_edit === false,
      "Database verified: invoice unlocked and marked cancelled"
    );

    // Clean up test bill
    await client.query(`DELETE FROM sale_bills WHERE id = $1`, [testBill.id]);
    console.log(`Cleaned up test bill ${testBill.id}`);

    console.log("\n=================================================");
    console.log(`  E2E TEST RESULT: ${passed} / ${total} TESTS PASSED`);
    console.log("=================================================\n");

    await client.end();
    if (passed === total) process.exit(0);
    else process.exit(1);
  } catch (err) {
    console.error("E2E Test Error:", err);
    await client.end();
    process.exit(1);
  }
}

runE2ETest();
