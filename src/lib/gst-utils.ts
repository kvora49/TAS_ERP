/**
 * GST Utilities — Place of Supply & CGST/SGST/IGST determination
 *
 * Indian GST Rule:
 *   - Intra-state (same state)       → CGST + SGST (50/50 split)
 *   - Inter-state (different state)  → IGST (full amount)
 *
 * Place of Supply for goods with movement = delivery/consignee state
 * Place of Supply for goods without movement = buyer's billing state
 *
 * State code = first 2 digits of GSTIN (e.g., 27AAACR5055K1Z5 → "27" → Maharashtra)
 */

/** All 37 Indian state/UT codes as per GSTIN */
export const GSTIN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

/**
 * Extract the 2-digit state code from a GSTIN.
 * Returns null if the GSTIN is invalid or too short.
 */
export function getStateCodeFromGSTIN(gstin?: string | null): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().substring(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Get the state name for a given state code.
 */
export function getStateName(stateCode: string): string {
  return GSTIN_STATES[stateCode] || "";
}

/** Common 2-letter Indian state abbreviations mapped to GST state codes */
export const STATE_CODE_ABBREVIATIONS: Record<string, string> = {
  JK: "01", HP: "02", PB: "03", CH: "04", UK: "05", UA: "05",
  HR: "06", DL: "07", RJ: "08", UP: "09", BR: "10", SK: "11",
  AR: "12", NL: "13", MN: "14", MZ: "15", TR: "16", ML: "17",
  AS: "18", WB: "19", JH: "20", OD: "21", OR: "21", CG: "22",
  CT: "22", MP: "23", GJ: "24", DD: "25", DN: "26", DH: "26",
  MH: "27", KA: "29", GA: "30", LD: "31", KL: "32", TN: "33",
  PY: "34", AN: "35", TS: "36", TG: "36", AP: "37", LA: "38",
};

/** Common industrial/commercial cities mapped to GST state codes */
export const MAJOR_CITY_STATES: Record<string, string> = {
  // Gujarat (24)
  surat: "24", ahmedabad: "24", vadodara: "24", rajkot: "24", bhavnagar: "24",
  jamnagar: "24", gandhinagar: "24", vapi: "24", ankleshwar: "24", navsari: "24",
  valsad: "24", morbi: "24", bharuch: "24", anand: "24", mehsana: "24",
  // Maharashtra (27)
  mumbai: "27", pune: "27", nagpur: "27", thane: "27", nashik: "27",
  aurangabad: "27", solapur: "27", kolhapur: "27", bhiwandi: "27", ichalkaranji: "27",
  // Rajasthan (08)
  jaipur: "08", jodhpur: "08", udaipur: "08", kota: "08", bikaner: "08",
  bhilwara: "08", ajmer: "08", pali: "08", balotra: "08", kishangarh: "08",
  // Delhi (07)
  delhi: "07", "new delhi": "07",
  // Karnataka (29)
  bengaluru: "29", bangalore: "29", mysore: "29", mysuru: "29", mangalore: "29", hubli: "29", belgaum: "29",
  // Tamil Nadu (33)
  chennai: "33", coimbatore: "33", madurai: "33", tirupur: "33", salem: "33", erode: "33",
  // West Bengal (19)
  kolkata: "19", calcutta: "19", howrah: "19", siliguri: "19",
  // Telangana (36)
  hyderabad: "36", secunderabad: "36", warangal: "36",
  // Andhra Pradesh (37)
  visakhapatnam: "37", vizag: "37", vijayawada: "37", guntur: "37", tirupati: "37",
  // Madhya Pradesh (23)
  indore: "23", bhopal: "23", gwalior: "23", jabalpur: "23", ujjain: "23",
  // Uttar Pradesh (09)
  kanpur: "09", lucknow: "09", agra: "09", varanasi: "09", meerut: "09", noida: "09", ghaziabad: "09",
  // Punjab (03)
  ludhiana: "03", amritsar: "03", jalandhar: "03", patiala: "03",
  // Haryana (06)
  gurgaon: "06", gurugram: "06", faridabad: "06", panipat: "06", ambala: "06", sonipat: "06",
};

/**
 * Resolve 2-digit GST state code from a state name, code, abbreviation, or alias.
 * Returns null if it cannot be resolved.
 */
export function getStateCodeFromName(stateNameOrCode?: string | null): string | null {
  if (!stateNameOrCode) return null;
  const trimmed = stateNameOrCode.trim();
  if (!trimmed) return null;

  // Direct 2-digit code check (e.g. "24", "27")
  if (/^\d{2}$/.test(trimmed) && GSTIN_STATES[trimmed]) {
    return trimmed;
  }

  // 2-letter state abbreviation (e.g. "GJ", "MH", "DL")
  const upper = trimmed.toUpperCase();
  if (STATE_CODE_ABBREVIATIONS[upper]) {
    return STATE_CODE_ABBREVIATIONS[upper];
  }

  // Clean string for normalized comparison
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedInput = clean(trimmed);

  // Exact normalized match against standard state names
  for (const [code, name] of Object.entries(GSTIN_STATES)) {
    if (clean(name) === normalizedInput) {
      return code;
    }
  }

  // Common aliases
  if (normalizedInput === "orissa") return "21";
  if (normalizedInput === "uttaranchal") return "05";
  if (normalizedInput === "pondicherry") return "34";
  if (normalizedInput.includes("dadra") || normalizedInput.includes("daman")) return "26";

  // Substring matching (e.g. "State: Maharashtra")
  for (const [code, name] of Object.entries(GSTIN_STATES)) {
    const normName = clean(name);
    if (normName.length >= 4 && (normalizedInput.includes(normName) || normName.includes(normalizedInput))) {
      return code;
    }
  }

  return null;
}

/**
 * Convenience helper: Extract the State or Union Territory name directly from a GSTIN.
 * Returns null if GSTIN is missing, too short, or has an invalid state code.
 */
export function getStateNameFromGSTIN(gstin?: string | null): string | null {
  const code = getStateCodeFromGSTIN(gstin);
  return code ? GSTIN_STATES[code] || null : null;
}

/**
 * Derive state details from available data sources, in priority order:
 *   1. Explicit state + valid code
 *   2. GSTIN prefix → state code lookup
 *   3. Explicit state name → code resolution
 *   4. Address string parsing (structured format, state name, or major city)
 *   5. Explicit code without name
 */
export function deriveStateDetails(
  address?: string | null,
  gstin?: string | null,
  explicitState?: string | null,
  explicitCode?: string | null
): { name: string; code: string } {
  // Priority 1: Explicit state and valid 2-digit code provided
  if (explicitState && explicitCode && /^\d{2}$/.test(explicitCode)) {
    return { name: explicitState, code: explicitCode };
  }

  // Priority 2: Extract from GSTIN
  const gstinCode = getStateCodeFromGSTIN(gstin);
  if (gstinCode && GSTIN_STATES[gstinCode]) {
    return {
      name: explicitState || GSTIN_STATES[gstinCode],
      code: explicitCode || gstinCode,
    };
  }

  // Priority 3: Resolve explicitState if code was missing
  if (explicitState) {
    const resolvedCode = getStateCodeFromName(explicitState);
    if (resolvedCode) {
      return {
        name: GSTIN_STATES[resolvedCode] || explicitState,
        code: explicitCode || resolvedCode,
      };
    }
  }

  // Priority 4: Parse from address string
  if (address) {
    // Try structured format: "State Name : Maharashtra, Code : 27"
    const match = address.match(/State\s*(?:Name)?\s*:?\s*([^,\n]+),?\s*Code\s*:?\s*(\d+)/i);
    if (match) {
      const parsedCode = match[2].trim().padStart(2, "0");
      return { name: match[1].trim(), code: parsedCode };
    }

    // Try matching known state names or variations in the address
    for (const [code, stateName] of Object.entries(GSTIN_STATES)) {
      if (new RegExp(`\\b${stateName.replace(/&/g, "(?:&|and)")}\\b`, "i").test(address)) {
        return { name: stateName, code };
      }
    }

    // Check simple case-insensitive substring
    for (const [code, stateName] of Object.entries(GSTIN_STATES)) {
      if (address.toLowerCase().includes(stateName.toLowerCase())) {
        return { name: stateName, code };
      }
    }

    // Fallback: Check major city names in address
    const lowerAddress = address.toLowerCase();
    for (const [city, code] of Object.entries(MAJOR_CITY_STATES)) {
      if (new RegExp(`\\b${city}\\b`, "i").test(lowerAddress)) {
        return { name: GSTIN_STATES[code] || "", code };
      }
    }
  }

  // Priority 5: Explicit code provided without name
  if (explicitCode && GSTIN_STATES[explicitCode]) {
    return { name: GSTIN_STATES[explicitCode], code: explicitCode };
  }

  return { name: explicitState || "", code: explicitCode || "" };
}

/**
 * Determine the 2-digit state code for a party.
 *
 * For registered party:
 *   - Extracts state code from GSTIN (e.g. "27" from "27ABCDE1234F1Z5").
 * For unregistered (URP) party:
 *   - Resolves state code based on billing state or billing address.
 */
export function getPartyStateCode(params: {
  partyGstin?: string | null;
  partyState?: string | null;
  billingState?: string | null;
  billingAddress?: string | null;
}): string | null {
  const { partyGstin, partyState, billingState, billingAddress } = params;

  // 1. If party has a valid GSTIN (and not URP)
  const gstinCode = getStateCodeFromGSTIN(partyGstin);
  if (gstinCode) return gstinCode;

  // 2. Explicit billing state or party state
  const explicitState = billingState || partyState;
  if (explicitState) {
    const code = getStateCodeFromName(explicitState);
    if (code) return code;
  }

  // 3. Derive from billing address string
  if (billingAddress) {
    const derived = deriveStateDetails(billingAddress, partyGstin, explicitState);
    if (derived.code && /^\d{2}$/.test(derived.code)) {
      return derived.code;
    }
  }

  return null;
}

/**
 * Determine the 2-digit state code for the consignee (ship-to).
 */
export function getConsigneeStateCode(params: {
  consigneeGstin?: string | null;
  consigneeStateCode?: string | null;
  consigneeState?: string | null;
  consigneeAddress?: string | null;
}): string | null {
  const { consigneeGstin, consigneeStateCode, consigneeState, consigneeAddress } = params;

  if (consigneeStateCode && /^\d{2}$/.test(consigneeStateCode)) {
    return consigneeStateCode;
  }
  const gstinCode = getStateCodeFromGSTIN(consigneeGstin);
  if (gstinCode) return gstinCode;

  if (consigneeState) {
    const code = getStateCodeFromName(consigneeState);
    if (code) return code;
  }

  if (consigneeAddress) {
    const derived = deriveStateDetails(consigneeAddress, consigneeGstin, consigneeState, consigneeStateCode);
    if (derived.code && /^\d{2}$/.test(derived.code)) {
      return derived.code;
    }
  }

  return null;
}

export interface PlaceOfSupplyParams {
  businessGstin?: string | null;
  businessState?: string | null;
  businessStateCode?: string | null;
  businessAddress?: string | null;
  partyGstin?: string | null;
  partyState?: string | null;
  billingState?: string | null;
  billingAddress?: string | null;
  consigneeGstin?: string | null;
  consigneeStateCode?: string | null;
  consigneeState?: string | null;
  consigneeAddress?: string | null;
  shipToSameAsBillTo?: boolean;
}

/**
 * Determine the Place of Supply state code.
 *
 * Rules:
 *   - If party is registered or located in another state: Place of supply is party state code.
 *   - For URP (unregistered) party: Place of supply is determined based on billing address / billing state.
 *   - If party is in same state, but goods shipped to a different consignee state: Place of supply is consignee state code.
 */
export function getPlaceOfSupplyCode(params: PlaceOfSupplyParams): string | null {
  const partyCode = getPartyStateCode({
    partyGstin: params.partyGstin,
    partyState: params.partyState,
    billingState: params.billingState,
    billingAddress: params.billingAddress,
  });

  // If ship-to is different from bill-to:
  if (params.shipToSameAsBillTo === false) {
    const consigneeCode = getConsigneeStateCode({
      consigneeGstin: params.consigneeGstin,
      consigneeStateCode: params.consigneeStateCode,
      consigneeState: params.consigneeState,
      consigneeAddress: params.consigneeAddress,
    });

    // If party could not be determined, fallback to consignee
    if (!partyCode) return consigneeCode;

    // Determine business state code if available
    let businessStateCode = params.businessStateCode || getStateCodeFromGSTIN(params.businessGstin);
    if (!businessStateCode && params.businessState) {
      businessStateCode = getStateCodeFromName(params.businessState);
    }
    if (!businessStateCode && params.businessAddress) {
      businessStateCode = deriveStateDetails(params.businessAddress).code || null;
    }

    // If business state is known:
    // If party is in same state (partyCode === businessStateCode), but goods are shipped out-of-state:
    // POS is consigneeCode!
    if (businessStateCode) {
      if (partyCode === businessStateCode && consigneeCode && consigneeCode !== businessStateCode) {
        return consigneeCode;
      }
      return partyCode;
    }

    return consigneeCode || partyCode;
  }

  return partyCode;
}

export interface InterstateTransactionParams extends PlaceOfSupplyParams {
  businessGstin?: string | null;
  businessState?: string | null;
  businessAddress?: string | null;
}

/**
 * Determine whether a transaction is inter-state (IGST vs CGST + SGST).
 *
 * Requirements:
 * 1. If a party we register is registered from another state (e.g. company GSTIN 24 and party GSTIN 27):
 *    Counts as IGST irrespective of shipping address (even if shipping address is in the same state).
 * 2. If a party is URP (unregistered):
 *    Tax (CGST+SGST vs IGST) is fetched based on the party's billing address / billing state.
 *    - Same state billing address -> CGST + SGST (Intra-state)
 *    - Different state billing address -> IGST (Inter-state)
 * 3. If party is in same state, but goods are shipped to a different state:
 *    Counts as IGST.
 */
export function isInterstateTransaction(params: InterstateTransactionParams): boolean {
  const {
    businessGstin,
    businessState,
    businessAddress,
    partyGstin,
    partyState,
    billingState,
    billingAddress,
    consigneeGstin,
    consigneeStateCode,
    consigneeState,
    consigneeAddress,
    shipToSameAsBillTo,
  } = params;

  // 1. Determine business state code
  let businessStateCode = getStateCodeFromGSTIN(businessGstin);
  if (!businessStateCode && businessState) {
    businessStateCode = getStateCodeFromName(businessState);
  }
  if (!businessStateCode && businessAddress) {
    businessStateCode = deriveStateDetails(businessAddress).code || null;
  }
  if (!businessStateCode) {
    return false; // Can't determine business state → default intra-state
  }

  // 2. Determine party state code (GSTIN prefix if registered, billing address/state if URP)
  const partyCode = getPartyStateCode({
    partyGstin,
    partyState,
    billingState,
    billingAddress,
  });

  // Rule 1 & Rule 2:
  // If party is registered or located in another state (partyCode !== businessStateCode),
  // it is ALWAYS IGST irrespective of shipping address (even if shipping address is in same state).
  if (partyCode && partyCode !== businessStateCode) {
    return true;
  }

  // Rule 3:
  // If party is in same state (or local), but goods are shipped to a different consignee state:
  if (shipToSameAsBillTo === false) {
    const consigneeCode = getConsigneeStateCode({
      consigneeGstin,
      consigneeStateCode,
      consigneeState,
      consigneeAddress,
    });
    if (consigneeCode && consigneeCode !== businessStateCode) {
      return true;
    }
  }

  return false;
}

/**
 * Split total GST amount into CGST/SGST or IGST based on interstate flag.
 *
 * @param totalGst   - The total GST amount to split
 * @param interstate - Whether the transaction is interstate
 * @returns Object with cgst, sgst, igst values
 */
export function splitGST(
  totalGst: number,
  interstate: boolean
): { cgst: number; sgst: number; igst: number } {
  if (interstate) {
    return { cgst: 0, sgst: 0, igst: totalGst };
  }
  return {
    cgst: totalGst / 2,
    sgst: totalGst / 2,
    igst: 0,
  };
}

/**
 * Standard Indian GSTIN Regex:
 * 2 digits State Code (01-38, 97) + 10 chars PAN + 1 entity digit + 'Z' + 1 checksum digit
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GSTINValidationResult {
  isValid: boolean;
  stateCode: string | null;
  stateName: string | null;
  errorMessage: string | null;
}

/**
 * Strict root-level GSTIN input validator:
 * 1. Checks length strictly (15 chars)
 * 2. Catches 10-digit PAN mistakes
 * 3. Validates Indian state code prefix (01-38, 97)
 * 4. Validates full GSTIN regex structure
 */
export function validateGSTINInput(gstin: string | null | undefined): GSTINValidationResult {
  if (!gstin) {
    return { isValid: true, stateCode: null, stateName: null, errorMessage: null };
  }

  const trimmed = gstin.trim().toUpperCase();
  if (trimmed === "" || trimmed === "URP") {
    return { isValid: true, stateCode: null, stateName: null, errorMessage: null };
  }

  if (trimmed.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(trimmed)) {
    return {
      isValid: false,
      stateCode: null,
      stateName: null,
      errorMessage: "You entered a 10-character PAN. GSTIN requires 15 characters (State Code + PAN + Entity + 'Z' + Checksum).",
    };
  }

  if (trimmed.length < 15) {
    return {
      isValid: false,
      stateCode: trimmed.length >= 2 ? trimmed.substring(0, 2) : null,
      stateName: trimmed.length >= 2 ? (GSTIN_STATES[trimmed.substring(0, 2)] || null) : null,
      errorMessage: `GSTIN must be exactly 15 characters (currently ${trimmed.length}/15).`,
    };
  }

  if (trimmed.length > 15) {
    return {
      isValid: false,
      stateCode: null,
      stateName: null,
      errorMessage: `GSTIN cannot exceed 15 characters (currently ${trimmed.length}/15).`,
    };
  }

  const stateCode = trimmed.substring(0, 2);
  const stateName = GSTIN_STATES[stateCode];
  if (!stateName) {
    return {
      isValid: false,
      stateCode,
      stateName: null,
      errorMessage: `Invalid State Code "${stateCode}". Must be a valid Indian State/UT code (01-38, 97).`,
    };
  }

  if (!GSTIN_REGEX.test(trimmed)) {
    return {
      isValid: false,
      stateCode,
      stateName,
      errorMessage: "Invalid GSTIN format. Expected: 2 digits State + 10 char PAN + 1 entity + 'Z' + 1 checksum digit.",
    };
  }

  return {
    isValid: true,
    stateCode,
    stateName,
    errorMessage: null,
  };
}
