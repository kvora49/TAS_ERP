"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Calendar,
  ShoppingCart,
  ChevronRight,
  Pencil,
  Trash2,
  Link as LinkIcon,
  Layers,
  Filter,
} from "lucide-react";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { toast } from "sonner";
import Link from "next/link";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import { Badge } from "@/components/shared/Badge";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { SALES_NAV } from "@/lib/moduleNav";
import { cn } from "@/lib/utils";

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

  // TanStack Query for orders
  const {
    data: ordersData,
    isPending: loadingOrders,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
  } = useERPQuery(
    ["sales-orders", statusFilter, startDate, endDate, search],
    async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);

      const res = await fetch(`/api/sales/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    }
  );

  // TanStack Query for customers list
  const { data: customersData } = useERPQuery(
    ["parties", "customer"],
    async () => {
      const res = await fetch("/api/parties?type=customer");
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    }
  );

  const orders: SaleOrder[] = ordersData?.orders || [];
  const customers: Party[] = customersData?.parties || [];

  // Mutations
  const createMutation = useERPMutation(
    async (payload: any) => {
      const res = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record order");
      }
      return res.json();
    },
    {
      successMessage: "Order booking recorded successfully!",
      invalidates: [["sales-orders"]],
      onSuccess: () => {
        setIsAddOpen(false);
        resetForm();
      },
    }
  );

  const updateMutation = useERPMutation(
    async (payload: any) => {
      if (!selectedOrder) throw new Error("No order selected");
      const res = await fetch(`/api/sales/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update order");
      }
      return res.json();
    },
    {
      successMessage: "Order details updated successfully!",
      invalidates: [["sales-orders"]],
      onSuccess: () => {
        setIsEditOpen(false);
        setSelectedOrder(null);
      },
    }
  );

  const deleteMutation = useERPMutation(
    async () => {
      if (!selectedOrder) throw new Error("No order selected");
      const res = await fetch(`/api/sales/orders/${selectedOrder.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete order");
      }
      return res.json();
    },
    {
      successMessage: "Order deleted successfully!",
      invalidates: [["sales-orders"]],
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelectedOrder(null);
      },
    }
  );

  const resetForm = () => {
    setPartyId("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setExpectedDelivery("");
    setStatus("pending");
    setTotalAmount("");
    setNotes("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (order: SaleOrder) => {
    setSelectedOrder(order);
    setExpectedDelivery(order.expected_delivery || "");
    setStatus(order.status);
    setTotalAmount(order.total_amount);
    setNotes(order.notes || "");
    setIsEditOpen(true);
  };

  const handleOpenDelete = (order: SaleOrder) => {
    setSelectedOrder(order);
    setIsDeleteOpen(true);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      party_id: partyId,
      order_date: orderDate,
      expected_delivery: expectedDelivery || null,
      status,
      total_amount: Number(totalAmount) || 0,
      notes: notes || null,
    });
  };

  const handleUpdateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      expected_delivery: expectedDelivery || null,
      status,
      total_amount: Number(totalAmount) || 0,
      notes: notes || null,
    });
  };

  const getStatusBadge = (st: SaleOrder["status"]) => {
    switch (st) {
      case "dispatched":
        return <Badge variant="green">Dispatched</Badge>;
      case "ready":
        return <Badge variant="purple">Ready</Badge>;
      case "in_process":
        return <Badge variant="blue">In Process</Badge>;
      case "cancelled":
        return <Badge variant="red">Cancelled</Badge>;
      case "pending":
      default:
        return <Badge variant="orange">Pending</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-12">
      {/* ── Sub-Navigation Pill Bar ── */}
      <ModuleSubNav items={SALES_NAV} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Sales Orders</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
              {orders.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
            Track customer booking orders, delivery commitments & lot workflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/sales/orders/new")}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Order Booking</span>
          </button>
        </div>
      </div>

      {/* ── Quick Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search order number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl pl-9 pr-3 h-10 text-sm transition-colors"
          />
        </div>

        {/* Status Filter Chips / Select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl px-3 h-10 text-sm transition-colors cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_process">In Process</option>
          <option value="ready">Ready</option>
          <option value="dispatched">Dispatched</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Date Filter */}
        <div className="hidden lg:flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--text-faint)] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3 h-10 text-xs transition-colors"
          />
          <span className="text-[var(--text-faint)] text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3 h-10 text-xs transition-colors"
          />
        </div>
      </div>

      {/* ── Status Tabs (Mobile Snap Chips) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none sm:hidden">
        {[
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "In Process", value: "in_process" },
          { label: "Ready", value: "ready" },
          { label: "Dispatched", value: "dispatched" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap",
              statusFilter === tab.value
                ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Data View with PageState ── */}
      <PageState
        isLoading={loadingOrders}
        isError={isOrdersError}
        error={ordersError instanceof Error ? ordersError.message : "Failed to load orders"}
        onRetry={refetchOrders}
        isEmpty={orders.length === 0}
        emptyTitle="No Sales Orders Found"
        emptyMessage={
          search || statusFilter
            ? "No bookings match your selected filter criteria."
            : "You haven't recorded any customer booking orders yet."
        }
        emptyAction={
          <button
            type="button"
            onClick={() => router.push("/sales/orders/new")}
            className="h-10 px-4 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Booking</span>
          </button>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={6}
      >
        {/* ── MOBILE: Clean Cards List ── */}
        <div className="md:hidden space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-3 transition-shadow"
            >
              {/* Header: Order# + Status */}
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-[var(--primary)] text-sm tracking-tight">
                  {o.order_number}
                </span>
                {getStatusBadge(o.status)}
              </div>

              {/* Customer + Date */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--text-primary)] text-sm truncate">
                    {o.party?.name || "Unknown Customer"}
                  </p>
                  {o.party?.company_name && (
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      {o.party.company_name}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-faint)] shrink-0 font-medium">
                  {o.order_date}
                </span>
              </div>

              {/* Value + Due Date Grid */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)]">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">
                    Booking Value
                  </span>
                  <span className="text-xs font-black text-[var(--text-primary)] mt-0.5 block">
                    ₹{o.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">
                    Delivery Due
                  </span>
                  <div className="mt-0.5">
                    <DueDateBadge
                      dueDate={o.expected_delivery}
                      isCompleted={o.status === "dispatched" || !!o.converted_bill_id}
                      type="order"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons (Convert, Start Lot, Linked Bill) */}
              <div className="pt-1">
                {o.converted_bill_id ? (
                  <Link
                    href={`/sales/bills/${o.converted_bill_id}`}
                    className="inline-flex items-center gap-1.5 text-[var(--primary)] font-bold text-xs hover:underline"
                  >
                    <LinkIcon size={12} />
                    <span>Linked Bill: {o.bill?.bill_number || "View Invoice"}</span>
                  </Link>
                ) : o.status !== "cancelled" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/sales/bills/new?order_id=${o.id}`)}
                      className="h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/20 text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Convert</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/production/lots/new?sale_order_id=${o.id}&order_no=${o.order_number}`
                        )
                      }
                      className="h-8 rounded-lg bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Layers size={13} />
                      <span>Start Lot</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Footer Actions (Edit & Delete) */}
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(o)}
                  className="h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-[var(--card-bg)] transition-colors"
                >
                  <Pencil size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDelete(o)}
                  className="h-8 px-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: Clean Modern Table ── */}
        <div className="hidden md:block bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="p-4">Order Date</th>
                  <th className="p-4">Order Code</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Expected Delivery</th>
                  <th className="p-4 text-right">Value (₹)</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Workflow</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-[var(--table-row-hover)] transition-colors"
                  >
                    <td className="p-4 font-semibold text-[var(--text-secondary)]">
                      {o.order_date}
                    </td>
                    <td className="p-4 font-bold text-[var(--primary)] font-mono">
                      {o.order_number}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--text-primary)]">
                          {o.party?.name || "Unknown Customer"}
                        </span>
                        {o.party?.company_name && (
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">
                            {o.party.company_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[var(--text-secondary)] font-semibold">
                          {o.expected_delivery || "—"}
                        </span>
                        <DueDateBadge
                          dueDate={o.expected_delivery}
                          isCompleted={o.status === "dispatched" || !!o.converted_bill_id}
                          type="order"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-[var(--text-primary)]">
                      ₹{o.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(o.status)}</td>
                    <td className="p-4 text-center">
                      {o.converted_bill_id ? (
                        <Link
                          href={`/sales/bills/${o.converted_bill_id}`}
                          className="text-[var(--primary)] hover:underline font-bold inline-flex items-center gap-1 font-mono text-xs"
                        >
                          <LinkIcon size={12} />
                          <span>{o.bill?.bill_number || "View Bill"}</span>
                        </Link>
                      ) : o.status === "cancelled" ? (
                        <span className="text-[var(--text-faint)] text-xs">Cancelled</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/sales/bills/new?order_id=${o.id}`)}
                            className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/20 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                            title="Convert to Sales Bill"
                          >
                            <span>Convert</span>
                            <ChevronRight size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/production/lots/new?sale_order_id=${o.id}&order_no=${o.order_number}`
                              )
                            }
                            className="px-2.5 py-1 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                            title="Start Production Lot"
                          >
                            <Layers size={12} />
                            <span>Start Lot</span>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(o)}
                          className="w-8 h-8 border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-amber-500 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                          title="Edit Order"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(o)}
                          className="w-8 h-8 border border-red-500/20 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                          title="Delete Order"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageState>

      {/* ── Add Booking Modal ── */}
      <Modal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Record Sales Order Booking"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Customer *
            </label>
            <select
              value={partyId}
              required
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Order Date *
              </label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Expected Delivery
              </label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Est. Total Booking Value (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) =>
                setTotalAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Order Notes & Details
            </label>
            <textarea
              placeholder="List item details, design codes, quantities, sizes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-sm transition-colors resize-none h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={createMutation.isPending}
              variant="primary"
            >
              Record Order
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* ── Edit Order Modal ── */}
      <Modal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Order Details"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateOrder} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Customer
            </label>
            <input
              type="text"
              disabled
              value={selectedOrder?.party?.name || ""}
              className="w-full bg-[var(--page-bg)] border border-[var(--input-border)] rounded-lg px-3 h-10 text-sm text-[var(--text-muted)] cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Expected Delivery
              </label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
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
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Est. Total Booking Value (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) =>
                setTotalAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Order Notes & Details
            </label>
            <textarea
              placeholder="List item details, design codes, quantities, sizes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-sm transition-colors resize-none h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={updateMutation.isPending}
              variant="primary"
            >
              Save Changes
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Order Booking"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Are you sure you want to delete order booking{" "}
            <strong className="font-mono font-bold text-[var(--text-primary)]">
              {selectedOrder?.order_number}
            </strong>
            ? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
              variant="destructive"
            >
              Delete Permanently
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
