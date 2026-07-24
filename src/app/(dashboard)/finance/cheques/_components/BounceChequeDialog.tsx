"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chequeNumber?: string;
  onBounce: (data: { bounce_reason: string; bounce_charges: number }) => void;
  saving: boolean;
}

export function BounceChequeDialog({ open, onOpenChange, chequeNumber, onBounce, saving }: Props) {
  const [bounceReason, setBounceReason] = useState("");
  const [bounceCharges, setBounceCharges] = useState<number | "">("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBounce({ bounce_reason: bounceReason, bounce_charges: Number(bounceCharges || 0) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Mark Cheque {chequeNumber && `#${chequeNumber}`} as Bounced</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label htmlFor="bounce-reason" className="block text-xs font-bold uppercase text-slate-500 mb-1">Bounce Reason</label>
            <textarea
              id="bounce-reason"
              value={bounceReason}
              onChange={(e) => setBounceReason(e.target.value)}
              rows={2}
              placeholder="e.g. Insufficient funds, Account closed..."
              className="w-full border border-slate-200 rounded-lg text-sm p-3 resize-none"
            />
          </div>
          <div>
            <label htmlFor="bounce-charges" className="block text-xs font-bold uppercase text-slate-500 mb-1">Bank Bounce Charges (₹)</label>
            <input
              id="bounce-charges"
              type="number"
              min="0"
              step="0.01"
              value={bounceCharges}
              onChange={(e) => setBounceCharges(parseFloat(e.target.value) || "")}
              className="w-full h-10 border border-slate-200 rounded-lg text-sm px-3"
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Bounce
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
