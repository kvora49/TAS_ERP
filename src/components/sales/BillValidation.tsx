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
      isValid ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"
    }`}>
      {isValid ? (
        <>
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <span className="font-bold">Invoice ready for validation!</span>
            <p className="font-medium text-green-600/80 mt-0.5">All required inputs have been satisfied successfully.</p>
          </div>
        </>
      ) : (
        <>
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Please complete the following actions:</span>
            <ul className="list-disc pl-4 space-y-0.5 font-medium text-amber-600/80">
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
