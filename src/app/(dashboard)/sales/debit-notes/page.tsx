"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Calendar, Landmark, CreditCard, ClipboardList, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface DebitNote {
  id: string;
  dn_number: string;
  party_id: string;
  related_purchase_return_id: string | null;
  dn_date: string;
  amount: number;
  reason: string | null;
  created_at: string;
  party?: Party;
  purchase_return?: {
    return_number: string;
  };
}

export default function DebitNotesPage() {
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDN, setSelectedDN] = useState<DebitNote | null>(null);

  // Form states
  const [partyId, setPartyId] = useState("");
  const [dnDate, setDnDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const [notesRes, suppliersRes] = await Promise.all([
        fetch(`/api/sales/debit-notes?${params.toString()}`),
        fetch("/api/parties?type=supplier"),
      ]);

      if (!notesRes.ok || !suppliersRes.ok) {
        throw new Error("Failed to load debit notes list");
      }

      const notesData = await notesRes.json();
      const suppliersData = await suppliersRes.json();
      setDebitNotes(notesData.debitNotes || []);
      setSuppliers(suppliersData.parties || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching debit notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, search]);

  const totalValue = debitNotes.reduce((sum, dn) => sum + Number(dn.amount), 0);
  const count = debitNotes.length;

  const handleOpenAdd = () => {
    setPartyId("");
    setDnDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setReason("");
    setIsAddOpen(true);
  };

  const handleCreateDN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!dnDate) {
      toast.error("Please select date");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      toast.error("Please enter a valid debit amount");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sales/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: partyId,
          dn_date: dnDate,
          amount: Number(amount),
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create debit note");
      }

      toast.success("Debit note issued successfully!");
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (dn: DebitNote) => {
    setSelectedDN(dn);
    setIsDeleteOpen(true);
  };

  const handleDeleteDN = async () => {
    if (!selectedDN) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/debit-notes/${selectedDN.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete debit note");
      }

      toast.success("Debit note deleted successfully");
      setIsDeleteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Debit Notes Book</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Issue and manage supplier debit adjustments, purchase return offsets, and claim credits
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2">
          <Plus size={16} />
          <span>Manual Debit Note</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] text-[#6366F1] rounded-lg">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Debit Notes Issued</span>
            <span className="text-xl font-bold text-slate-800">{count} Active Notes</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Debit Value</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search note number, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Calendar className="h-4.5 w-4.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-36 h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
          <span className="text-slate-400 font-semibold text-xs uppercase">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-36 h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>
      </div>

      {/* Debit Notes Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2">
            <Loader2 className="h-7 w-7 text-[#6366F1] animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading debit notes...</span>
          </div>
        ) : debitNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <CreditCard className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">No debit notes found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
                  <th className="p-4">Date</th>
                  <th className="p-4">Debit Note No</th>
                  <th className="p-4">Supplier / Vendor</th>
                  <th className="p-4">Purchase Return</th>
                  <th className="p-4">Reason / Notes</th>
                  <th className="p-4 text-right">Amount (₹)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {debitNotes.map((dn) => (
                  <tr key={dn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">{dn.dn_date}</td>
                    <td className="p-4 font-bold text-[#6366F1] font-mono">{dn.dn_number}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{dn.party?.name}</span>
                        {dn.party?.company_name && (
                          <span className="text-[10px] text-slate-400 font-medium">{dn.party.company_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {dn.purchase_return ? (
                        <span className="font-bold text-[#DC2626] font-mono">{dn.purchase_return.return_number}</span>
                      ) : (
                        <span className="text-slate-400 italic">Manual Issue</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-medium max-w-xs truncate">{dn.reason || "—"}</td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      ₹{dn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right">
                      {!dn.related_purchase_return_id ? (
                        <button
                          onClick={() => handleOpenDelete(dn)}
                          className="w-8 h-8 border border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] rounded-lg flex items-center justify-center cursor-pointer transition-all self-end"
                          title="Delete Debit Note"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold italic">Return Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Issue Standalone Debit Note</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateDN} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier / Vendor *</label>
              <select
                value={partyId}
                required
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.company_name ? `(${s.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Debit Date *</label>
                <input
                  type="date"
                  required
                  value={dnDate}
                  onChange={(e) => setDnDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Debit Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes / Reason for Debit</label>
              <textarea
                placeholder="Describe why debit is being issued (e.g. rate correction, purchase return adjustment...)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-20 p-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Issue Debit Note</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Cancel Debit Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to delete manual debit note <span className="font-bold text-slate-700">{selectedDN?.dn_number}</span>? This will reduce the available debit offset with this supplier.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteDN} size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
              {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
