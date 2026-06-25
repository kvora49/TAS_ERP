"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { ActionBadge } from "@/components/shared/ActionBadge";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  SlidersHorizontal,
  Download,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  created_at: string;
  user_name: string | null;
  table_name: string;
  action: string;
  new_values: any;
  ip_address: string | null;
  users?: {
    full_name: string;
    email: string;
  };
}

interface User {
  id: string;
  full_name: string;
}

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

  // Active dropdown menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
    
    // Fetch logs with clean filters
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

    // Redirect to CSV route trigger
    window.open(`/api/settings/audit-logs/export?${query.toString()}`, "_blank");
    toast.success("Audit logs CSV export started");
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
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

  // Helper pagination rendering
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Audit Logs"
        title="Settings > Audit Logs"
        subtitle="Track system changes and user activities"
        actionLabel="Export Logs"
        onAction={handleExport}
        actionIcon={<Download className="size-4 text-[#374151]" />}
        actionOutline
      />

      {/* FILTER CARD */}
      <SettingsCard icon={Filter} title="Filter Audit Logs">
        <div className="flex flex-col gap-4 select-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Filter 1 — Date Range */}
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 px-2 rounded-lg border border-[#D1D5DB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1] w-full"
                  />
                </div>
                <span className="text-[#94A3B8]">-</span>
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 px-2 rounded-lg border border-[#D1D5DB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1] w-full"
                  />
                </div>
              </div>
            </div>

            {/* Filter 2 — Module */}
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Module
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="All Modules">All Modules</option>
                <option value="Brands">Brands</option>
                <option value="Godowns">Godowns</option>
                <option value="Designs">Designs</option>
                <option value="users">Users</option>
                <option value="business_settings">Settings</option>
                <option value="production_stages">Production</option>
              </select>
            </div>

            {/* Filter 3 — User */}
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
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
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="All Actions">All Actions</option>
                <option value="Create">Create</option>
                <option value="Update">Update</option>
                <option value="Delete">Delete</option>
                <option value="Login">Login</option>
                <option value="Logout">Logout</option>
                <option value="Export">Export</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold cursor-pointer shadow-sm"
            >
              Reset
            </button>
            <button
              onClick={handleApplyFilters}
              className="h-10 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold cursor-pointer shadow-sm"
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
            <span className="text-xs font-semibold text-[#64748B]">Show</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="h-9 px-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6366F1] w-20"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs font-semibold text-[#64748B]">entries</span>
          </div>
        }
      >
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg mb-4">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
              <tr>
                <th className="px-4 py-2 text-left w-[150px]">Date & Time</th>
                <th className="px-4 py-2 text-left w-[180px]">User</th>
                <th className="px-4 py-2 text-left w-[150px]">Module</th>
                <th className="px-4 py-2 text-left w-[120px]">Action</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left w-[120px]">IP Address</th>
                <th className="px-4 py-2 text-center w-[50px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    Loading audit activities...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                    No logs found matching search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const userName = log.user_name || log.users?.full_name || "System";
                  const desc = log.new_values?.description || `${log.action} in ${log.table_name}`;
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
                    <tr key={log.id} className="hover:bg-slate-50/50 h-14">
                      <td className="px-4 py-2 text-xs text-[#374151]">
                        <div className="leading-relaxed">
                          <span className="font-semibold block">{formattedDate}</span>
                          <span className="text-[10px] text-[#94A3B8]">{formattedTime}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-medium text-[#374151]">
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
                      <td className="px-4 py-2">
                        <ModuleBadge module={log.table_name} />
                      </td>
                      <td className="px-4 py-2">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-2 text-[#374151] max-w-[250px] truncate" title={desc}>
                        {desc}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[#64748B]">
                        {log.ip_address || "127.0.0.1"}
                      </td>
                      <td className="px-4 py-2 text-center relative">
                        <button
                          onClick={() =>
                            setActiveMenuId(activeMenuId === log.id ? null : log.id)
                          }
                          className="w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 inline-flex items-center justify-center transition-colors"
                        >
                          <MoreVertical className="size-4 text-[#64748B]" />
                        </button>
                        {activeMenuId === log.id && (
                          <div className="absolute right-4 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 w-28 py-1 select-none">
                            <button
                              onClick={() => {
                                toast.info("Audit log ID copied to clipboard");
                                navigator.clipboard.writeText(log.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-50 text-slate-700"
                            >
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
          <span className="text-xs text-[#64748B] font-medium">
            Showing {Math.min((page - 1) * limit + 1, totalCount)} to{" "}
            {Math.min(page * limit, totalCount)} of {totalCount} entries
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white inline-flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className={`w-8 h-8 rounded-lg text-xs font-bold inline-flex items-center justify-center transition-all ${
                    isCurrent
                      ? "bg-[#6366F1] text-white shadow-sm"
                      : "border border-[#E5E7EB] bg-white hover:bg-slate-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white inline-flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
    </div>
  );
}
