"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Calendar, RefreshCw, Layers, CheckCircle2, DollarSign, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface Design {
  id: string;
  name: string;
  design_number: string;
  design_colours: { id: string; colour_name: string }[];
  size_set?: { name: string; sizes: string[] };
}

interface Godown {
  id: string;
  name: string;
}

interface SalesReturn {
  id: string;
  return_number: string;
  party_id: string;
  original_bill_id: string | null;
  return_date: string;
  return_reason: string | null;
  grand_total: number;
  credit_note_id: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  party?: Party;
  credit_note?: {
    cn_number: string;
  };
}

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);

  // Form states
  const [partyId, setPartyId] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnReason, setReturnReason] = useState("");
  const [grandTotal, setGrandTotal] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  // Stock reversal form states (optional)
  const [enableStockReversal, setEnableStockReversal] = useState(false);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedColourId, setSelectedColourId] = useState("");
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});

  const activeDesign = designs.find((d) => d.id === selectedDesignId);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const [returnsRes, customersRes, designsRes, godownsRes] = await Promise.all([
        fetch(`/api/sales/returns?${params.toString()}`),
        fetch("/api/parties?type=customer"),
        fetch("/api/master-data/designs"),
        fetch("/api/master-data/godowns"),
      ]);

      if (!returnsRes.ok || !customersRes.ok || !designsRes.ok || !godownsRes.ok) {
        throw new Error("Failed to load return page dependencies");
      }

      setReturns((await returnsRes.json()).returns || []);
      setCustomers((await customersRes.json()).parties || []);
      setDesigns((await designsRes.json()).designs || []);
      setGodowns((await godownsRes.json()).godowns || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching sales returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, search]);

  const totalReturnVal = returns.reduce((sum, r) => sum + Number(r.grand_total), 0);
  const count = returns.length;

  const handleOpenAdd = () => {
    setPartyId("");
    setReturnDate(new Date().toISOString().split("T")[0]);
    setReturnReason("");
    setGrandTotal("");
    setEnableStockReversal(false);
    setSelectedDesignId("");
    setSelectedColourId("");
    setSelectedGodownId("");
    setSizeQuantities({});
    setIsAddOpen(true);
  };

  const handleSizeQtyChange = (size: string, val: string) => {
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: val === "" ? 0 : Number(val),
    }));
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please select a customer");
      return;
    }
    if (!returnDate) {
      toast.error("Please select return date");
      return;
    }
    if (grandTotal === "" || Number(grandTotal) <= 0) {
      toast.error("Please enter a valid return value");
      return;
    }

    let totalQty = 0;
    if (enableStockReversal) {
      if (!selectedDesignId || !selectedColourId || !selectedGodownId) {
        toast.error("Please fill all stock reversal fields");
        return;
      }
      totalQty = Object.values(sizeQuantities).reduce((sum, q) => sum + q, 0);
      if (totalQty <= 0) {
        toast.error("Please enter at least one size quantity to return to stock");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        party_id: partyId,
        return_date: returnDate,
        return_reason: returnReason,
        grand_total: Number(grandTotal),
        design_id: enableStockReversal ? selectedDesignId : null,
        colour_id: enableStockReversal ? selectedColourId : null,
        godown_id: enableStockReversal ? selectedGodownId : null,
        size_quantities: enableStockReversal ? sizeQuantities : null,
        total_quantity: totalQty,
      };

      const res = await fetch("/api/sales/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit sales return");
      }

      toast.success("Sales Return processed. Credit Note generated & Stock added back!");
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (r: SalesReturn) => {
    setSelectedReturn(r);
    setIsDeleteOpen(true);
  };

  const handleDeleteReturn = async () => {
    if (!selectedReturn) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/returns/${selectedReturn.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete return");
      }

      toast.success("Sales return deleted successfully");
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sales Returns & Credit Notes</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Process incoming customer product returns, add back stock, and issue credit notes
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center gap-2">
          <Plus size={16} />
          <span>Record Sales Return</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE2E2] text-[#DC2626] rounded-lg">
            <RefreshCw className="h-6 w-6 animate-spin-slow" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Returns Processed</span>
            <span className="text-xl font-bold text-slate-800">{count} Returns</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Value of Issued Credit Notes</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalReturnVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
            placeholder="Search return no, customer..."
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

      {/* Returns Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2">
            <Loader2 className="h-7 w-7 text-[#6366F1] animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading returns...</span>
          </div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <RefreshCw className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">No sales returns registered yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
                  <th className="p-4">Return Date</th>
                  <th className="p-4">Return Number</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4 text-right">Value (₹)</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Credit Note</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">{r.return_date}</td>
                    <td className="p-4 font-bold text-[#DC2626] font-mono">{r.return_number}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{r.party?.name}</span>
                        {r.party?.company_name && (
                          <span className="text-[10px] text-slate-400 font-medium">{r.party.company_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">{r.return_reason || "—"}</td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      ₹{r.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-0.5 bg-[#DCFCE7] text-[#15803D] rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Approved
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-[#6366F1] font-mono">
                      {r.credit_note?.cn_number || "—"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenDelete(r)}
                        className="w-8 h-8 border border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] rounded-lg flex items-center justify-center cursor-pointer transition-all self-end"
                        title="Delete Return"
                      >
                        <Trash2 size={14} />
                      </button>
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
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Record Customer Sales Return</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateReturn} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer *</label>
              <select
                value={partyId}
                required
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Return Date *</label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Credit Value (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reason for Return</label>
              <input
                type="text"
                placeholder="e.g. Size misplacement or Fabric Damage"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            {/* Optional Stock Reversal Toggle */}
            <div className="border border-dashed border-[#E5E7EB] rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 cursor-pointer select-none" htmlFor="enableStockReversal">
                  Reverse Stock (Add back to Godown inventory)
                </label>
                <input
                  type="checkbox"
                  id="enableStockReversal"
                  checked={enableStockReversal}
                  onChange={(e) => setEnableStockReversal(e.target.checked)}
                  className="h-4.5 w-4.5 text-[#6366F1] border-gray-300 rounded cursor-pointer"
                />
              </div>

              {enableStockReversal && (
                <div className="space-y-3 pt-2 border-t border-[#E5E7EB] animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Select Godown *</label>
                      <select
                        value={selectedGodownId}
                        onChange={(e) => setSelectedGodownId(e.target.value)}
                        className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="">Choose Godown</option>
                        {godowns.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Select Design *</label>
                      <select
                        value={selectedDesignId}
                        onChange={(e) => {
                          setSelectedDesignId(e.target.value);
                          setSelectedColourId("");
                          setSizeQuantities({});
                        }}
                        className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs outline-none cursor-pointer"
                      >
                        <option value="">Choose Design</option>
                        {designs.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.design_number})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedDesignId && (
                    <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] font-bold uppercase text-slate-500">Select Color *</label>
                        <select
                          value={selectedColourId}
                          onChange={(e) => setSelectedColourId(e.target.value)}
                          className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="">Choose Color</option>
                          {activeDesign?.design_colours.map((c) => (
                            <option key={c.id} value={c.id}>{c.colour_name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedColourId && activeDesign?.size_set && (
                        <div className="col-span-2 space-y-2 pt-1 animate-fadeIn">
                          <label className="text-[9px] font-bold uppercase text-slate-500 block">Size Return Quantities</label>
                          <div className="flex flex-wrap gap-2.5">
                            {activeDesign.size_set.sizes.map((size) => (
                              <div key={size} className="flex flex-col gap-1 w-14">
                                <span className="text-[10px] font-bold text-slate-600 text-center uppercase">{size}</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  value={sizeQuantities[size] || ""}
                                  onChange={(e) => handleSizeQtyChange(size, e.target.value)}
                                  className="w-full h-8 text-center border border-[#D1D5DB] rounded text-xs outline-none focus:ring-1 focus:ring-[#6366F1]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Submit Return</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Delete Sales Return</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to delete return <span className="font-bold text-slate-700">{selectedReturn?.return_number}</span>? This will also remove the linked credit note <span className="font-bold text-[#6366F1]">{selectedReturn?.credit_note?.cn_number}</span>.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteReturn} size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
              {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
