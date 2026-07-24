"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Party { id: string; name: string; company_name: string | null; type: string[]; }
interface BankAccount { id: string; bank_name: string; account_number: string; account_holder_name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection: "received" | "issued";
  parties: Party[];
  bankAccounts: BankAccount[];
  onSave: (data: any) => void;
  saving: boolean;
}

export function NewChequeDialog({ open, onOpenChange, defaultDirection, parties, bankAccounts, onSave, saving }: Props) {
  const [chequeNumber, setChequeNumber] = useState("");
  const [direction, setDirection] = useState<"received" | "issued">(defaultDirection);
  const [partyId, setPartyId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [receivedAccountId, setReceivedAccountId] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chequeNumber) { toast.error("Please enter a cheque number"); return; }
    if (!bankName) { toast.error("Please enter bank name"); return; }
    if (!chequeDate) { toast.error("Please enter cheque date"); return; }
    if (amount === "" || Number(amount) <= 0) { toast.error("Please enter a valid amount"); return; }

    onSave({
      cheque_number: chequeNumber, direction,
      party_id: partyId || null, bank_name: bankName,
      account_no: accountNo, cheque_date: chequeDate,
      due_date: dueDate || null, amount: Number(amount),
      received_account_id: receivedAccountId || null, remarks,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Record Cheque Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cheque-direction" className="block text-xs font-bold uppercase text-slate-500 mb-1">Direction</label>
              <select
                id="cheque-direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "received" | "issued")}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              >
                <option value="received">Received (from customer)</option>
                <option value="issued">Issued (to supplier)</option>
              </select>
            </div>
            <div>
              <label htmlFor="cheque-number" className="block text-xs font-bold uppercase text-slate-500 mb-1">Cheque No. *</label>
              <input
                id="cheque-number"
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
                placeholder="e.g. 123456"
              />
            </div>
            <div>
              <label htmlFor="cheque-party" className="block text-xs font-bold uppercase text-slate-500 mb-1">Party</label>
              <select
                id="cheque-party"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              >
                <option value="">Select Party (optional)</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.company_name || p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cheque-bank" className="block text-xs font-bold uppercase text-slate-500 mb-1">Bank Name *</label>
              <input
                id="cheque-bank"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <div>
              <label htmlFor="cheque-account" className="block text-xs font-bold uppercase text-slate-500 mb-1">Account No.</label>
              <input
                id="cheque-account"
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
                placeholder="Bank account number"
              />
            </div>
            <div>
              <label htmlFor="cheque-amount" className="block text-xs font-bold uppercase text-slate-500 mb-1">Amount (₹) *</label>
              <input
                id="cheque-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              />
            </div>
            <div>
              <label htmlFor="cheque-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">Cheque Date *</label>
              <input
                id="cheque-date"
                type="date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              />
            </div>
            <div>
              <label htmlFor="cheque-due-date" className="block text-xs font-bold uppercase text-slate-500 mb-1">Due / Maturity Date</label>
              <input
                id="cheque-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              />
            </div>
            {direction === "received" && (
              <div className="col-span-2">
                <label htmlFor="cheque-bank-account" className="block text-xs font-bold uppercase text-slate-500 mb-1">Deposit to Bank Account</label>
                <select
                  id="cheque-bank-account"
                  value={receivedAccountId}
                  onChange={(e) => setReceivedAccountId(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
                >
                  <option value="">Select Bank Account (optional)</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label htmlFor="cheque-remarks" className="block text-xs font-bold uppercase text-slate-500 mb-1">Remarks</label>
              <textarea
                id="cheque-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg text-sm p-3 resize-none"
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 h-9 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Cheque
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
