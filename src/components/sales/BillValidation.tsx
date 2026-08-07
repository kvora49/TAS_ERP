import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface BillValidationProps {
  state: any;
}

export function BillValidation({ state }: BillValidationProps) {
  const issues = [];
  if (!state.partyId) {
    issues.push("Select a customer / party");
  }
  if (!state.billDate) {
    issues.push("Set the invoice date");
  }
  if (state.items.length === 0) {
    issues.push("Add at least one line item to the list");
  }

  const isValid = issues.length === 0;

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 select-none text-xs font-semibold ${
      isValid
        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
    }`}>
      {isValid ? (
        <>
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">Invoice ready for validation!</span>
            <p className="font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">All required inputs have been satisfied successfully.</p>
          </div>
        </>
      ) : (
        <>
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Please complete the following actions:</span>
            <ul className="list-disc pl-4 space-y-0.5 font-medium text-amber-700 dark:text-amber-300">
              {issues.map((iss, idx) => (
                <li key={idx}>{iss}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
