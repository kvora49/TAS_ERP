/**
 * Integration Test for GST E-Invoicing & E-Way Bill (Phase 4 & Phase 5)
 * Verifies:
 * 1. Company Profile E-Invoice Applicability & Turnover Bracket configuration
 * 2. IRP Handshake & Authentication Verification
 * 3. Standalone Delivery Challan E-Way Bill Generation & DB Persistence
 */

// @ts-ignore
import { Client } from "pg";
import { getEInvoiceAdapter, deriveStateDetails } from "../src/lib/einvoice";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runPhase45Test() {
  console.log("=================================================");
  console.log("  TAS ERP E-INVOICING PHASE 4 & 5 INTEGRATION   ");
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
    // 1. Fetch business
    const bizRes = await client.query(`
      SELECT id, name, gstin, address, city, state, state_code, einvoice_applicability, aato_bracket, irp_onboarding_status
      FROM businesses 
      LIMIT 1
    `);

    if (bizRes.rows.length === 0) {
      console.error("No active business found for testing.");
      process.exit(1);
    }

    const business = bizRes.rows[0];
    console.log(`Testing with Business: "${business.name}" (ID: ${business.id})`);

    // 2. Test Phase 4: Configure E-Invoicing & AATO Bracket on Business
    await client.query(`
      UPDATE businesses 
      SET einvoice_applicability = 'mandatory',
          aato_bracket = '10cr_and_above',
          irp_client_id = 'test_gsp_api_user',
          gstin = '27AAACT2727Q1ZW',
          irp_onboarding_status = 'not_started'
      WHERE id = $1
    `, [business.id]);

    const updatedBizRes = await client.query(`
      SELECT einvoice_applicability, aato_bracket, irp_client_id, irp_onboarding_status
      FROM businesses WHERE id = $1
    `, [business.id]);

    const updatedBiz = updatedBizRes.rows[0];
    assert(
      updatedBiz.einvoice_applicability === "mandatory" &&
      updatedBiz.aato_bracket === "10cr_and_above" &&
      updatedBiz.irp_client_id === "test_gsp_api_user",
      "Company Profile successfully updated with E-Invoicing applicability and AATO bracket"
    );

    // 3. Test Phase 4: IRP Adapter Handshake & Verification (Layer 1 Platform + Layer 2 GSP User)
    const adapter = getEInvoiceAdapter();
    const authResult = await adapter.authenticate({
      gstin: "27AAACT2727Q1ZW",
      userName: "test_gsp_api_user",
    });

    assert(!!authResult.token && authResult.token.length > 20, "IRP Adapter handshake issued valid auth token");

    await client.query(`
      UPDATE businesses 
      SET irp_onboarding_status = 'authorized',
          irp_auth_token = $1,
          irp_token_expiry = $2
      WHERE id = $3
    `, [authResult.token, authResult.expiresAt, business.id]);

    const verifiedBizRes = await client.query(`
      SELECT irp_onboarding_status FROM businesses WHERE id = $1
    `, [business.id]);

    assert(
      verifiedBizRes.rows[0].irp_onboarding_status === "authorized",
      "IRP Connection Verified: tenant marked 'authorized' in database"
    );

    // 4. Test Phase 5: Create a Test Delivery Challan for Outward Goods Movement
    // First, find or create a godown
    let godownRes = await client.query(`SELECT id FROM godowns WHERE business_id = $1 LIMIT 1`, [business.id]);
    let godownId = godownRes.rows[0]?.id;
    if (!godownId) {
      const newGodown = await client.query(`
        INSERT INTO godowns (business_id, name, code, address) VALUES ($1, 'Main Warehouse', 'MWH', 'Bhiwandi') RETURNING id
      `, [business.id]);
      godownId = newGodown.rows[0].id;
    }

    // Party
    let partyRes = await client.query(`SELECT id FROM parties WHERE business_id = $1 LIMIT 1`, [business.id]);
    let partyId = partyRes.rows[0]?.id;
    if (!partyId) {
      const newParty = await client.query(`
        INSERT INTO parties (business_id, name, company_name, gstin, billing_address_line1, status, type)
        VALUES ($1, 'Challan Receiver', 'Retail Hub', '27AAPFU0939F1ZV', 'Goregaon West, Mumbai', 'active', 'customer')
        RETURNING id
      `, [business.id]);
      partyId = newParty.rows[0].id;
    }

    const testChallanNo = `CHL-TEST-${Date.now().toString().slice(-5)}`;
    const challanInsertRes = await client.query(`
      INSERT INTO challans (
        business_id, challan_number, challan_date, challan_type,
        from_godown_id, to_party_id, total_quantity, total_value,
        transporter, status
      ) VALUES (
        $1, $2, CURRENT_DATE, 'outward',
        $3, $4, 250, 75000,
        'Speed Express Cargo', 'pending'
      ) RETURNING id, challan_number, total_value
    `, [business.id, testChallanNo, godownId, partyId]);

    const testChallan = challanInsertRes.rows[0];
    console.log(`Created Outward Delivery Challan: ${testChallan.challan_number} (Value: ₹${testChallan.total_value})`);

    // 5. Test Phase 5: Generate Standalone Delivery Challan E-Way Bill
    const sellerGstin = business.gstin || "27AAACT2727Q1ZW";
    const ewbResult = await adapter.generateEWB(
      {
        docNo: testChallan.challan_number,
        docDate: new Date().toISOString().split("T")[0],
        docType: "CHL",
        subSupplyType: "8", // Job work / stock movement
        fromParty: {
          gstin: sellerGstin,
          legalName: business.name,
          addressLine1: business.address || "Warehouse 4A",
          location: "Mumbai",
          pinCode: "400013",
          stateCode: "27",
        },
        toParty: {
          gstin: "27AAPFU0939F1ZV",
          legalName: "Retail Hub",
          addressLine1: "Goregaon West",
          location: "Mumbai",
          pinCode: "400062",
          stateCode: "27",
        },
        itemList: [
          {
            itemSeqNo: 1,
            productDescription: "Cotton Kurti Assorted",
            isService: false,
            hsnCode: "620412",
            quantity: 250,
            unit: "PCS",
            unitPrice: 300,
            grossAmount: 75000,
            discountAmount: 0,
            preTaxValue: 75000,
            taxableValue: 75000,
            gstRate: 5,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            totalItemValue: 75000,
          },
        ],
        totalValue: 75000,
      },
      {
        transporterName: "Speed Express Cargo",
        vehicleNo: "MH04CD5678",
        transportMode: "1",
        distanceKm: 45,
      },
      { gstin: sellerGstin, clientId: "sandbox", clientSecret: "sandbox" }
    );

    assert(ewbResult.success, "Standalone Delivery Challan E-Way Bill generated via adapter");
    assert(!!ewbResult.ewbNo && ewbResult.ewbNo.length === 12, "E-Way Bill Number is valid 12-digit number");
    assert(!!ewbResult.ewbValidTill, "E-Way Bill validity timestamp returned");

    // 6. Persist E-Way Bill on Challan
    await client.query(`
      UPDATE challans 
      SET eway_bill_no = $1, ewb_date = $2, ewb_valid_till = $3, transporter = $4
      WHERE id = $5
    `, [ewbResult.ewbNo, ewbResult.ewbDate, ewbResult.ewbValidTill, "Speed Express Cargo", testChallan.id]);

    const checkChallanRes = await client.query(`
      SELECT eway_bill_no, ewb_date, ewb_valid_till FROM challans WHERE id = $1
    `, [testChallan.id]);

    const savedChallan = checkChallanRes.rows[0];
    assert(
      savedChallan.eway_bill_no === ewbResult.ewbNo && !!savedChallan.ewb_valid_till,
      "Challan record successfully persisted with E-Way Bill Number and validity in database"
    );

    // Clean up test challan
    await client.query(`DELETE FROM challans WHERE id = $1`, [testChallan.id]);
    console.log(`Cleaned up test challan ${testChallan.id}`);

    console.log("\n=================================================");
    console.log(`  PHASE 4 & 5 TEST RESULT: ${passed} / ${total} TESTS PASSED`);
    console.log("=================================================\n");

    await client.end();
    if (passed === total) process.exit(0);
    else process.exit(1);
  } catch (err) {
    console.error("Test Error:", err);
    await client.end();
    process.exit(1);
  }
}

runPhase45Test();
