"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Wallet, FileText, AlertCircle, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

interface ExpenseType {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  gst_percent: number;
  gst_amount: number;
  vendor_name: string | null;
  vendor_invoice_no: string | null;
  notes: string | null;
  expense_type: { id: string; name: string } | null;
  bank_account: { id: string; account_name: string } | null;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form States
  const [expenseTypeId, setExpenseTypeId] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Fetch expenses list
  const { data: listData, isLoading, error } = useQuery<{ expenses: Expense[] }>({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to load expenses list");
      return res.json();
    },
  });

  const expenses = listData?.expenses || [];

  // Fetch form data (expense types & bank accounts)
  const { data: formData } = useQuery<{
    expenseTypes: ExpenseType[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["expense-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/expenses?form_data=true");
      if (!res.ok) throw new Error("Failed to load expense options");
      return res.json();
    },
    enabled: showAddModal,
  });

  const expenseTypes = formData?.expenseTypes || [];
  const bankAccounts = formData?.bankAccounts || [];

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save expense");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      setShowAddModal(false);
      // Reset form
      setExpenseTypeId("");
      setAmount(0);
      setVendorName("");
      setVendorInvoiceNo("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleSubmit = async () => {
    if (!expenseTypeId) {
      toast.error("Please select an expense category.");
      return;
    }
    if (amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    const payload = {
      expense_type_id: expenseTypeId,
      expense_date: expenseDate,
      amount,
      gst_percent: gstPercent,
      paid_from_account_id: bankAccountId || null,
      vendor_name: vendorName,
      vendor_invoice_no: vendorInvoiceNo,
      notes,
    };

    await saveMutation.mutateAsync(payload);
  };

  // Computations for stats
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);

  const totalThisMonth = expenses
    .filter((e) => new Date(e.expense_date) >= thisMonthStart)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPaid = expenses
    .filter((e) => e.bank_account !== null)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPending = expenses
    .filter((e) => e.bank_account === null)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Expenses Dashboard</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Office & Operating Expenses
            </p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9.5 rounded-lg px-4 shadow-[var(--shadow-sm)]"
          >
            <Plus className="h-4.5 w-4.5" />
            Record Expense
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-[var(--primary)]">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Total This Month</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(totalThisMonth)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Paid Out</span>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Pending / Unpaid</span>
              <p className="text-xl font-bold text-rose-600 mt-0.5">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>

        {/* Expenses List Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Expense No.</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Vendor Name</th>
                  <th className="py-3 px-6 text-right">Taxable (₹)</th>
                  <th className="py-3 px-6 text-right">GST (₹)</th>
                  <th className="py-3 px-6 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-6">Paid From</th>
                  <th className="py-3 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                      No expenses recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const isPaid = exp.bank_account !== null;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors h-14">
                        <td className="py-3 px-6 font-mono font-bold text-slate-900">{exp.expense_number}</td>
                        <td className="py-3 px-6 font-mono text-slate-500">
                          {new Date(exp.expense_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6 font-bold text-slate-900">{exp.expense_type?.name || "—"}</td>
                        <td className="py-3 px-6">{exp.vendor_name || "—"}</td>
                        <td className="py-3 px-6 text-right font-mono">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-slate-500">
                          {formatCurrency(exp.gst_amount)} ({exp.gst_percent}%)
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-slate-900 font-bold">
                          {formatCurrency(Number(exp.amount) + Number(exp.gst_amount))}
                        </td>
                        <td className="py-3 px-6">{exp.bank_account?.account_name || "—"}</td>
                        <td className="py-3 px-6 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {isPaid ? "Paid" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Expense Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Record New Expense</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Select Category *</label>
                    <select
                      value={expenseTypeId}
                      onChange={(e) => setExpenseTypeId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value="">-- Select Category --</option>
                      {expenseTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Expense Date *</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Amount (Taxable ₹) *</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount || ""}
                      onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">GST Percent (%)</label>
                    <select
                      value={gstPercent}
                      onChange={(e) => setGstPercent(Number(e.target.value))}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Vendor Invoice No.</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-998"
                      value={vendorInvoiceNo}
                      onChange={(e) => setVendorInvoiceNo(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Paid From Account (optional)</label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value="">-- Keep Unpaid (Pending) --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600 font-bold text-slate-400">Total Calculated Cost</label>
                    <div className="h-9 flex items-center px-3 bg-slate-100 rounded-lg text-slate-800 font-extrabold text-sm">
                      {formatCurrency(amount * (1 + gstPercent / 100))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Notes / Details</label>
                  <textarea
                    value={notes}
                    rows={2}
                    placeholder="Enter notes..."
                    onChange={(e) => setNotes(e.target.value)}
                    className="p-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none resize-none w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 text-xs font-bold border-gray-300 text-slate-700 hover:bg-white"
                >
                  Cancel
                </Button>
                <AsyncButton
                  onClick={handleSubmit}
                  className="h-9 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
                >
                  Record Expense
                </AsyncButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
