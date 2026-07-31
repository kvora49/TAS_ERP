export type DeducteeType = "individual" | "company";

export interface TdsSectionDefinition {
  code: string;
  name: string;
  description: string;
  defaultRateIndividual: number; // percentage (e.g. 1 for 1%)
  defaultRateCompany: number; // percentage (e.g. 2 for 2%)
  noPanRate: number; // percentage when PAN is missing (e.g. 20%)
  applicableContext: "job_work" | "purchase" | "professional" | "rent" | "commission" | "general";
}

export const TDS_SECTIONS: Record<string, TdsSectionDefinition> = {
  "194C": {
    code: "194C",
    name: "194C - Contracts & Job Work",
    description: "Payments to contractors, sub-contractors, tailors, processors",
    defaultRateIndividual: 1,
    defaultRateCompany: 2,
    noPanRate: 20,
    applicableContext: "job_work",
  },
  "194J_PROF": {
    code: "194J_PROF",
    name: "194J - Professional Services",
    description: "Legal, Audit, Accounting, Consulting fees",
    defaultRateIndividual: 10,
    defaultRateCompany: 10,
    noPanRate: 20,
    applicableContext: "professional",
  },
  "194J_TECH": {
    code: "194J_TECH",
    name: "194J - Technical Services",
    description: "IT maintenance, Software development, Engineering fees",
    defaultRateIndividual: 2,
    defaultRateCompany: 2,
    noPanRate: 20,
    applicableContext: "professional",
  },
  "194H": {
    code: "194H",
    name: "194H - Commission & Brokerage",
    description: "Sales commission, agency fees, brokerage",
    defaultRateIndividual: 5,
    defaultRateCompany: 5,
    noPanRate: 20,
    applicableContext: "commission",
  },
  "194I_BUILDING": {
    code: "194I_BUILDING",
    name: "194I - Rent (Land & Building)",
    description: "Factory, Office, Godown & Warehouse rent",
    defaultRateIndividual: 10,
    defaultRateCompany: 10,
    noPanRate: 20,
    applicableContext: "rent",
  },
  "194I_PLANT": {
    code: "194I_PLANT",
    name: "194I - Rent (Plant & Machinery)",
    description: "Equipment, machinery, vehicle hire",
    defaultRateIndividual: 2,
    defaultRateCompany: 2,
    noPanRate: 20,
    applicableContext: "rent",
  },
  "194Q": {
    code: "194Q",
    name: "194Q - Purchase of Goods",
    description: "Purchase of goods exceeding threshold",
    defaultRateIndividual: 0.1,
    defaultRateCompany: 0.1,
    noPanRate: 5,
    applicableContext: "purchase",
  },
  NONE: {
    code: "NONE",
    name: "No TDS",
    description: "Exempt from TDS deduction",
    defaultRateIndividual: 0,
    defaultRateCompany: 0,
    noPanRate: 0,
    applicableContext: "general",
  },
};

export interface TdsCalculationResult {
  sectionCode: string;
  sectionName: string;
  ratePercentage: number;
  tdsAmount: number;
  netPayable: number;
  isHigherRateApplied: boolean;
}

/**
 * Computes TDS deduction amount based on amount, section, deductee type, and PAN status.
 */
export function calculateTDS(
  grossAmount: number,
  sectionCode: string = "194C",
  deducteeType: DeducteeType = "individual",
  hasPan: boolean = true,
  customRate?: number
): TdsCalculationResult {
  const section = TDS_SECTIONS[sectionCode] || TDS_SECTIONS["194C"];

  let rate = customRate !== undefined ? customRate : 0;

  let isHigherRateApplied = false;

  if (customRate === undefined) {
    if (!hasPan) {
      rate = section.noPanRate;
      isHigherRateApplied = true;
    } else {
      rate = deducteeType === "company" ? section.defaultRateCompany : section.defaultRateIndividual;
    }
  }

  const rawTds = (grossAmount * rate) / 100;
  const tdsAmount = Math.round(rawTds * 100) / 100;
  const netPayable = Math.max(0, Math.round((grossAmount - tdsAmount) * 100) / 100);

  return {
    sectionCode: section.code,
    sectionName: section.name,
    ratePercentage: rate,
    tdsAmount,
    netPayable,
    isHigherRateApplied,
  };
}

/**
 * Rounding helper function
 */
export function applyRoundOff(
  amount: number,
  method: "two_decimals" | "nearest_rupee" = "two_decimals"
): { roundedAmount: number; roundOffDifference: number } {
  if (method === "nearest_rupee") {
    const rounded = Math.round(amount);
    const diff = Math.round((rounded - amount) * 100) / 100;
    return { roundedAmount: rounded, roundOffDifference: diff };
  }

  const rounded = Math.round(amount * 100) / 100;
  return { roundedAmount: rounded, roundOffDifference: 0 };
}
