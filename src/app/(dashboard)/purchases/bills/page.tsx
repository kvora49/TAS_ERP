"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Calendar, Landmark, Coins, Receipt, ArrowLeftRight, Trash2, Pencil, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface PurchaseBill {
  id: string;
  bill_number: string;
  supplier_id: string;
  invoice_no: string | null;
  invoice_date: string;
  grand_total: number;
  paid_amount: number;
  payment_status: "unpaid" | "partially_paid" | "paid";
  status: string;
  created_at: string;
  supplier?: Party;
}

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected item states
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);

  // Form states
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [grandTotal, setGrandTotal] = useState<number | "">("");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  // Payment Recording form state
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");

  // Load purchase bills and suppliers
  const fetchData = async () => {
    setLoading(true);
    try {
      // Build filter query parameters
      const params = new URLSearchParams();
      if (statusFilter) params.append("payment_status", statusFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const [billsRes, suppliersRes] = await Promise.all([
        fetch(`/api/purchases/bills?${params.toString()}`),
        fetch("/api/parties?type=supplier"),
      ]);

      if (!billsRes.ok || !suppliersRes.ok) {
        throw new Error("Failed to load purchases data");
      }

      const billsData = await billsRes.json();
      const suppliersData = await suppliersRes.json();

      setBills(billsData.bills || []);
      setSuppliers(suppliersData.parties || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching purchase invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, startDate, endDate, search]);

  // Aggregate stats
  const totalPurchaseVal = bills.reduce((sum, b) => sum + Number(b.grand_total), 0);
  const totalPaidVal = bills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
  const totalDueVal = totalPurchaseVal - totalPaidVal;

  const handleOpenAdd = () => {
    setSupplierId("");
    setInvoiceNo("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setGrandTotal("");
    setPaidAmount("");
    setIsAddOpen(true);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!invoiceDate) {
      toast.error("Please select invoice date");
      return;
    }
    if (grandTotal === "" || Number(grandTotal) < 0) {
      toast.error("Please enter a valid grand total");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          grand_total: Number(grandTotal),
          paid_amount: Number(paidAmount || 0),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save purchase bill");
      }

      toast.success("Purchase bill recorded successfully!");
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (bill: PurchaseBill) => {
    setSelectedBill(bill);
    setSupplierId(bill.supplier_id);
    setInvoiceNo(bill.invoice_no || "");
    setInvoiceDate(bill.invoice_date);
    setGrandTotal(bill.grand_total);
    setPaidAmount(bill.paid_amount);
    setIsEditOpen(true);
  };

  const handleUpdateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/bills/${selectedBill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          grand_total: Number(grandTotal),
          paid_amount: Number(paidAmount || 0),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update purchase bill");
      }

      toast.success("Purchase bill updated successfully!");
      setIsEditOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPayment = (bill: PurchaseBill) => {
    setSelectedBill(bill);
    setPaymentAmount("");
    setIsPaymentOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (paymentAmount === "" || Number(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const pending = selectedBill.grand_total - selectedBill.paid_amount;
    if (Number(paymentAmount) > pending) {
      toast.error(`Payment amount cannot exceed outstanding dues of ₹${pending.toFixed(2)}`);
      return;
    }

    setSaving(true);
    try {
      const newPaid = Number(selectedBill.paid_amount) + Number(paymentAmount);
      const res = await fetch(`/api/purchases/bills/${selectedBill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid_amount: newPaid,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment");
      }

      toast.success("Payment recorded successfully!");
      setIsPaymentOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (bill: PurchaseBill) => {
    setSelectedBill(bill);
    setIsDeleteOpen(true);
  };

  const handleDeleteBill = async () => {
    if (!selectedBill) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/bills/${selectedBill.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete purchase bill");
      }

      toast.success("Purchase bill deleted successfully");
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
      {/* Top Header Section */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Finished Goods Purchase Bills</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Track inward shipments, supplier invoices, outstanding dues, and cash outflows
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2">
          <Plus size={16} />
          <span>Add Purchase Bill</span>
        </Button>
      </div>

      {/* Aesthetic Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] text-[#6366F1] rounded-lg">
            <Receipt className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Purchases</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalPurchaseVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
            <Coins className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Paid Out</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalPaidVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#FEE2E2] text-[#DC2626] rounded-lg">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Outstanding Dues</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalDueVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Filters Bar */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier, bill no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-44 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        {/* Date Filters */}
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

      {/* Invoices List Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2">
            <Loader2 className="h-7 w-7 text-[#6366F1] animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading purchase invoices...</span>
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <Receipt className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">No purchase bills found matching the filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
                  <th className="p-4">Invoice Date</th>
                  <th className="p-4">Bill Code / Invoice No</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4 text-right">Grand Total</th>
                  <th className="p-4 text-right">Paid Amount</th>
                  <th className="p-4 text-right">Balance Due</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {bills.map((b) => {
                  const outstanding = b.grand_total - b.paid_amount;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-700">{b.invoice_date}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#6366F1] font-mono">{b.bill_number}</span>
                          {b.invoice_no && (
                            <span className="text-[10px] text-slate-400 font-mono">Invoice: {b.invoice_no}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{b.supplier?.name}</span>
                          {b.supplier?.company_name && (
                            <span className="text-[10px] text-slate-400 font-medium">{b.supplier.company_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800">
                        ₹{b.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-600">
                        ₹{b.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-bold text-[#DC2626]">
                        ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            b.payment_status === "paid"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : b.payment_status === "partially_paid"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}
                        >
                          {b.payment_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {outstanding > 0 && (
                            <button
                              onClick={() => handleOpenPayment(b)}
                              className="w-8 h-8 border border-[#BFDBFE] hover:bg-[#EFF6FF] text-[#2563EB] rounded-lg flex items-center justify-center cursor-pointer transition-all"
                              title="Record Payment"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="w-8 h-8 border border-[#E5E7EB] hover:bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                            title="Edit Bill"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(b)}
                            className="w-8 h-8 border border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] rounded-lg flex items-center justify-center cursor-pointer transition-all"
                            title="Delete Bill"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Add Purchase Bill</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateBill} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier *</label>
              <select
                value={supplierId}
                required
                onChange={(e) => setSupplierId(e.target.value)}
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier Invoice No</label>
                <input
                  type="text"
                  placeholder="e.g. INV-1092"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill Grand Total (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="0.00"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Initial Paid Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Save Bill</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Edit Purchase Bill</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateBill} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier</label>
              <input
                type="text"
                disabled
                value={selectedBill?.supplier?.name || ""}
                className="w-full h-10 px-3 bg-slate-50 border border-[#D1D5DB] rounded-lg text-sm text-slate-500 cursor-not-allowed outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier Invoice No</label>
                <input
                  type="text"
                  placeholder="e.g. INV-1092"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill Grand Total (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="0.00"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Record Supplier Payment</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-xs text-[#1E40AF] space-y-1 font-medium">
              <div className="flex justify-between">
                <span>Total Bill Value:</span>
                <span className="font-bold">₹{selectedBill?.grand_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Paid:</span>
                <span className="font-bold">₹{selectedBill?.paid_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#BFDBFE] pt-1 mt-1 font-bold text-[#1D4ED8]">
                <span>Outstanding Dues:</span>
                <span>₹{selectedBill ? (selectedBill.grand_total - selectedBill.paid_amount).toFixed(2) : "0.00"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Amount Out (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#16A34A] hover:bg-[#15803D] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Record Outflow</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Delete Purchase Bill</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to delete purchase bill <span className="font-bold text-slate-700">{selectedBill?.bill_number}</span>? This action will remove it from supplier ledger aggregates and dashboard outstanding tallies.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteBill} size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
              {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
