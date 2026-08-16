"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { ActionBadge } from "@/components/shared/ActionBadge";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Modal } from "@/components/shared/Modal";
import {
  SlidersHorizontal,
  Download,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  ExternalLink,
  Copy,
  Globe,
  Monitor,
  UserCheck,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  table_name: string;
  action: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  users?: {
    full_name: string;
    email: string;
  };
}

interface User {
  id: string;
  full_name: string;
}

// ─── Field label display map ────────────────────────────────────────────────
const FIELD_LABEL_MAP: Record<string, string> = {
  // Production
  stage_name: "Stage",
  worker_name: "Assigned Worker",
  qty_in: "Input Quantity",
  qty_out: "Output Quantity",
  good_pcs: "Good Pieces",
  rejected_pcs: "Rejected Pieces",
  rework_pcs: "Rework Pieces",
  shift: "Shift",
  lot_number: "Lot Number",
  lot_name: "Lot Name",
  lot_date: "Lot Date",
  total_quantity: "Total Quantity",
  completed_quantity: "Completed Quantity",
  target_dispatch_date: "Target Dispatch Date",
  stage_type: "Stage Type",
  sequence_no: "Sequence",
  is_mandatory: "Mandatory",
  // Billing
  bill_number: "Bill Number",
  invoice_number: "Invoice Number",
  supplier_bill_no: "Supplier Bill No.",
  bill_date: "Bill Date",
  bill_amount: "Bill Amount",
  total_amount: "Total Amount",
  grand_total: "Grand Total",
  paid_amount: "Paid Amount",
  balance_amount: "Balance Due",
  payment_mode: "Payment Method",
  payment_type: "Payment Type",
  payment_date: "Payment Date",
  payment_status: "Payment Status",
  direction: "Direction",
  amount: "Amount",
  // Parties
  party_name: "Party / Supplier",
  // Materials
  material_name: "Material Name",
  item_name: "Item Name",
  rate: "Unit Rate",
  rate_per_pc: "Rate per Piece",
  daily_rate: "Daily Rate",
  monthly_salary: "Monthly Salary",
  unit: "Unit",
  // Storage
  godown_name: "Godown",
  // Users / Workers
  full_name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  role: "User Role",
  is_active: "Account Active",
  working_since: "Working Since",
  bank_name: "Bank Name",
  // Documents
  doc_type: "Document Type",
  file_name: "File Name",
  file_size_bytes: "File Size",
  // General
  status: "Status",
  notes: "Notes",
  remarks: "Remarks",
  cn_number: "Credit Note #",
  return_number: "Return Number",
  // Design
  design_name: "Design Name",
  design_code: "Design Code",
  color: "Colour / Shade",
  size: "Size",
  type: "Type",
  name: "Name",
};

function getFieldLabel(key: string): string {
  const mapped = FIELD_LABEL_MAP[key.toLowerCase()];
  if (mapped) return mapped;
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── UUID detection ──────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Universal value formatter ────────────────────────────────────────────────
function formatValue(key: string, val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";

  // Arrays
  if (Array.isArray(val)) {
    if (val.length === 0) return "None";
    return `${val.length} item${val.length !== 1 ? "s" : ""}`;
  }

  // Objects (non-array) — hide; too complex to render meaningfully
  if (typeof val === "object") return "—";

  // UUID strings — should be ignored via IGNORED_KEYS, but catch any that slip through
  if (typeof val === "string" && UUID_REGEX.test(val.trim())) return "—";

  const lowerKey = key.toLowerCase();

  // Money: any key that sounds like a currency value
  if (
    typeof val === "number" &&
    (
      lowerKey.includes("amount") || lowerKey.includes("price") ||
      lowerKey.includes("total") || lowerKey.includes("cost") ||
      lowerKey.includes("rate") || lowerKey.includes("salary") ||
      lowerKey.includes("salary") || lowerKey.includes("paid")
    )
  ) {
    return `₹${val.toLocaleString("en-IN")}`;
  }

  // File size in bytes
  if (typeof val === "number" && (lowerKey.includes("size_bytes") || lowerKey.includes("file_size"))) {
    if (val < 1024) return `${val} B`;
    if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`;
    return `${(val / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ISO date strings
  if (
    typeof val === "string" &&
    /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)
  ) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    } catch {}
  }

  // snake_case enum values → Title Case  (e.g. piece_rate → Piece Rate)
  if (typeof val === "string" && /^[a-z0-9]+(_[a-z0-9]+)+$/.test(val)) {
    return val.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // Single lowercase word → capitalise
  if (typeof val === "string" && /^[a-z]+$/.test(val) && val.length < 30) {
    return val.charAt(0).toUpperCase() + val.slice(1);
  }

  return String(val);
}

// ─── Value prettifier (for use inside sentences) ──────────────────────────────
function prettyStr(val: string | undefined | null): string {
  if (!val) return "";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Entity navigation routing ────────────────────────────────────────────────
function getEntityRoute(log: AuditLog): { label: string; url: string } | null {
  if (!log) return null;
  const table = (log.table_name || "").toLowerCase();
  const recordId = log.record_id;
  const n = log.new_values || {};
  const o = log.old_values || {};

  // Stage entries → directly to the Production Lot they belong to
  if (table === "stage_entries" || table === "lot_production_stages" || table === "production_stage_entries") {
    const lotId = n.lot_id || o.lot_id;
    if (lotId) {
      const lotNo = n.lot_number || o.lot_number || "";
      return { label: lotNo ? `View Production Lot #${lotNo}` : "View Production Lot", url: `/production/lots/${lotId}` };
    }
    return { label: "View Production Lots", url: "/production/lots" };
  }

  if (table === "production_lots") {
    if (recordId) {
      const lotNo = n.lot_number || o.lot_number || "";
      return { label: lotNo ? `View Lot #${lotNo}` : "View Production Lot", url: `/production/lots/${recordId}` };
    }
    return { label: "View Production Lots", url: "/production/lots" };
  }

  if (table === "raw_material_purchases") {
    if (recordId) return { label: "View Purchase Invoice", url: `/raw-materials/purchases/${recordId}` };
    return { label: "View Purchases", url: "/raw-materials/purchases" };
  }

  if (table === "sale_bills" || table === "sales") {
    if (recordId) return { label: "View Sale Bill", url: `/sales/${recordId}` };
    return { label: "View Sales", url: "/sales" };
  }

  if (table === "workers") {
    if (recordId) return { label: "View Worker Profile", url: `/workers/${recordId}` };
    return { label: "View Workers", url: "/workers" };
  }

  if (table === "worker_documents") {
    const workerId = (log.new_values || log.old_values || {} as any)?.worker_id;
    if (workerId) return { label: "View Worker Profile", url: `/workers/${workerId}` };
    return { label: "View Workers", url: "/workers" };
  }

  if (table === "users") {
    return { label: "View Users & Roles", url: "/settings/users-roles" };
  }

  if (table === "payments") {
    return { label: "View Payments", url: "/payments/supplier" };
  }

  if (table === "job_work_payments") {
    return { label: "View Job Work Payments", url: "/production/job-work/payments" };
  }

  if (table === "parties") {
    if (recordId) return { label: "View Party Ledger", url: `/parties/${recordId}/ledger` };
    return { label: "View Parties", url: "/parties" };
  }

  if (table === "stock_integrity" || table === "stock_integrity_logs") {
    return { label: "View Finished Stock Explorer", url: "/master-data/designs" };
  }

  if (table === "finished_stock" || table === "designs") {
    return { label: "View Finished Stock", url: "/finished-stock" };
  }

  if (table === "credit_notes") {
    return { label: "View Sales", url: "/sales" };
  }

  if (table === "sales_returns") {
    return { label: "View Sales Returns", url: "/sales/returns" };
  }

  if (table === "purchase_returns") {
    return { label: "View Purchase Returns", url: "/raw-materials/purchase-returns" };
  }

  if (table === "purchase_bills") {
    return { label: "View Purchase Bills", url: "/purchases/bills" };
  }

  if (table === "raw_material_types") {
    return { label: "View Raw Materials", url: "/master-data/raw-materials" };
  }

  return null;
}

// ─── Human-readable activity summary sentences ────────────────────────────────
function getSummarySentence(log: AuditLog): string {
  const user = log.user_name || log.users?.full_name || "System";
  const action = (log.action || "").toLowerCase();
  const table = (log.table_name || "").toLowerCase();
  const n = log.new_values || {};
  const o = log.old_values || {};

  // Workers
  if (table === "workers") {
    const name = n.full_name || o.full_name || "a worker";
    const payType = n.payment_type || o.payment_type;
    const rate = n.rate_per_pc || n.daily_rate || n.monthly_salary || o.rate_per_pc || o.daily_rate || o.monthly_salary;
    const payStr = payType ? ` (${prettyStr(payType)})` : "";
    const rateStr = rate ? ` at ₹${Number(rate).toLocaleString("en-IN")}` : "";
    if (action === "create") return `${user} added a new worker: ${name}${payStr}${rateStr}.`;
    if (action === "update") return `${user} updated the profile for worker ${name}.`;
    if (action === "delete") return `${user} removed worker ${name} from the system.`;
  }

  // Worker Documents
  if (table === "worker_documents") {
    const docType = prettyStr(n.doc_type || o.doc_type) || "document";
    const fileName = n.file_name || o.file_name || "";
    if (action === "upload_document") return `${user} uploaded a ${docType}${fileName ? ` (${fileName})` : ""}.`;
    if (action === "delete_document") return `${user} deleted a ${docType}${fileName ? ` (${fileName})` : ""}.`;
  }

  // Stage Entries
  if (table === "stage_entries" || table === "production_stage_entries") {
    const stage = n.stage_name || o.stage_name || "a stage";
    const lotNo = n.lot_number || o.lot_number || "";
    const workerName = n.worker_name || o.worker_name || "";
    const qtyIn = n.qty_in ?? o.qty_in;
    const qtyOut = n.qty_out ?? o.qty_out;
    if (action === "create") {
      return `${user} submitted ${stage} entry${lotNo ? ` for Lot #${lotNo}` : ""}${workerName ? ` — Worker: ${workerName}` : ""}.`;
    }
    if (action === "update") {
      return `${user} updated ${stage} entry${lotNo ? ` for Lot #${lotNo}` : ""} (In: ${qtyIn ?? "—"}, Out: ${qtyOut ?? "—"}).`;
    }
    if (action === "delete") return `${user} deleted a ${stage} entry${lotNo ? ` from Lot #${lotNo}` : ""}.`;
  }

  // Lot Production Stages
  if (table === "lot_production_stages") {
    const stage = n.stage_name || o.stage_name || "a stage";
    if (action === "add_lot_stage") return `${user} added the "${stage}" stage to the production lot.`;
    if (action === "update") return `${user} updated stage "${stage}" configuration.`;
  }

  // Production Lots
  if (table === "production_lots") {
    const lotNo = n.lot_number || o.lot_number || "";
    const qty = n.total_quantity || o.total_quantity;
    const label = lotNo ? `Lot #${lotNo}` : "a production lot";
    if (action === "create") return `${user} created Production ${label}${qty ? ` with quantity ${qty}` : ""}.`;
    if (action === "update") return `${user} updated Production ${label}.`;
    if (action === "delete") return `${user} cancelled/deleted Production ${label}.`;
    if (action === "complete_lot") return `${user} marked Production ${label} as Completed.`;
  }

  // Raw Material Purchases
  if (table === "raw_material_purchases") {
    const invNo = n.supplier_bill_no || n.invoice_number || o.supplier_bill_no || o.invoice_number || "";
    const total = n.bill_amount || n.grand_total || o.bill_amount || o.grand_total;
    const label = invNo ? `Invoice #${invNo}` : "a purchase invoice";
    if (action === "create") return `${user} created Purchase ${label}${total ? ` for ₹${Number(total).toLocaleString("en-IN")}` : ""}.`;
    if (action === "update") return `${user} updated Purchase ${label}.`;
    if (action === "cancel") return `${user} cancelled Purchase ${label}.`;
  }

  // Sale Bills
  if (table === "sale_bills") {
    const billNo = n.bill_number || o.bill_number || "";
    const total = n.grand_total || o.grand_total;
    const label = billNo ? `Bill #${billNo}` : "a sale bill";
    if (action === "create") return `${user} created Sale ${label}${total ? ` for ₹${Number(total).toLocaleString("en-IN")}` : ""}.`;
    if (action === "update") return `${user} updated Sale ${label}.`;
    if (action === "cancel") return `${user} cancelled Sale ${label}.`;
  }

  // Payments (received from customer)
  if (table === "payments") {
    const amt = n.amount || o.amount;
    const mode = prettyStr(n.payment_mode || o.payment_mode);
    const dir = n.direction || o.direction;
    const dirLabel = dir === "received" ? "received" : "outgoing";
    if (action === "create") {
      return `${user} recorded a ${dirLabel} payment of ₹${Number(amt || 0).toLocaleString("en-IN")}${mode ? ` via ${mode}` : ""}.`;
    }
  }

  // Job Work Payments
  if (table === "job_work_payments") {
    const amt = n.amount || n.total_amount || o.amount || o.total_amount;
    const mode = prettyStr(n.payment_mode || o.payment_mode);
    if (action === "record_payment") {
      return `${user} recorded a job work payment of ₹${Number(amt || 0).toLocaleString("en-IN")}${mode ? ` via ${mode}` : ""}.`;
    }
  }

  // Users
  if (table === "users") {
    const name = n.full_name || o.full_name || "a user";
    const role = prettyStr(n.role || o.role);
    if (action === "create") return `${user} invited ${name} as a new ${role || "user"}.`;
    if (action === "update") return `${user} updated account settings for ${name}.`;
    if (action === "deactivate") return `${user} deactivated user ${name}.`;
    if (action === "activate") return `${user} reactivated user ${name}.`;
  }

  // Credit Notes
  if (table === "credit_notes") {
    const cnNo = n.cn_number || o.cn_number || "";
    if (action === "delete_credit_note") return `${user} deleted Credit Note${cnNo ? ` #${cnNo}` : ""}.`;
  }

  // Sales Returns
  if (table === "sales_returns") {
    const retNo = n.return_number || o.return_number || "";
    if (action === "delete_sales_return") return `${user} deleted Sales Return${retNo ? ` #${retNo}` : ""}.`;
  }

  // Purchase Returns
  if (table === "purchase_returns") {
    const retNo = n.return_number || o.return_number || "";
    if (action === "cancel_purchase_return") return `${user} cancelled Purchase Return${retNo ? ` #${retNo}` : ""}.`;
  }

  // Purchase Bills
  if (table === "purchase_bills") {
    const billNo = n.bill_number || o.bill_number || "";
    if (action === "cancel_purchase_bill") return `${user} cancelled Purchase Bill${billNo ? ` #${billNo}` : ""}.`;
  }

  // Stock Integrity & Watchdog
  if (table === "stock_integrity" || table === "stock_integrity_logs") {
    const found = n.discrepancies_found ?? 0;
    const fixed = n.discrepancies_fixed ?? 0;
    if (found === 0) {
      return `${user} ran a Stock Integrity Audit — All finished stock and raw materials are 100% synchronized with transaction ledgers.`;
    }
    return `${user} ran a Stock Integrity Audit — Detected ${found} stock discrepancy(s) and auto-reconciled ${fixed} item(s) to ground truth.`;
  }

  // Raw Material Types
  if (table === "raw_material_types") {
    const name = n.name || o.name || "a raw material type";
    if (action === "delete_raw_material_type") return `${user} deleted raw material type "${name}".`;
  }

  // Generic readable fallback
  const actionLabel = prettyStr(action);
  const tableLabel = prettyStr(table);
  return `${user} performed "${actionLabel}" on ${tableLabel}.`;
}

// ─── Keys to always hide (system / UUID / sensitive / raw blobs) ──────────────
const IGNORED_KEYS = new Set([
  // System / audit metadata
  "id", "business_id", "created_at", "updated_at", "deleted_at",
  "created_by", "updated_by", "description",
  // UUID foreign keys — companion *_name fields are shown instead
  "worker_id", "stage_id", "lot_id", "lot_stage_id", "lot_production_stage_id",
  "party_id", "design_id", "godown_id", "material_id",
  "bank_account_id", "upi_id", "uploaded_by", "template_id",
  "stage_entry_id", "accessory_id", "lot_accessory_id",
  // Raw blobs / heavy nested objects — meaningless in audit view
  "design_reference_photos", "custom_qa", "accessories",
  "spec_values", "attachments",
  // Storage paths
  "file_url",
  // Sensitive banking
  "account_number", "ifsc_code",
  // Redundant technical fields
  "payment_cycle",
]);

export default function AuditLogsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filtering states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedModule, setSelectedModule] = useState("All Modules");
  const [selectedUser, setSelectedUser] = useState("All Users");
  const [selectedAction, setSelectedAction] = useState("All Actions");

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Active dropdown & Detail modal
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  // Navigate to entity route and close modal — using router.push after close
  // to avoid @base-ui Dialog cancelling the navigation event
  const navigateToEntity = useCallback((url: string) => {
    setDetailModalOpen(false);
    setTimeout(() => router.push(url), 50);
  }, [router]);

  const handleRunStockSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/cron/stock-integrity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run stock integrity sync");

      const found = data.integrity_report?.discrepancies_found ?? 0;
      const fixed = data.integrity_report?.discrepancies_fixed ?? 0;
      if (found === 0) {
        toast.success("✅ Stock is 100% synchronized! No discrepancies found.");
      } else {
        toast.success(`⚡ Stock audit complete: ${found} checked, ${fixed} auto-fixed.`);
      }
      fetchLogs(1, limit);
    } catch (err: any) {
      toast.error(err.message || "Failed to run stock audit");
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch Users for filters
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/settings/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.warn("Could not fetch user filters:", err);
    }
  };

  // Fetch Logs
  const fetchLogs = async (currentPage = page, currentLimit = limit) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentLimit),
      });

      if (fromDate) query.append("fromDate", fromDate);
      if (toDate) query.append("toDate", toDate);
      if (selectedModule !== "All Modules") query.append("module", selectedModule);
      if (selectedUser !== "All Users") query.append("userId", selectedUser);
      if (selectedAction !== "All Actions") query.append("action", selectedAction);

      const res = await fetch(`/api/settings/audit-logs?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();

      setLogs(data.logs || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      toast.error(err.message || "Error loading audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLogs(1, limit);
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    fetchLogs(1, limit);
  };

  const handleResetFilters = () => {
    setFromDate("");
    setToDate("");
    setSelectedModule("All Modules");
    setSelectedUser("All Users");
    setSelectedAction("All Actions");
    setPage(1);
    
    setTimeout(() => {
      fetchLogs(1, limit);
    }, 50);
  };

  const handleExport = () => {
    const query = new URLSearchParams();
    if (fromDate) query.append("fromDate", fromDate);
    if (toDate) query.append("toDate", toDate);
    if (selectedModule !== "All Modules") query.append("module", selectedModule);
    if (selectedUser !== "All Users") query.append("userId", selectedUser);
    if (selectedAction !== "All Actions") query.append("action", selectedAction);

    window.open(`/api/settings/audit-logs/export?${query.toString()}`, "_blank");
    toast.success("Audit logs CSV export started");
  };

  const openLogDetails = (log: AuditLog) => {
    setActiveMenuId(null);
    setSelectedLog(log);
    setShowAllFields(false);
    setDetailModalOpen(true);
  };

  const getAvatarBg = (name: string) => {
    const colors = [
      "bg-[#6366F1]",
      "bg-[#0EA5E9]",
      "bg-[#10B981]",
      "bg-[#F59E0B]",
      "bg-[#EF4444]",
      "bg-[#8B5CF6]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const getInitials = (name?: string) => {
    if (!name || typeof name !== "string") return "US";
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "US";
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    fetchLogs(1, newLimit);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage, limit);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;


  // ─── Action-aware display logic ──────────────────────────────────────────────
  const logAction = (selectedLog?.action || "").toLowerCase();
  const isCreateLike = ["create", "upload_document", "record_payment", "add_lot_stage"].includes(logAction);
  const isDeleteLike = [
    "delete", "delete_document", "delete_credit_note", "delete_sales_return",
    "cancel_purchase_return", "cancel_purchase_bill", "cancel", "delete_raw_material_type",
  ].includes(logAction);
  const isUpdateLike = !isCreateLike && !isDeleteLike;


  const oldVals = selectedLog?.old_values || {};
  const newVals = selectedLog?.new_values || {};
  // For create: use new_values; for delete: use old_values; for update: diff of both
  const sourceVals = isDeleteLike ? oldVals : newVals;

  const baseKeys = isUpdateLike
    ? Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]))
    : Object.keys(sourceVals);

  const displayKeys = baseKeys.filter((key) => {
    if (IGNORED_KEYS.has(key.toLowerCase())) return false;
    const val = sourceVals[key];
    // For create/delete: by default, skip fields that are null/undefined/empty-array
    if (!showAllFields && (isCreateLike || isDeleteLike)) {
      if (val === null || val === undefined || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
    }
    // For update: by default show only changed fields
    if (!showAllFields && isUpdateLike) {
      return JSON.stringify(oldVals[key]) !== JSON.stringify(newVals[key]);
    }
    return true;
  });

  const entityRoute = selectedLog ? getEntityRoute(selectedLog) : null;
  const summarySentence = selectedLog ? getSummarySentence(selectedLog) : "";

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SettingsPageHeader
          section="Audit Logs"
          title="Settings > Audit Logs"
          subtitle="Track system changes, user activities, and stock integrity audits"
          actionLabel="Export Logs"
          onAction={handleExport}
          actionIcon={<Download className="size-4 text-[var(--text-body)]" />}
          actionOutline
        />
      </div>

      {/* QUICK STOCK INTEGRITY AUDIT BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Stock Integrity & Auto-Reconciliation</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Cross-checks physical finished stock against independent stock ledgers and auto-repairs discrepancies.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isSyncing}
          onClick={handleRunStockSync}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Auditing Stock..." : "Run Stock Integrity Audit"}
        </button>
      </div>

      {/* FILTER CARD */}
      <SettingsCard icon={Filter} title="Filter Audit Logs">
        <div className="flex flex-col gap-4 select-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Filter 1 — Date Range */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] w-full transition-colors"
                  />
                </div>
                <span className="text-[var(--text-faint)]">-</span>
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] w-full transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Filter 2 — Module */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-body)] block mb-1.5">
                Module
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer transition-colors"
              >
                <option value="All Modules">All Modules</option>
                <option value="stock_integrity">Stock Integrity & Sync</option>
                <option value="raw_material_purchases">Purchases</option>
                <option value="sale_bills">Sales & Billing</option>
                <option value="production_lots">Production Lots</option>
                <option value="stage_entries">Production Stage Entries</option>
                <option value="workers">Workers</option>
                <option value="users">Users & Roles</option>
                <option value="payments">Payments</option>
                <option value="parties">Parties</option>
              </select>
            </div>

            {/* Filter 3 — User */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-body)] block mb-1.5">
                User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer transition-colors"
              >
                <option value="All Users">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4 — Action */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-body)] block mb-1.5">
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer transition-colors"
              >
                <option value="All Actions">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="cancel">Cancel</option>
                <option value="complete_lot">Complete Lot</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="h-10 px-4 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleApplyFilters}
              className="h-10 px-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* AUDIT LOG TABLE CARD */}
      <SettingsCard
        icon={SlidersHorizontal}
        title="Audit Logs"
        subtitle="View all system activities and changes"
        headerRight={
          <div className="flex items-center gap-2 select-none">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Show</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="h-9 px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] w-20 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs font-semibold text-[var(--text-muted)]">entries</span>
          </div>
        }
      >
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg mb-4 select-none">
          <table className="w-full text-sm text-[var(--text-body)]">
            <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-11">
              <tr>
                <th className="px-4 py-2 text-left w-[150px]">Date & Time</th>
                <th className="px-4 py-2 text-left w-[180px]">User</th>
                <th className="px-4 py-2 text-left w-[150px]">Module</th>
                <th className="px-4 py-2 text-left w-[120px]">Action</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left w-[130px]">IP Address</th>
                <th className="px-4 py-2 text-center w-[60px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[var(--text-faint)]">
                    Loading audit activities...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[var(--text-faint)] italic">
                    No logs found matching search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const userName = log.user_name || log.users?.full_name || "System";
                  const desc = getSummarySentence(log);
                  const formattedDate = new Date(log.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const formattedTime = new Date(log.created_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });

                  return (
                    <tr
                      key={log.id}
                      onClick={() => openLogDetails(log)}
                      className="hover:bg-[var(--table-row-hover)] h-14 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2 text-xs text-[var(--text-primary)]">
                        <div className="leading-relaxed">
                          <span className="font-semibold block">{formattedDate}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formattedTime}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarBg(
                              userName
                            )}`}
                          >
                            {getInitials(userName)}
                          </div>
                          <span className="truncate max-w-[120px]">{userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ModuleBadge module={log.table_name} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 text-[var(--text-body)] max-w-[250px] truncate font-medium" title={desc}>
                        {desc}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === log.id ? null : log.id)}
                          className="w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--page-bg)] inline-flex items-center justify-center transition-colors text-[var(--text-muted)] cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {activeMenuId === log.id && (
                          <div className="absolute right-4 mt-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-lg z-10 w-36 py-1 select-none text-left">
                            <button
                              type="button"
                              onClick={() => openLogDetails(log)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="size-3.5" />
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                toast.info("Audit log ID copied to clipboard");
                                navigator.clipboard.writeText(log.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] flex items-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="size-3.5" />
                              Copy Entry ID
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 select-none">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Showing {Math.min((page - 1) * limit + 1, totalCount)} to{" "}
            {Math.min(page * limit, totalCount)} of {totalCount} entries
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] inline-flex items-center justify-center hover:bg-[var(--table-row-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              const isCurrent = page === pNum;
              return (
                <button
                  key={pNum}
                  onClick={() => handlePageChange(pNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold inline-flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] inline-flex items-center justify-center hover:bg-[var(--table-row-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <InfoBanner
          variant="info"
          text="Audit logs are retained for 180 days. You can export logs for further analysis."
          className="mt-4"
        />
      </SettingsCard>

      {/* AUDIT LOG DETAIL MODAL */}
      <Modal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        title="Activity Summary"
        maxWidth="max-w-3xl"
      >
        {selectedLog && (
          <div className="flex flex-col gap-5 mt-1 select-none">
            {/* Business English Activity Summary Banner */}
            <div className="p-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-light)]/40 text-[var(--text-primary)] flex items-start gap-3">
              <Sparkles className="size-5 text-[var(--primary)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs uppercase font-bold text-[var(--primary)] tracking-wider mb-1">
                  Activity Summary
                </h4>
                <p className="text-sm font-medium leading-relaxed">
                  {summarySentence}
                </p>
              </div>
            </div>

            {/* Header Badge Strip & Entity Link CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)]">
              <div className="flex items-center gap-2.5">
                <ActionBadge action={selectedLog.action} />
                <ModuleBadge module={selectedLog.table_name} />
              </div>

              {entityRoute && (
                <button
                  type="button"
                  onClick={() => navigateToEntity(entityRoute.url)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <span>{entityRoute.label}</span>
                  <ExternalLink className="size-3.5" />
                </button>
              )}
            </div>

            {/* General Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                  <UserCheck className="size-3.5 text-[var(--primary)]" />
                  <span>Performed By</span>
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {selectedLog.user_name || selectedLog.users?.full_name || "System"}
                </span>
                {selectedLog.users?.email && (
                  <span className="text-xs text-[var(--text-faint)] truncate">
                    {selectedLog.users.email}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                  <Globe className="size-3.5 text-[var(--primary)]" />
                  <span>IP Address</span>
                </div>
                <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">
                  {selectedLog.ip_address || "—"}
                </span>
                <span className="text-xs text-[var(--text-faint)]">
                  {!selectedLog.ip_address || selectedLog.ip_address === "127.0.0.1" || selectedLog.ip_address === "::1"
                    ? "Localhost / not captured"
                    : "Captured"}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                  <Monitor className="size-3.5 text-[var(--primary)]" />
                  <span>Timestamp</span>
                </div>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {new Date(selectedLog.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            </div>

            {/* Changes Diff Table Header */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[var(--primary)]" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  {isUpdateLike ? "Changed Fields" : isDeleteLike ? "Deleted Record" : "Record Details"}
                </h4>
                <span className="text-xs text-[var(--text-muted)]">
                  ({displayKeys.length} {displayKeys.length === 1 ? "field" : "fields"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllFields(!showAllFields)}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {showAllFields
                  ? isUpdateLike ? "Show Changed Only" : "Hide Empty Fields"
                  : isUpdateLike ? "Show All Fields" : "Show All Fields (incl. empty)"}
              </button>
            </div>

            {/* Action-aware diff table */}
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-[var(--text-body)]">
                <thead className="bg-[var(--table-header-bg)] font-semibold text-[var(--text-muted)] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left w-[200px]">Field</th>
                    {isUpdateLike ? (
                      <>
                        <th className="px-4 py-2.5 text-left">Before</th>
                        <th className="px-4 py-2.5 text-left">After</th>
                      </>
                    ) : (
                      <th className="px-4 py-2.5 text-left">
                        {isDeleteLike ? "Deleted Value" : "Value"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {displayKeys.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isUpdateLike ? 3 : 2}
                        className="text-center py-6 text-[var(--text-faint)] italic"
                      >
                        {isUpdateLike
                          ? "No changed fields detected. Click \"Show All Fields\" to see all properties."
                          : "No detail fields available for this log entry."}
                      </td>
                    </tr>
                  ) : (
                    displayKeys.map((key) => {
                      if (isUpdateLike) {
                        const oldVal = oldVals[key];
                        const newVal = newVals[key];
                        const isDifferent = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                        return (
                          <tr
                            key={key}
                            className={`transition-colors ${
                              isDifferent ? "bg-[var(--primary-light)]/20" : "hover:bg-[var(--table-row-hover)]"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">
                              {getFieldLabel(key)}
                            </td>
                            <td className="px-4 py-2.5 text-[var(--text-muted)]">
                              {formatValue(key, oldVal)}
                            </td>
                            <td className="px-4 py-2.5">
                              {isDifferent ? (
                                <span className="font-semibold text-[var(--primary)]">
                                  {formatValue(key, newVal)}
                                </span>
                              ) : (
                                <span className="text-[var(--text-body)]">
                                  {formatValue(key, newVal)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      } else {
                        // Create or Delete — single value column
                        const val = sourceVals[key];
                        return (
                          <tr
                            key={key}
                            className="hover:bg-[var(--table-row-hover)] transition-colors"
                          >
                            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">
                              {getFieldLabel(key)}
                            </td>
                            <td className={`px-4 py-2.5 font-medium ${
                              isDeleteLike
                                ? "text-red-500/80"
                                : "text-[var(--text-body)]"
                            }`}>
                              {formatValue(key, val)}
                            </td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] pt-4 mt-1 flex items-center justify-between gap-2">
              {entityRoute ? (
                <button
                  type="button"
                  onClick={() => navigateToEntity(entityRoute.url)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  <span>Open target record detail page</span>
                  <ArrowRight className="size-3.5" />
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="h-9 px-4 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
