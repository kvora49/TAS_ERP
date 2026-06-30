"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Plus,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  User,
  Shield,
  Trash2,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import WorkerAvatar from "@/components/shared/WorkerAvatar";
import CardSectionHeader from "@/components/shared/CardSectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WorkerProfileProps {
  params: { id: string };
}

export default function WorkerProfilePage({ params }: WorkerProfileProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // State for attendance logs filter
  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );

  // Fetch worker profile details and stats
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ["worker-profile", id],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch worker profile");
      return res.json();
    },
  });

  const worker = profileData?.worker || null;
  const stats = profileData?.stats || {
    totalJobWorkAmount: 0,
    totalPaidAmount: 0,
    currentOutstanding: 0,
    totalQtyCompleted: 0,
    attendance: { totalDays: 0, presentDays: 0, attendanceRate: 0 },
  };
  const documents = profileData?.documents || [];

  // Fetch Attendance Log
  const { data: attendanceData } = useQuery({
    queryKey: ["worker-attendance", id, attendanceMonth],
    queryFn: async () => {
      const year = attendanceMonth.split("-")[0];
      const month = attendanceMonth.split("-")[1];
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      
      const res = await fetch(`/api/workers/${id}/attendance?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
  });

  const attendanceList = attendanceData?.attendance || [];

  // Fetch Job Work Entries for Worker
  const { data: jobWorkData } = useQuery({
    queryKey: ["worker-job-work", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/job-work/ledger/${id}`);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
  });

  const ledgerEntries = jobWorkData?.ledger || [];
  
  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Upload document mutation
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      // 1. Get presigned upload URL
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          folder: "workers",
        }),
      });

      if (!presignedRes.ok) throw new Error("Failed to get upload signature");
      const { uploadUrl, publicUrl } = await presignedRes.json();

      // 2. Perform direct PUT upload to S3/R2
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) throw new Error("File upload failed");

      // 3. Register document in database
      const dbRes = await fetch(`/api/workers/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: file.type.includes("pdf") ? "other" : "other", // standard document mapping
          file_url: publicUrl,
          file_name: file.name,
          file_size_bytes: file.size,
        }),
      });

      if (!dbRes.ok) throw new Error("Failed to save document in DB");

      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["worker-profile", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/workers/${id}/documents?docId=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-profile", id] });
      toast.success("Document deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete document");
    },
  });

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ date, status }: { date: string; status: string }) => {
      const res = await fetch(`/api/workers/${id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance_date: date,
          status,
          check_in: "09:00",
          check_out: "18:00",
        }),
      });
      if (!res.ok) throw new Error("Failed to log attendance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-attendance", id] });
      queryClient.invalidateQueries({ queryKey: ["worker-profile", id] });
      toast.success("Attendance marked successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark attendance");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading worker profile...</span>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load worker profile</span>
        <Link href="/master-data/workers" className="text-xs text-[#6366F1] hover:underline">
          Back to Workers List
        </Link>
      </div>
    );
  }

  // Calculate attendance numbers for this month
  const totalDaysThisMonth = attendanceList.length;
  const presentDaysThisMonth = attendanceList.filter((a: any) => a.status === "present").length;
  const halfDaysThisMonth = attendanceList.filter((a: any) => a.status === "half_day").length;
  const absentDaysThisMonth = attendanceList.filter((a: any) => a.status === "absent").length;

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumbs and Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Master Data
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <Link href="/master-data/workers" className="hover:text-[#6366F1] transition-colors">
              Workers
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Worker Profile</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Worker Profile
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/master-data/workers"
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <ArrowLeft size={16} />
            Back to Workers
          </Link>
          <Link
            href={`/master-data/workers/${id}/edit`}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <Pencil size={16} />
            Edit Worker
          </Link>
          <Link
            href="/master-data/workers/new"
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            <Plus className="h-4 w-4 text-white" />
            Add New Worker
          </Link>
        </div>
      </div>

      {/* WORKER HEADER CARD */}
      <div className="flex flex-col lg:flex-row items-stretch gap-6 bg-white rounded-xl border border-[#E5E7EB] p-6">
        {/* Left Info */}
        <div className="flex flex-col items-center sm:items-start gap-4 shrink-0 sm:border-r border-[#F3F4F6] pr-6 lg:max-w-[280px] w-full">
          <div className="flex items-center gap-4">
            <WorkerAvatar name={worker.name} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">{worker.name}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#EDE9FE] text-[#7C3AED] mt-1.5">
                {worker.type === "job_worker" ? "Job Worker" : "Permanent"}
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-2 w-full text-sm text-[#475569]">
            {worker.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-[#94A3B8]" />
                <span>{worker.phone}</span>
              </div>
            )}
            {worker.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-[#94A3B8]" />
                <span className="truncate">{worker.email}</span>
              </div>
            )}
            {worker.address && (
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-[#94A3B8] mt-1 shrink-0" />
                <span className="leading-tight">
                  {worker.address}, {worker.city}, {worker.state}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center Grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 sm:border-r border-[#F3F4F6] sm:px-6 py-2">
          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Worker ID</span>
            <span className="text-sm font-mono font-bold text-[#374151] mt-1 block">{worker.worker_id}</span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Worker Type</span>
            <span className="text-sm font-medium text-[#374151] capitalize mt-1 block">
              {worker.type.replace("_", " ")}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Default Rate</span>
            <span className="text-sm font-semibold text-[#374151] mt-1 block">
              {worker.type === "job_worker" ? formatCurrency(worker.default_rate || 0) : "—"}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Status</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1.5 ${
                worker.is_active ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#DC2626]"
              }`}
            >
              {worker.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Date Joined</span>
            <span className="text-sm font-medium text-[#374151] mt-1 block">
              {worker.working_since
                ? new Date(worker.working_since).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Preferred Stage</span>
            <span className="text-sm font-medium text-[#374151] mt-1 block">
              {worker.preferred_stage?.name || "—"}
            </span>
          </div>
        </div>

        {/* Right Stats Summary */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 min-w-[240px] flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Current Status Summary</h4>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Total Job Work Amount:</span>
                <span className="font-semibold text-[#0F172A]">
                  {formatCurrency(stats.totalJobWorkAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Total Paid:</span>
                <span className="font-semibold text-[#15803D]">
                  {formatCurrency(stats.totalPaidAmount || 0)}
                </span>
              </div>
              <div className="border-t border-[#E2E8F0] pt-2 flex justify-between items-center mt-1">
                <span className="font-bold text-[#0F172A]">Outstanding:</span>
                <span className="font-bold text-[#DC2626]">
                  {formatCurrency(stats.currentOutstanding || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#94A3B8] font-medium flex items-center gap-1.5">
            <Clock size={12} />
            <span>Attendance Rate: {stats.attendance?.attendanceRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="border-b border-[#E5E7EB] bg-transparent p-0 rounded-none w-full justify-start h-11">
          <TabsTrigger
            value="overview"
            className="px-6 h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6366F1] data-[state=active]:bg-transparent text-sm font-medium text-[#64748B] data-[state=active]:text-[#6366F1]"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="job-work"
            className="px-6 h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6366F1] data-[state=active]:bg-transparent text-sm font-medium text-[#64748B] data-[state=active]:text-[#6366F1]"
          >
            Job Work History
          </TabsTrigger>
          <TabsTrigger
            value="payments"
            className="px-6 h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6366F1] data-[state=active]:bg-transparent text-sm font-medium text-[#64748B] data-[state=active]:text-[#6366F1]"
          >
            Payments
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="px-6 h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6366F1] data-[state=active]:bg-transparent text-sm font-medium text-[#64748B] data-[state=active]:text-[#6366F1]"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="px-6 h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6366F1] data-[state=active]:bg-transparent text-sm font-medium text-[#64748B] data-[state=active]:text-[#6366F1]"
          >
            Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6 outline-none">
          {/* Card 1: Personal Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="personal" title="Personal Information" />
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Name</span>
                <span className="font-medium text-[#374151]">{worker.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Phone</span>
                <span className="font-medium text-[#374151]">{worker.phone || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Email</span>
                <span className="font-medium text-[#374151] truncate max-w-[200px]">{worker.email || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Aadhaar No.</span>
                <span className="font-medium text-[#374151]">{worker.aadhaar || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">PAN No.</span>
                <span className="font-medium text-[#374151] uppercase">{worker.pan || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">GSTIN</span>
                <span className="font-medium text-[#374151] uppercase">{worker.gstin || "—"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Employment Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="employment" title="Employment Information" />
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Worker Type</span>
                <span className="font-medium text-[#374151] capitalize">
                  {worker.type.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Working Since</span>
                <span className="font-medium text-[#374151]">
                  {worker.working_since || "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Default Rate</span>
                <span className="font-semibold text-[#374151]">
                  {worker.type === "job_worker" ? formatCurrency(worker.default_rate || 0) : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Specialization</span>
                <span className="font-medium text-[#374151]">{worker.specialization || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Preferred Stage</span>
                <span className="font-medium text-[#374151]">{worker.preferred_stage?.name || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Max Capacity / Day</span>
                <span className="font-medium text-[#374151]">{worker.max_capacity_per_day || "—"} pcs</span>
              </div>
            </div>
          </div>

          {/* Card 3: Bank Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="bank" title="Bank & Salary Information" />
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Bank Name</span>
                <span className="font-medium text-[#374151]">{worker.bank_name || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Account Holder</span>
                <span className="font-medium text-[#374151]">{worker.account_holder_name || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Account No.</span>
                <span className="font-medium text-[#374151] font-mono">{worker.account_number || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">IFSC Code</span>
                <span className="font-medium text-[#374151] font-mono uppercase">{worker.ifsc_code || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Payment Mode</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#1D4ED8] uppercase">
                  {worker.payment_mode ? worker.payment_mode.replace("_", " ") : "Bank Transfer"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span className="text-[#64748B]">Payment Cycle</span>
                <span className="font-medium text-[#374151] capitalize">{worker.payment_cycle || "Weekly"}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* JOB WORK HISTORY TAB */}
        <TabsContent value="job-work" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm outline-none">
          <CardSectionHeader variant="quantity" title="Job Work Completion History" />
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Lot Number</th>
                  <th className="py-3 px-4">Production Stage</th>
                  <th className="py-3 px-4 text-right">Qty Completed</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {ledgerEntries.filter((e: any) => e.entry_type === "stage_entry").length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#64748B]">
                      No job work history recorded.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries
                    .filter((e: any) => e.entry_type === "stage_entry")
                    .map((entry: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4">{entry.date}</td>
                        <td className="py-3 px-4 font-mono font-bold text-xs text-[#6366F1]">
                          <Link href={`/production/lots/${entry.lot_id}`} className="hover:underline">
                            {entry.lot_number}
                          </Link>
                        </td>
                        <td className="py-3 px-4">{entry.stage_name}</td>
                        <td className="py-3 px-4 text-right font-medium">{entry.qty}</td>
                        <td className="py-3 px-4 text-right">₹{(entry.rate || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">
                          {formatCurrency(entry.amount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              entry.payment_status === "paid"
                                ? "bg-[#DCFCE7] text-[#15803D]"
                                : entry.payment_status === "partial"
                                ? "bg-[#FFF7ED] text-[#D97706]"
                                : "bg-[#FEE2E2] text-[#DC2626]"
                            }`}
                          >
                            {entry.payment_status || "unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* PAYMENTS HISTORY TAB */}
        <TabsContent value="payments" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm outline-none">
          <CardSectionHeader variant="job_work" title="Payment Transactions History" />
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Bank Name</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {ledgerEntries.filter((e: any) => e.entry_type === "payment").length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#64748B]">
                      No payment history recorded.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries
                    .filter((e: any) => e.entry_type === "payment")
                    .map((pm: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4">{pm.date}</td>
                        <td className="py-3 px-4 font-mono font-bold text-xs">{pm.ref_no || "—"}</td>
                        <td className="py-3 px-4 capitalize">{pm.stage_name ? pm.stage_name.replace("_", " ") : "Bank Transfer"}</td>
                        <td className="py-3 px-4">{pm.bank_name || "—"}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#15803D]">
                          {formatCurrency(Math.abs(pm.amount || 0))}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#DCFCE7] text-[#15803D]">
                            Success
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ATTENDANCE TAB */}
        <TabsContent value="attendance" className="space-y-6 outline-none">
          {/* Calendar Logs and Summary side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm h-fit">
              <CardSectionHeader variant="timeline" title="Attendance Summary" />
              
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E8F0] text-center">
                  <span className="text-[10px] text-[#64748B] font-bold block uppercase">Total Logs</span>
                  <span className="text-xl font-bold text-[#0F172A] mt-1 block">{totalDaysThisMonth}</span>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                  <span className="text-[10px] text-green-700 font-bold block uppercase">Present</span>
                  <span className="text-xl font-bold text-green-700 mt-1 block">{presentDaysThisMonth}</span>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                  <span className="text-[10px] text-red-600 font-bold block uppercase">Absent</span>
                  <span className="text-xl font-bold text-red-600 mt-1 block">{absentDaysThisMonth}</span>
                </div>
              </div>

              {/* Action Log Box */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider border-b border-[#F3F4F6] pb-2">
                  Quick Mark Attendance
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      markAttendanceMutation.mutate({
                        date: new Date().toISOString().substring(0, 10),
                        status: "present",
                      })
                    }
                    className="h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Mark Present Today
                  </button>
                  <button
                    onClick={() =>
                      markAttendanceMutation.mutate({
                        date: new Date().toISOString().substring(0, 10),
                        status: "absent",
                      })
                    }
                    className="h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Mark Absent Today
                  </button>
                </div>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-4 mb-4">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-[#6366F1]" />
                  Monthly Attendance Logs
                </h3>
                
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="h-8 text-xs rounded border border-[#E5E7EB] bg-white px-2 focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>

              <div className="overflow-y-auto max-h-[350px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Check In</th>
                      <th className="py-2.5 px-4">Check Out</th>
                      <th className="py-2.5 px-4">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-sm">
                    {attendanceList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#64748B]">
                          No attendance logs found for this month.
                        </td>
                      </tr>
                    ) : (
                      attendanceList.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-4 font-medium text-[#374151]">{log.attendance_date}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                log.status === "present"
                                  ? "bg-[#DCFCE7] text-[#15803D]"
                                  : log.status === "half_day"
                                  ? "bg-[#FFF7ED] text-[#D97706]"
                                  : "bg-[#FEE2E2] text-[#DC2626]"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs">{log.check_in || "—"}</td>
                          <td className="py-2.5 px-4 font-mono text-xs">{log.check_out || "—"}</td>
                          <td className="py-2.5 px-4 text-[#64748B] text-xs">{log.total_hours || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm outline-none">
          <CardSectionHeader variant="info" title="Documents & Identification" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* List */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider pb-1.5 border-b border-[#F3F4F6]">
                Uploaded Files
              </h4>

              {documents.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#94A3B8]">
                  No verification documents uploaded.
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[#6366F1] shrink-0" />
                        <div>
                          <span className="text-sm font-semibold text-[#374151] block truncate max-w-[260px]">
                            {doc.file_name || "Attachment"}
                          </span>
                          <span className="text-[10px] text-[#94A3B8] capitalize mt-0.5 block">
                            Type: {doc.doc_type} | Size: {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded border border-[#E5E7EB] flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this document?")) {
                              deleteDocMutation.mutate(doc.id);
                            }
                          }}
                          className="w-8 h-8 rounded border border-[#E5E7EB] flex items-center justify-center text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Zone */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#D1D5DB] rounded-xl p-8 hover:border-[#6366F1] transition-colors bg-[#F9FAFB]">
              <FileText className="h-10 w-10 text-[#94A3B8] mb-3" />
              <span className="text-sm font-semibold text-[#374151] mb-1">
                {uploadingDoc ? "Uploading..." : "Upload Worker ID verification"}
              </span>
              <p className="text-xs text-[#94A3B8] mb-4 text-center">
                Aadhaar card scan, PAN card copy or Bank Passbook front page (PDF, PNG, JPG)
              </p>

              <label className="bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm">
                Select File
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadDocument}
                  disabled={uploadingDoc}
                />
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
