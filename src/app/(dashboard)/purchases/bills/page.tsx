"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Calendar, Landmark, Coins, Receipt, Pencil, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import { useQueryClient } from "@tanstack/react-query";
import { useERPQuery } from "@/hooks/useERPQuery";

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
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const queryKey = ["purchase-bills", statusFilter, startDate, endDate, search];

  const { data: billsData, isPending: loading, isError, error, refetch } = useERPQuery(
    queryKey,
    async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("payment_status", statusFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const res = await fetch(`/api/purchases/bills?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load purchase invoices");
      const data = await res.json();
      return data.bills || [];
    }
  );

  const { data: suppliersData } = useERPQuery(["parties-suppliers"], async () => {
    const res = await fetch("/api/parties?type=supplier");
    if (!res.ok) throw new Error("Failed to load suppliers");
    const data = await res.json();
    return data.parties || [];
  });

  const bills: PurchaseBill[] = billsData || [];
  const suppliers: Party[] = suppliersData || [];

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
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] });
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
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] });
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
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] });
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
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] });
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Finished Goods Purchase Bills</h1>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Track inward shipments, supplier invoices, outstanding dues, and cash outflows
          </p>
        </div>
        <AsyncButton
          onClick={() => router.push("/purchases/bills/new")}
          variant="primary"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Plus size={16} />
          <span>Add Purchase Bill</span>
        </AsyncButton>
      </div>

      <PageState
        isLoading={loading}
        isError={isError}
        error={error ? (error instanceof Error ? error.message : "Failed to load purchase invoices") : undefined}
        onRetry={refetch}
        isEmpty={bills.length === 0}
        emptyTitle="No Purchase Invoices Found"
        emptyMessage="No inward purchase invoices match your active date or status filters."
        emptyAction={
          <AsyncButton onClick={() => router.push("/purchases/bills/new")} variant="primary">
            + Add First Purchase Bill
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={8}
      >
        {/* Aesthetic Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg">
              <Receipt className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total Purchases</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">
                ₹{totalPurchaseVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-lg">
              <Coins className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total Paid Out</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">
                ₹{totalPaidVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
              <Landmark className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Outstanding Dues</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">
                ₹{totalDueVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 shadow-[var(--shadow-sm)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-[var(--text-faint)]" />
              <input
                type="text"
                placeholder="Search supplier, bill no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-44 h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Calendar className="h-4.5 w-4.5 text-[var(--text-muted)] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-36 h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
            <span className="text-[var(--text-muted)] font-semibold text-xs uppercase">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-36 h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] font-bold text-[var(--text-muted)] uppercase tracking-wider">
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
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-body)]">
                {bills.map((b) => {
                  const outstanding = b.grand_total - b.paid_amount;
                  return (
                    <tr key={b.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="p-4 font-semibold text-[var(--text-body)]">{b.invoice_date}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--primary)] font-mono">{b.bill_number}</span>
                          {b.invoice_no && (
                            <span className="text-[10px] text-[var(--text-faint)] font-mono">Invoice: {b.invoice_no}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--text-primary)]">{b.supplier?.name}</span>
                          {b.supplier?.company_name && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">{b.supplier.company_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold text-[var(--text-primary)]">
                        ₹{b.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-semibold text-green-500">
                        ₹{b.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-bold text-red-500">
                        ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            b.payment_status === "paid"
                              ? "bg-green-500/10 text-green-500"
                              : b.payment_status === "partially_paid"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-500"
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
                              className="w-8 h-8 border border-[var(--primary)]/30 hover:bg-[var(--primary-light)] text-[var(--primary)] rounded-lg flex items-center justify-center cursor-pointer transition-all"
                              title="Record Payment"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="w-8 h-8 border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] rounded-lg flex items-center justify-center cursor-pointer transition-all"
                            title="Edit Bill"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(b)}
                            className="w-8 h-8 border border-red-500/20 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center cursor-pointer transition-all"
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
        </div>
      </PageState>

      {/* Add Shared Modal */}
      <Modal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add Purchase Bill"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateBill} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Supplier *</label>
            <select
              value={supplierId}
              required
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Supplier Invoice No</label>
              <input
                type="text"
                placeholder="e.g. INV-1092"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Invoice Date *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Bill Grand Total (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                placeholder="0.00"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Initial Paid Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton type="submit" isLoading={saving} variant="primary" className="px-4 py-2 text-sm font-semibold">
              Save Bill
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Edit Shared Modal */}
      <Modal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Purchase Bill"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateBill} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Supplier</label>
            <input
              type="text"
              disabled
              value={selectedBill?.supplier?.name || ""}
              className="w-full h-10 px-3 bg-[var(--page-bg)] border border-[var(--input-border)] text-[var(--text-muted)] rounded-lg text-sm cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Supplier Invoice No</label>
              <input
                type="text"
                placeholder="e.g. INV-1092"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Invoice Date *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Bill Grand Total (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                placeholder="0.00"
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Paid Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton type="submit" isLoading={saving} variant="primary" className="px-4 py-2 text-sm font-semibold">
              Save Changes
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Record Payment Shared Modal */}
      <Modal
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        title="Record Supplier Payment"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-500 space-y-1 font-medium">
            <div className="flex justify-between">
              <span>Total Bill Value:</span>
              <span className="font-bold">₹{selectedBill?.grand_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Already Paid:</span>
              <span className="font-bold">₹{selectedBill?.paid_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-500/20 pt-1 mt-1 font-bold text-blue-500">
              <span>Outstanding Dues:</span>
              <span>₹{selectedBill ? (selectedBill.grand_total - selectedBill.paid_amount).toFixed(2) : "0.00"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Payment Amount Out (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton type="submit" isLoading={saving} variant="primary" className="px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700">
              Record Outflow
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Shared Modal */}
      <Modal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Purchase Bill"
        maxWidth="max-w-sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-[var(--text-muted)] leading-normal">
            Are you sure you want to delete purchase bill <span className="font-bold text-[var(--text-primary)]">{selectedBill?.bill_number}</span>? This action will remove it from supplier ledger aggregates and dashboard outstanding tallies.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)] mt-4">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton onClick={handleDeleteBill} isLoading={saving} variant="destructive" className="px-4 py-2 text-sm font-semibold">
              Delete Permanently
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
