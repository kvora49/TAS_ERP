"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  // Pre-fill amount when purchase changes
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

  // Fetch tenant bank accounts
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
      toast.error(`Payment amount cannot exceed outstanding balance of ₹${outstanding.toFixed(2)}`);
      return;
    }

    const payload = {
      ...values,
      bank_account_id: ["bank_transfer", "neft", "rtgs", "cheque"].includes(values.payment_mode) ? (values.bank_account_id || null) : null,
      upi_id: values.payment_mode === "upi" ? (values.upi_id || null) : null,
    };

    try {
      const res = await fetch(`/api/raw-materials/purchases/${purchase.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border border-[#E2E8F0]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#0F172A]">
            Record Payment — {purchase.purchase_number}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Summary Banner */}
          <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-[#64748B] font-semibold">
              <span>Supplier:</span>
              <span className="text-[#0F172A] font-bold">{purchase.supplier?.name || "—"}</span>
            </div>
            <div className="flex justify-between text-[#64748B] font-semibold">
              <span>Invoice No:</span>
              <span className="text-[#0F172A] font-mono">{purchase.invoice_no || "—"}</span>
            </div>
            <div className="border-t border-[#E2E8F0] my-1.5" />
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Invoice Total:</span>
              <span className="text-[#0F172A]">₹{Number(purchase.grand_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Paid Already:</span>
              <span className="text-green-600">₹{Number(purchase.paid_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm bg-indigo-50/50 p-1.5 rounded mt-1">
              <span className="text-[#4F46E5]">Balance Due:</span>
              <span className="text-[#4F46E5]">₹{outstanding.toFixed(2)}</span>
            </div>
          </div>

          {/* Fields */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Payment Date *</label>
            <input
              type="date"
              {...register("payment_date")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
            />
            {errors.payment_date && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.payment_date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Payment Mode *</label>
              <select
                {...register("payment_mode")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
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
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Payment Amount *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("paid_amount")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A]"
              />
              {errors.paid_amount && (
                <p className="text-[10px] text-red-500 mt-0.5">{errors.paid_amount.message}</p>
              )}
            </div>
          </div>

          {["bank_transfer", "neft", "rtgs", "cheque"].includes(paymentMode) && (
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Bank Account *</label>
              <select
                disabled={loadingBanks}
                {...register("bank_account_id")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
              >
                <option value="">Select Bank Account</option>
                {bankOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name || b.name} ({b.account_number ? b.account_number.slice(-4) : "—"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentMode === "upi" && (
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">UPI Account *</label>
              <select
                disabled={loadingBanks}
                {...register("upi_id")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
              >
                <option value="">Select UPI Endpoint</option>
                {upiOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.upi_id || "—"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Transaction Ref No.</label>
            <input
              type="text"
              placeholder="e.g. UTR / UPI Ref ID / Cheque No."
              {...register("reference_no")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Remarks</label>
            <input
              type="text"
              placeholder="Internal payment notes"
              {...register("remarks")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
            />
          </div>

          <DialogFooter className="mt-4 pt-2 border-t border-[#E2E8F0] gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Record Payment
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
