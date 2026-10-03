"use client";

import React, { useState } from "react";
import { Zap, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EInvoiceExceptionModal } from "./EInvoiceExceptionModal";
import { EInvoiceValidationError } from "@/lib/einvoice";

interface GenerateEInvoiceButtonProps {
  billId: string;
  billType: "pakka" | "kacha";
  irnStatus?: string | null;
  onSuccess: () => void;
}

export function GenerateEInvoiceButton({
  billId,
  billType,
  irnStatus,
  onSuccess,
}: GenerateEInvoiceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<EInvoiceValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<EInvoiceValidationError[]>([]);

  // Only applicable to Pakka bills and bills not already registered or cancelled
  if (billType !== "pakka" || irnStatus === "registered" || irnStatus === "cancelled") {
    return null;
  }

  const executeGenerate = async () => {
    setGenerating(true);
    try {
      toast.info("Submitting to IRP...");
      const genRes = await fetch(`/api/sales/bills/${billId}/einvoice/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoreWarnings: true }),
      });

      const genData = await genRes.json();

      if (!genRes.ok) {
        if (genData.validationErrors) {
          setValidationErrors(genData.validationErrors);
          setExceptionModalOpen(true);
          return;
        }
        throw new Error(genData.error || "IRP submission failed.");
      }

      setExceptionModalOpen(false);
      toast.success(
        genData.ewbNo
          ? "IRN & E-Way Bill generated successfully!"
          : "GST E-Invoice (IRN) generated successfully!"
      );
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = async () => {
    setLoading(true);

    try {
      // Step 1: Run Local Pre-Validation (no government network call)
      const valRes = await fetch(`/api/sales/bills/${billId}/einvoice/validate`, {
        method: "POST",
      });

      const valData = await valRes.json();
      if (!valRes.ok) {
        throw new Error(valData.error || "Failed to run local pre-validation.");
      }

      const { validation } = valData;

      if (!validation.isValid) {
        // Validation failed: has hard blocking errors
        setValidationErrors(validation.errors || []);
        setValidationWarnings(validation.warnings || []);
        setExceptionModalOpen(true);
        setLoading(false);
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        // Only warnings exist! Give user option to review or ignore & proceed
        setValidationErrors([]);
        setValidationWarnings(validation.warnings);
        setExceptionModalOpen(true);
        setLoading(false);
        return;
      }

      // Step 2: Clean validation (0 errors, 0 warnings)! Proceed to IRP generation
      await executeGenerate();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={loading || generating}
        onClick={handleGenerateClick}
        className="
          h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold text-white
          bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700
          transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50
        "
        title="Pre-validate and generate GST E-Invoice (IRN)"
      >
        {loading || generating ? (
          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
        <span>{loading ? "Verifying..." : generating ? "Generating..." : "Generate E-Invoice"}</span>
      </button>

      {/* Exception & Warning Modal */}
      <EInvoiceExceptionModal
        open={exceptionModalOpen}
        onOpenChange={setExceptionModalOpen}
        errors={validationErrors}
        warnings={validationWarnings}
        invoiceId={billId}
        onIgnoreAndGenerate={executeGenerate}
        generating={generating}
      />
    </>
  );
}
