"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BankAccount { id: string; bank_name: string; account_number: string; account_holder_name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chequeNumber?: string;
  bankAccounts: BankAccount[];
  onDeposit: (data: { received_account_id: string; deposited_date: string }) => void;
  saving: boolean;
}

export function DepositChequeDialog({ open, onOpenChange, chequeNumber, bankAccounts, onDeposit, saving }: Props) {
  const [receivedAccountId, setReceivedAccountId] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedAccountId) { toast.error("Please select a target bank account"); return; }
    onDeposit({ received_account_id: receivedAccountId, deposited_date: depositDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Deposit Cheque {chequeNumber && `#${chequeNumber}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label htmlFor="deposit-account" className="block text-xs font-bold uppercase text-slate-500 mb-1">Deposit to Bank Account *</label>
            <select
              id="deposit-account"
              value={receivedAccountId}
              onChange={(e) => setReceivedAccountId(e.target.value)}
              className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
            >
              <option value="">Select Bank Account</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="deposit-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">Deposit Date *</label>
            <input
              id="deposit-date"
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 h-9 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Deposit
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
