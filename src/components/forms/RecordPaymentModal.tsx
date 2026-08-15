"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

const paymentSchema = z.object({
  payment_date: z.string().min(1, "Payment Date is required"),
  payment_mode: z.string().min(1, "Payment Mode is required"),
  reference_no: z.string().optional(),
  paid_amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  bank_account_id: z.string().optional(),
  upi_id: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface BankAccount {
  id: string;
  type: "bank" | "upi";
  name: string;
  bank_name?: string;
  account_number?: string;
  upi_id?: string;
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  purchase: {
    id: string;
    purchase_number: string;
    invoice_no: string;
    grand_total: number;
    paid_amount: number;
    supplier?: {
      name: string;
    };
  } | null;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  open,
  onClose,
  purchase,
  onSuccess,
}: RecordPaymentModalProps) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const outstanding = purchase
    ? Number(purchase.grand_total) - Number(purchase.paid_amount || 0)
    : 0;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      payment_date: "",
      payment_mode: "bank_transfer",
      reference_no: "",
      paid_amount: 0,
      bank_account_id: "",
      upi_id: "",
      remarks: "",
    },
  });

  const paymentMode = watch("payment_mode");

  useEffect(() => {
    if (purchase) {
      reset({
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: "bank_transfer",
        reference_no: "",
        paid_amount: Number(outstanding.toFixed(2)),
        bank_account_id: "",
        upi_id: "",
        remarks: "",
      });
    }
  }, [purchase, outstanding, reset]);

  useEffect(() => {
    if (open) {
      const fetchBanks = async () => {
        setLoadingBanks(true);
        try {
          const res = await fetch("/api/master-data/banks-upi");
          if (res.ok) {
            const data = await res.json();
            setBankAccounts(data.accounts || []);
          }
        } catch (err) {
          console.error("Failed to load bank accounts");
        } finally {
          setLoadingBanks(false);
        }
      };
      fetchBanks();
    }
  }, [open]);

  const bankOptions = bankAccounts.filter((b) => b.type === "bank");
  const upiOptions = bankAccounts.filter((b) => b.type === "upi");

  const onSubmit = async (values: PaymentFormValues) => {
    if (!purchase) return;

    if (values.paid_amount > outstanding) {
      toast.error(
        `Payment amount cannot exceed outstanding balance of ₹${outstanding.toFixed(2)}`
      );
      return;
    }

    const payload = {
      ...values,
      bank_account_id: ["bank_transfer", "neft", "rtgs", "cheque"].includes(
        values.payment_mode
      )
        ? values.bank_account_id || null
        : null,
      upi_id: values.payment_mode === "upi" ? values.upi_id || null : null,
    };

    try {
      const res = await fetch(
        `/api/raw-materials/purchases/${purchase.id}/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record payment");

      toast.success("Payment recorded successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  if (!purchase) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={`Record Payment — ${purchase.purchase_number}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
        {/* Summary Banner */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 flex flex-col gap-1 text-xs">
          <div className="flex justify-between text-[var(--text-muted)] font-semibold">
            <span>Supplier:</span>
            <span className="text-[var(--text-primary)] font-bold">
              {purchase.supplier?.name || "—"}
            </span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)] font-semibold">
            <span>Invoice No:</span>
            <span className="text-[var(--text-primary)] font-mono">
              {purchase.invoice_no || "—"}
            </span>
          </div>
          <div className="border-t border-[var(--border)] my-1.5" />
          <div className="flex justify-between font-semibold">
            <span className="text-[var(--text-muted)]">Invoice Total:</span>
            <span className="text-[var(--text-primary)]">
              ₹{Number(purchase.grand_total).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-[var(--text-muted)]">Paid Already:</span>
            <span className="text-green-500 font-bold">
              ₹{Number(purchase.paid_amount || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-sm bg-[var(--primary-light)] p-2 rounded mt-1">
            <span className="text-[var(--primary)]">Balance Due:</span>
            <span className="text-[var(--primary)]">₹{outstanding.toFixed(2)}</span>
          </div>
        </div>

        {/* Fields */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Payment Date *
          </label>
          <input
            type="date"
            {...register("payment_date")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          />
          {errors.payment_date && (
            <p className="text-[10px] text-red-500 mt-0.5">
              {errors.payment_date.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Payment Mode *
            </label>
            <select
              {...register("payment_mode")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Payment Amount *
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("paid_amount")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
            {errors.paid_amount && (
              <p className="text-[10px] text-red-500 mt-0.5">
                {errors.paid_amount.message}
              </p>
            )}
          </div>
        </div>

        {["bank_transfer", "neft", "rtgs", "cheque"].includes(paymentMode) && (
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Bank Account *
            </label>
            <select
              disabled={loadingBanks}
              {...register("bank_account_id")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="">Select Bank Account</option>
              {bankOptions.map((b) => {
                const cat = (b as any).account_category || "pakka";
                const catLabel = cat === "pakka" ? "🏷️ Pakka" : cat === "kacha" ? "📝 Kaccha" : "🔄 Both";
                return (
                  <option key={b.id} value={b.id}>
                    [{catLabel}] {b.bank_name || b.name} (
                    {b.account_number ? b.account_number.slice(-4) : "—"})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {paymentMode === "upi" && (
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              UPI Account *
            </label>
            <select
              disabled={loadingBanks}
              {...register("upi_id")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="">Select UPI Endpoint</option>
              {upiOptions.map((u) => {
                const cat = (u as any).account_category || "kacha";
                const catLabel = cat === "pakka" ? "🏷️ Pakka" : cat === "kacha" ? "📝 Kaccha" : "🔄 Both";
                return (
                  <option key={u.id} value={u.id}>
                    [{catLabel}] {u.name} ({u.upi_id || "—"})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Transaction Ref No.
          </label>
          <input
            type="text"
            placeholder="e.g. UTR / UPI Ref ID / Cheque No."
            {...register("reference_no")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Remarks
          </label>
          <input
            type="text"
            placeholder="Internal payment notes"
            {...register("remarks")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton
            type="submit"
            isLoading={isSubmitting}
            variant="primary"
            className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            Record Payment
          </AsyncButton>
        </div>
      </form>
    </Modal>
  );
}
