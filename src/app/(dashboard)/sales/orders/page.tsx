"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Calendar, FileText, ShoppingCart, ShoppingBag, CheckCircle2, XCircle, ChevronRight, Pencil, Trash2, Loader2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface SaleOrder {
  id: string;
  order_number: string;
  party_id: string;
  order_date: string;
  expected_delivery: string | null;
  status: "pending" | "in_process" | "ready" | "dispatched" | "cancelled";
  total_amount: number;
  converted_bill_id: string | null;
  notes: string | null;
  created_at: string;
  party?: Party;
  bill?: {
    bill_number: string;
  };
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected Order
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);

  // Form states
  const [partyId, setPartyId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [status, setStatus] = useState<SaleOrder["status"]>("pending");
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch orders & customers
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const [ordersRes, customersRes] = await Promise.all([
        fetch(`/api/sales/orders?${params.toString()}`),
        fetch("/api/parties?type=customer"),
      ]);

      if (!ordersRes.ok || !customersRes.ok) {
        throw new Error("Failed to load orders data");
      }

      const ordersData = await ordersRes.json();
      const customersData = await customersRes.json();

      setOrders(ordersData.orders || []);
      setCustomers(customersData.parties || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, startDate, endDate, search]);

  // Stats
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "in_process");
  const totalPendingVal = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const dispatchedCount = orders.filter((o) => o.status === "dispatched" || o.converted_bill_id).length;

  const handleOpenAdd = () => {
    setPartyId("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setExpectedDelivery("");
    setTotalAmount("");
    setNotes("");
    setIsAddOpen(true);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please select a customer");
      return;
    }
    if (!orderDate) {
      toast.error("Please select order date");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: partyId,
          order_date: orderDate,
          expected_delivery: expectedDelivery || null,
          total_amount: Number(totalAmount || 0),
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create sale order");
      }

      toast.success("Order booking recorded successfully!");
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (order: SaleOrder) => {
    setSelectedOrder(order);
    setPartyId(order.party_id);
    setOrderDate(order.order_date);
    setExpectedDelivery(order.expected_delivery || "");
    setStatus(order.status);
    setTotalAmount(order.total_amount);
    setNotes(order.notes || "");
    setIsEditOpen(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_delivery: expectedDelivery,
          status,
          total_amount: Number(totalAmount || 0),
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update order");
      }

      toast.success("Order details updated!");
      setIsEditOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (order: SaleOrder) => {
    setSelectedOrder(order);
    setIsDeleteOpen(true);
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/orders/${selectedOrder.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete order");
      }

      toast.success("Order deleted successfully");
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
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sales Order Bookings</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Manage incoming bookings, dispatch pipeline, and sales bill conversions
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2">
          <Plus size={16} />
          <span>New Order Booking</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#FEF3C7] text-[#D97706] rounded-lg">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pending Value</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{totalPendingVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#F3E8FF] text-[#9333EA] rounded-lg">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Ready for Dispatch</span>
            <span className="text-xl font-bold text-slate-800">{readyCount} Bookings</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Completed / Billed</span>
            <span className="text-xl font-bold text-slate-800">{dispatchedCount} Orders</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search booking number, party..."
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
            <option value="pending">Pending</option>
            <option value="in_process">In Process</option>
            <option value="ready">Ready</option>
            <option value="dispatched">Dispatched</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Date Filter */}
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

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2">
            <Loader2 className="h-7 w-7 text-[#6366F1] animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading orders book...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <ShoppingCart className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">No order bookings recorded yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
                  <th className="p-4">Order Date</th>
                  <th className="p-4">Order Code</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Expected Delivery</th>
                  <th className="p-4 text-right">Value (₹)</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Linked Invoice</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {orders.map((o) => {
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-700">{o.order_date}</td>
                      <td className="p-4 font-bold text-[#6366F1] font-mono">{o.order_number}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{o.party?.name}</span>
                          {o.party?.company_name && (
                            <span className="text-[10px] text-slate-400 font-medium">{o.party.company_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{o.expected_delivery || "—"}</td>
                      <td className="p-4 text-right font-bold text-slate-800">
                        ₹{o.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            o.status === "dispatched"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : o.status === "ready"
                              ? "bg-[#F3E8FF] text-[#7E22CE]"
                              : o.status === "in_process"
                              ? "bg-[#E0F2FE] text-[#0369A1]"
                              : o.status === "cancelled"
                              ? "bg-[#FEE2E2] text-[#DC2626]"
                              : "bg-[#FEF3C7] text-[#D97706]"
                          }`}
                        >
                          {o.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {o.converted_bill_id ? (
                          <Link
                            href={`/sales/bills/${o.converted_bill_id}`}
                            className="text-[#6366F1] hover:underline font-bold inline-flex items-center gap-1 font-mono text-[10px]"
                          >
                            <LinkIcon size={10} />
                            <span>{o.bill?.bill_number}</span>
                          </Link>
                        ) : o.status === "cancelled" ? (
                          <span className="text-slate-400 text-[10px]">Cancelled</span>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() => router.push(`/sales/bills/new?order_id=${o.id}`)}
                            className="bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] font-bold flex items-center gap-1 self-center"
                          >
                            <span>Convert</span>
                            <ChevronRight size={10} />
                          </Button>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={!!o.converted_bill_id}
                            onClick={() => handleOpenEdit(o)}
                            className={`w-8 h-8 border rounded-lg flex items-center justify-center transition-all ${
                              o.converted_bill_id
                                ? "border-slate-100 text-slate-300 cursor-not-allowed"
                                : "border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            }`}
                            title="Edit Booking"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            disabled={!!o.converted_bill_id}
                            onClick={() => handleOpenDelete(o)}
                            className={`w-8 h-8 border rounded-lg flex items-center justify-center transition-all ${
                              o.converted_bill_id
                                ? "border-slate-100 text-slate-300 cursor-not-allowed"
                                : "border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                            }`}
                            title="Delete Booking"
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
            <DialogTitle className="text-base font-bold text-slate-800">Record Sales Order Booking</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-4 pt-2">
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Date *</label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected Delivery</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. Total Booking Value (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Description & Notes</label>
              <textarea
                placeholder="List item details, design codes, quantities, sizes, packaging..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-20 p-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Record Order</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Edit Order Details</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateOrder} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</label>
              <input
                type="text"
                disabled
                value={selectedOrder?.party?.name || ""}
                className="w-full h-10 px-3 bg-slate-50 border border-[#D1D5DB] rounded-lg text-sm text-slate-500 cursor-not-allowed outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected Delivery</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="in_process">In Process</option>
                  <option value="ready">Ready</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. Total Booking Value (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Description & Notes</label>
              <textarea
                placeholder="List item details, design codes, quantities, sizes, packaging..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-20 p-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none resize-none"
              />
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

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Cancel & Delete Booking</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to delete order booking <span className="font-bold text-slate-700">{selectedOrder?.order_number}</span>? This will permanently cancel this order.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteOrder} size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
              {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
