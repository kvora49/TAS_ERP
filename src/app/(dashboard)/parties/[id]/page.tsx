"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  Globe,
  FileText,
  User,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Layers,
  Banknote,
  Wrench,
  DollarSign,
  Activity,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

interface ContactNumber {
  label: string;
  number: string;
  is_primary: boolean;
}

interface BankDetail {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch?: string;
  is_primary: boolean;
}

interface Party {
  id: string;
  name: string;
  type: string[];
  code: string;
  phone?: string;
  whatsapp_number?: string;
  company_name?: string;
  email?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  aadhar?: string;
  msme_number?: string;
  tan?: string;
  remarks?: string;
  status: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_pincode?: string;
  contact_numbers?: ContactNumber[];
  bank_details?: BankDetail[];
}

interface Purchase {
  id: string;
  purchase_number: string;
  invoice_no: string;
  invoice_date: string;
  grand_total: number;
  paid_amount: number;
  payment_status: string;
}

interface PurchaseReturn {
  id: string;
  return_number: string;
  return_date: string;
  return_type: string;
  grand_total: number;
  status: string;
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_type: string;
  bill_date: string;
  grand_total: number;
  paid_amount: number;
  payment_status: string;
  status: string;
}

interface StageAssignment {
  id: string;
  stage_name: string;
  qty_in: number;
  qty_out: number;
  qty_balance: number;
  job_work_rate: number;
  total_job_work_amount: number;
  payment_status: string;
  status: string;
  created_at: string;
  production_lots?: {
    lot_number: string;
  };
}

interface DetailResponse {
  party: Party;
  supplierStats?: {
    purchases: Purchase[];
    returns: PurchaseReturn[];
    totalPurchased: number;
    totalPurchasedPaid: number;
    totalPurchasedOutstanding: number;
  };
  customerStats?: {
    sales: SaleBill[];
    totalSold: number;
    totalSoldPaid: number;
    totalSoldOutstanding: number;
  };
  workerStats?: {
    stageAssignments: StageAssignment[];
  };
}

export default function PartyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setData(null);
      try {
        const res = await fetch(`/api/parties/${id}/detail`);
        if (!res.ok) throw new Error("Failed to load party details");
        const json = await res.json();
        setData(json);
        
        // Auto-select first available type-tab
        const types = json.party?.type || [];
        if (types.includes("supplier")) {
          setActiveTab("supplier");
        } else if (types.includes("customer")) {
          setActiveTab("customer");
        } else if (types.includes("worker")) {
          setActiveTab("worker");
        }
      } catch (err: any) {
        toast.error(err.message || "Error loading page");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Activity className="h-10 w-10 animate-spin text-[#6366F1]" />
        <p className="text-sm font-bold text-[#64748B] animate-pulse">Loading party records...</p>
      </div>
    );
  }

  if (!data || !data.party) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Party Not Found</h3>
        <p className="text-sm text-[#64748B]">The requested party could not be loaded or has been deleted.</p>
        <Link
          href="/parties"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold transition-all shadow-md"
        >
          <ArrowLeft size={16} /> Back to Parties List
        </Link>
      </div>
    );
  }

  const { party, supplierStats, customerStats, workerStats } = data;
  const isSupplier = party.type?.includes("supplier");
  const isCustomer = party.type?.includes("customer");
  const isWorker = party.type?.includes("worker");

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="green">Paid</Badge>;
      case "partial":
        return <Badge variant="orange">Partial</Badge>;
      case "unpaid":
        return <Badge variant="red">Unpaid</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="green">Completed</Badge>;
      case "in_progress":
        return <Badge variant="blue">In Progress</Badge>;
      case "pending":
        return <Badge variant="orange">Pending</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Breadcrumb and Edit Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
          <Link href="/" className="hover:text-[#0F172A] transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/parties" className="hover:text-[#0F172A] transition-colors">
            Parties
          </Link>
          <span>/</span>
          <span className="text-[#0F172A]">{party.name}</span>
        </div>

        <div className="flex items-center gap-3 select-none">
          <button
            onClick={() => router.push(`/parties`)}
            className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={() => router.push(`/master-data/parties/${party.id}/edit`)}
            className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#6366F1]/10"
          >
            <Pencil size={15} /> Edit Party
          </button>
        </div>
      </div>

      {/* Main Party Profile Header Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold font-mono px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md">
                {party.code}
              </span>
              {party.type?.map((t) => (
                <Badge key={t} variant={t === "supplier" ? "purple" : t === "customer" ? "blue" : "green"} className="font-bold text-[10px] uppercase">
                  {t}
                </Badge>
              ))}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${party.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {party.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
            
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">{party.name}</h1>
              {party.company_name && (
                <p className="text-sm font-semibold text-[#64748B] flex items-center gap-1.5 mt-0.5">
                  <User size={14} /> Owner / Company: {party.company_name}
                </p>
              )}
            </div>
          </div>

          {/* Contact and Registrations Brief Panel */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 shrink-0">
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase">GSTIN Treatment</p>
              <p className="text-xs font-bold text-[#334155] font-mono mt-0.5">{party.gstin || "URP"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase">PAN Number</p>
              <p className="text-xs font-bold text-[#334155] font-mono mt-0.5">{party.pan || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Aadhar Number</p>
              <p className="text-xs font-bold text-[#334155] font-mono mt-0.5">{party.aadhar || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase">MSME Number</p>
              <p className="text-xs font-bold text-[#334155] font-mono mt-0.5">{party.msme_number || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Extended Profile Details (Remarks, Address, and Contacts) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Address Details */}
          <div className="p-6 space-y-4">
            <h2 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Registered Address</h2>
            <div className="space-y-3 text-xs text-[#475569] font-medium">
              <div>
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Billing Address</p>
                <p className="mt-1 leading-relaxed">
                  {party.billing_address_line1 || "No billing address specified"}
                  {party.billing_address_line2 && `, ${party.billing_address_line2}`}
                  {(party.billing_city || party.billing_state) && <br />}
                  {party.billing_city}
                  {party.billing_city && party.billing_state && ", "}
                  {party.billing_state}
                  {party.billing_pincode && ` - ${party.billing_pincode}`}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Channels List */}
          <div className="p-6 space-y-4">
            <h2 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Contact Channels</h2>
            <div className="space-y-3">
              {party.email && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                  <Mail size={14} className="text-[#94A3B8]" />
                  <span>{party.email}</span>
                </div>
              )}
              {party.website && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                  <Globe size={14} className="text-[#94A3B8]" />
                  <a href={party.website} target="_blank" rel="noreferrer" className="text-[#6366F1] hover:underline">
                    {party.website}
                  </a>
                </div>
              )}

              {/* Repeatable Contacts list */}
              {party.contact_numbers && party.contact_numbers.length > 0 ? (
                <div className="space-y-2 mt-2 pt-2 border-t border-slate-50">
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Telephone Directory</p>
                  <div className="space-y-1.5">
                    {party.contact_numbers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#334155]">
                          <Phone size={12} className="text-[#6366F1]" />
                          <span>{c.number}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                            {c.label}
                          </span>
                          {c.is_primary && (
                            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Telephone Directory</p>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                    <Phone size={14} className="text-[#94A3B8]" />
                    <span>{party.phone || "No phone listed"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remarks and General notes */}
          <div className="p-6 space-y-4">
            <h2 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Internal Remarks & Comments</h2>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-medium text-[#475569] min-h-[80px] leading-relaxed">
              {party.remarks || "No remarks or special comments logged for this party."}
            </div>
          </div>
        </div>
      </div>

      {/* Type-Conditional Detail Tabs Section */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex border-b border-[#E2E8F0] gap-4">
          {isSupplier && (
            <button
              onClick={() => setActiveTab("supplier")}
              className={`pb-2.5 text-sm font-bold border-b-2 cursor-pointer transition-all ${activeTab === "supplier" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"}`}
            >
              Supplier (Purchase Records)
            </button>
          )}
          {isCustomer && (
            <button
              onClick={() => setActiveTab("customer")}
              className={`pb-2.5 text-sm font-bold border-b-2 cursor-pointer transition-all ${activeTab === "customer" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"}`}
            >
              Customer (Sales History)
            </button>
          )}
          {isWorker && (
            <button
              onClick={() => setActiveTab("worker")}
              className={`pb-2.5 text-sm font-bold border-b-2 cursor-pointer transition-all ${activeTab === "worker" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"}`}
            >
              Worker (Stage Assignments)
            </button>
          )}
        </div>

        {/* Tab Content Panels */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6">
          {/* 1. Supplier Panel */}
          {activeTab === "supplier" && supplierStats && (
            <div className="space-y-6">
              {/* Supplier Financial Stats Brief */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-[#6366F1] flex items-center justify-center shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Total Material Purchased</p>
                    <p className="text-lg font-black text-[#0F172A]">₹{supplierStats.totalPurchased.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Total Payments Made</p>
                    <p className="text-lg font-black text-[#0F172A]">₹{supplierStats.totalPurchasedPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Outstanding Liability</p>
                    <p className="text-lg font-black text-amber-600">₹{supplierStats.totalPurchasedOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Purchase Invoices Listing */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <FileText size={16} className="text-[#6366F1]" />
                  Purchase Invoice History
                </h3>
                {supplierStats.purchases.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-lg font-semibold">
                    No purchase invoices logged for this supplier yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#475569] border-b border-slate-100 select-none">
                          <th className="p-3">Purchase No.</th>
                          <th className="p-3">Bill / Invoice No.</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Grand Total</th>
                          <th className="p-3 text-right">Paid Amount</th>
                          <th className="p-3 text-center">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold text-[#334155]">
                        {supplierStats.purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-[#6366F1] font-bold hover:underline cursor-pointer">
                              <Link href={`/raw-materials/purchases`}>
                                {p.purchase_number}
                              </Link>
                            </td>
                            <td className="p-3 font-mono">{p.invoice_no}</td>
                            <td className="p-3 flex items-center gap-1 text-[#64748B]">
                              <Calendar size={12} />
                              {new Date(p.invoice_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="p-3 text-right font-bold">₹{Number(p.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-emerald-600 font-bold">₹{Number(p.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">{getPaymentStatusBadge(p.payment_status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Purchase Returns Listing */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-[#E11D48]" />
                  Purchase Return History
                </h3>
                {supplierStats.returns.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-lg font-semibold">
                    No material returns logged for this supplier yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#475569] border-b border-slate-100 select-none">
                          <th className="p-3">Return No.</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Return Type</th>
                          <th className="p-3 text-right">Refund Amount</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold text-[#334155]">
                        {supplierStats.returns.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-[#E11D48] font-bold hover:underline cursor-pointer">
                              <Link href={`/raw-materials/purchase-returns`}>
                                {r.return_number}
                              </Link>
                            </td>
                            <td className="p-3 flex items-center gap-1 text-[#64748B]">
                              <Calendar size={12} />
                              {new Date(r.return_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="p-3 capitalize font-bold text-[#475569]">{r.return_type?.replace("_", " ")}</td>
                            <td className="p-3 text-right font-bold">₹{Number(r.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <Badge variant={r.status === "completed" ? "green" : r.status === "cancelled" ? "red" : "orange"}>
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Customer Panel */}
          {activeTab === "customer" && customerStats && (
            <div className="space-y-6">
              {/* Customer Financial Stats Brief */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Total Goods Invoiced</p>
                    <p className="text-lg font-black text-[#0F172A]">₹{customerStats.totalSold.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Total Payments Received</p>
                    <p className="text-lg font-black text-[#0F172A]">₹{customerStats.totalSoldPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase">Total Outstanding Receivables</p>
                    <p className="text-lg font-black text-amber-600">₹{customerStats.totalSoldOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Sales Bills History Listing */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <FileText size={16} className="text-[#3B82F6]" />
                  Sales Invoice History
                </h3>
                {customerStats.sales.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-lg font-semibold">
                    No sales invoices logged for this customer yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#475569] border-b border-slate-100 select-none">
                          <th className="p-3">Invoice No.</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Grand Total</th>
                          <th className="p-3 text-right">Collected Amount</th>
                          <th className="p-3 text-center">Payment Status</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold text-[#334155]">
                        {customerStats.sales.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-blue-600 font-bold hover:underline cursor-pointer">
                              <Link href={`/sales/bills`}>
                                {s.bill_number}
                              </Link>
                            </td>
                            <td className="p-3 uppercase font-mono text-[10px]">{s.bill_type}</td>
                            <td className="p-3 flex items-center gap-1 text-[#64748B]">
                              <Calendar size={12} />
                              {new Date(s.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="p-3 text-right font-bold">₹{Number(s.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-emerald-600 font-bold">₹{Number(s.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">{getPaymentStatusBadge(s.payment_status)}</td>
                            <td className="p-3 text-center">
                              <Badge variant={s.status === "active" ? "green" : s.status === "cancelled" ? "red" : "orange"}>
                                {s.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Worker Panel */}
          {activeTab === "worker" && workerStats && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Wrench size={16} className="text-[#10B981]" />
                Worker Stage Assignments & Lot Labor Sheets
              </h3>
              {workerStats.stageAssignments.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-lg font-semibold">
                  No stage entries or lot assignments logged for this worker.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-[#475569] border-b border-slate-100 select-none">
                        <th className="p-3">Lot Number</th>
                        <th className="p-3">Stage Worked</th>
                        <th className="p-3 text-center">Qty In</th>
                        <th className="p-3 text-center">Qty Out</th>
                        <th className="p-3 text-center">Qty Balance</th>
                        <th className="p-3 text-right">Piece Rate</th>
                        <th className="p-3 text-right">Earned Pay</th>
                        <th className="p-3 text-center">Stage Status</th>
                        <th className="p-3 text-center">Labor Paid Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-semibold text-[#334155]">
                      {workerStats.stageAssignments.map((sa) => (
                        <tr key={sa.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-emerald-600 font-bold hover:underline cursor-pointer">
                            <Link href={`/production/lots`}>
                              {sa.production_lots?.lot_number || "Unknown"}
                            </Link>
                          </td>
                          <td className="p-3 font-bold">{sa.stage_name}</td>
                          <td className="p-3 text-center font-mono">{sa.qty_in}</td>
                          <td className="p-3 text-center font-mono">{sa.qty_out}</td>
                          <td className="p-3 text-center font-mono text-[#64748B]">{sa.qty_balance}</td>
                          <td className="p-3 text-right font-mono">₹{Number(sa.job_work_rate || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#0F172A]">₹{Number(sa.total_job_work_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">{getStatusBadge(sa.status)}</td>
                          <td className="p-3 text-center">{getPaymentStatusBadge(sa.payment_status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bank Accounts Section Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
          <Banknote size={16} className="text-[#6366F1]" />
          Wired Bank & UPI Accounts
        </h2>
        {party.bank_details && party.bank_details.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {party.bank_details.map((b) => (
              <div key={b.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 relative overflow-hidden">
                {b.is_primary && (
                  <div className="absolute top-0 right-0 bg-[#6366F1] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl-lg">
                    Primary
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Bank Name</p>
                  <p className="text-xs font-extrabold text-[#334155]">{b.bank_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">A/C Number</p>
                    <p className="text-xs font-mono font-bold text-[#475569]">{b.account_number}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">IFSC Code</p>
                    <p className="text-xs font-mono font-bold text-[#475569]">{b.ifsc_code}</p>
                  </div>
                </div>
                {b.branch && (
                  <div>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Branch</p>
                    <p className="text-xs font-semibold text-[#475569]">{b.branch}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[#64748B] bg-slate-50 border border-dashed border-slate-200 rounded-lg font-semibold">
            No bank or settlement accounts linked to this party yet.
          </div>
        )}
      </div>
    </div>
  );
}
