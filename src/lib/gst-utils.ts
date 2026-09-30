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
 *   1. Explicit state + code (already resolved)
 *   2. GSTIN prefix → state code lookup
 *   3. Address string parsing
 */
export function deriveStateDetails(
  address?: string | null,
  gstin?: string | null,
  explicitState?: string | null,
  explicitCode?: string | null
): { name: string; code: string } {
  // Priority 1: Explicit state and code provided
  if (explicitState && explicitCode) {
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

  // Priority 3: Parse from address string
  if (address) {
    // Try structured format: "State Name : Maharashtra, Code : 27"
    const match = address.match(/State\s*(?:Name)?\s*:?\s*([^,\n]+),?\s*Code\s*:?\s*(\d+)/i);
    if (match) return { name: match[1].trim(), code: match[2].trim() };

    // Try matching known state names in the address
    for (const [code, stateName] of Object.entries(GSTIN_STATES)) {
      if (address.toLowerCase().includes(stateName.toLowerCase())) {
        return { name: stateName, code };
      }
    }
  }

  return { name: explicitState || "", code: explicitCode || "" };
}

/**
 * Determine the Place of Supply state code.
 *
 * For goods with movement (delivery to consignee):
 *   - If consignee state is available → use consignee state
 *   - Otherwise fall back to billing party state
 *
 * @param partyGstin       - The billing party's GSTIN
 * @param consigneeGstin   - The consignee/ship-to GSTIN (if different from bill-to)
 * @param consigneeStateCode - Explicit consignee state code (if available)
 * @param shipToSameAsBillTo - Whether the delivery address is same as billing
 * @returns The state code representing Place of Supply, or null if undetermined
 */
export function getPlaceOfSupplyCode(params: {
  partyGstin?: string | null;
  consigneeGstin?: string | null;
  consigneeStateCode?: string | null;
  shipToSameAsBillTo?: boolean;
}): string | null {
  const { partyGstin, consigneeGstin, consigneeStateCode, shipToSameAsBillTo } = params;

  // If ship-to is different from bill-to, use consignee state
  if (shipToSameAsBillTo === false) {
    // Priority: explicit consignee state code > consignee GSTIN prefix
    if (consigneeStateCode && /^\d{2}$/.test(consigneeStateCode)) {
      return consigneeStateCode;
    }
    const consigneeCode = getStateCodeFromGSTIN(consigneeGstin);
    if (consigneeCode) return consigneeCode;
    // If no consignee state info available, fall back to party
  }

  // Default: use billing party's state
  return getStateCodeFromGSTIN(partyGstin);
}

/**
 * Determine whether a transaction is inter-state.
 *
 * Compares the business's state code with the Place of Supply.
 * If either is missing, defaults to intra-state (conservative).
 */
export function isInterstateTransaction(params: {
  businessGstin?: string | null;
  partyGstin?: string | null;
  consigneeGstin?: string | null;
  consigneeStateCode?: string | null;
  shipToSameAsBillTo?: boolean;
}): boolean {
  const { businessGstin, ...placeOfSupplyParams } = params;

  const businessStateCode = getStateCodeFromGSTIN(businessGstin);
  if (!businessStateCode) return false; // Can't determine → default intra-state

  const posCode = getPlaceOfSupplyCode(placeOfSupplyParams);
  if (!posCode) return false; // Can't determine → default intra-state

  return businessStateCode !== posCode;
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
