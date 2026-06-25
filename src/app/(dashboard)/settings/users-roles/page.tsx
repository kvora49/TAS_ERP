"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserCircle,
  Settings2,
  UserPlus,
  Search,
  MoreVertical,
  ChevronRight,
  Eye,
  EyeOff,
  Shield,
  Trash2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

interface Permission {
  id?: string;
  role: string;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
}

const MODULES = [
  "Dashboard",
  "Master Data",
  "Raw Materials",
  "Production",
  "Sales & Billing",
  "Reports",
  "Expenses",
];

export default function UsersRolesSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Search & Filter
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserRole, setNewUserRole] = useState("manager");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [addingUser, setAddingUser] = useState(false);

  // Edit / Dropdown actions
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Permissions Matrix States
  const [selectedRole, setSelectedRole] = useState("manager");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const query = new URLSearchParams();
      if (roleFilter !== "all") query.append("role", roleFilter);
      if (search) query.append("search", search);

      const res = await fetch(`/api/settings/users?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Permissions
  const fetchPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const res = await fetch("/api/settings/permissions");
      if (!res.ok) throw new Error("Failed to load permissions");
      const data = await res.json();
      setPermissions(data.permissions || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading permissions");
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, search]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast.error("Please fill in all required fields (*)");
      return;
    }

    setAddingUser(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          phone: newUserPhone,
          role: newUserRole,
          password: newUserPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add user");

      toast.success("User added successfully");
      setAddModalOpen(false);
      
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPhone("");
      setNewUserRole("manager");
      setNewUserPassword("");
      
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Error creating user");
    } finally {
      setAddingUser(false);
    }
  };

  // Deactivate / Toggle Status
  const handleToggleStatus = async (user: User) => {
    setActiveMenuId(null);
    const action = user.is_active ? "deactivate" : "activate";
    
    try {
      const res = await fetch(`/api/settings/users/${user.id}/deactivate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user status");

      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Error updating user status");
    }
  };

  // Checkbox matrix toggle handler
  const handlePermissionChange = (module: string, field: keyof Permission, checked: boolean) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === selectedRole && p.module === module) {
          return { ...p, [field]: checked };
        }
        return p;
      })
    );
  };

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      const res = await fetch("/api/settings/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save permissions");

      toast.success("Permissions matrix saved successfully");
      fetchPermissions();
    } catch (err: any) {
      toast.error(err.message || "Error saving permissions matrix");
    } finally {
      setSavingPermissions(false);
    }
  };

  // Initials color generation
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

  // Get active role matrix permissions rows
  const filteredPermissions = permissions.filter((p) => p.role === selectedRole);

  // Helper to get permission value safely
  const getPermVal = (moduleName: string, field: keyof Permission): boolean => {
    const row = filteredPermissions.find((p) => p.module === moduleName);
    return row ? !!row[field] : false;
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Users & Roles"
        title="Settings > Users & Roles"
        subtitle="Manage users, roles and permissions"
        actionLabel="Add User"
        onAction={() => setAddModalOpen(true)}
        actionIcon={<UserPlus className="size-4 text-white" />}
      />

      {/* CARD 1 — Users List */}
      <SettingsCard
        icon={UserCircle}
        title="Users"
        subtitle="View and manage system users"
      >
        {/* Search & Filter row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4 select-none">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-[180px] h-10 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="accountant">Accountant</option>
            <option value="staff">Store Incharge</option>
            <option value="intern">Production User</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border border-[#F3F4F6] rounded-lg">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Last Login</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {loadingUsers ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 font-semibold">
                    Loading users list...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                    No users found matching filters
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-[#0F172A]">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${getAvatarBg(
                            u.full_name
                          )}`}
                        >
                          {getInitials(u.full_name)}
                        </div>
                        <span>{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge active={u.is_active} />
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                        className="w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 inline-flex items-center justify-center transition-colors"
                      >
                        <MoreVertical className="size-4 text-[#64748B]" />
                      </button>
                      {activeMenuId === u.id && (
                        <div className="absolute right-4 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 w-36 py-1">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold ${
                              u.is_active
                                ? "text-[#DC2626] hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {/* CARD 2 — Role Permissions Matrix */}
      <SettingsCard
        icon={Settings2}
        title="Role Permissions Matrix"
        subtitle="Define permissions for the selected role"
        headerRight={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#64748B]">Select Role</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="accountant">Accountant</option>
              <option value="staff">Store Incharge</option>
              <option value="intern">Production User</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto border border-[#F3F4F6] rounded-lg mb-4">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
              <tr>
                <th className="px-4 py-3 text-left w-[200px]">Module</th>
                <th className="px-4 py-3 text-center">View</th>
                <th className="px-4 py-3 text-center">Add</th>
                <th className="px-4 py-3 text-center">Edit</th>
                <th className="px-4 py-3 text-center">Delete</th>
                <th className="px-4 py-3 text-center">Approve</th>
                <th className="px-4 py-3 text-center">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {loadingPermissions ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    Loading permissions matrix...
                  </td>
                </tr>
              ) : (
                MODULES.map((module) => (
                  <tr key={module} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3.5 font-medium text-[#374151] text-left">
                      {module}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_view")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_view", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_add")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_add", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_edit")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_edit", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_delete")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_delete", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_approve")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_approve", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_export")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_export", !!val)
                          }
                          className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Action Button inside card */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSavePermissions}
            disabled={savingPermissions}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-xs h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-[var(--shadow-sm)] disabled:opacity-50"
          >
            <Check className="size-4 shrink-0" />
            {savingPermissions ? "Saving Matrix..." : "Save Permissions Matrix"}
          </button>
        </div>

        <InfoBanner
          variant="info"
          text="Permissions define what actions a role can perform across modules. Changes will apply to all users under this role."
          className="mt-4"
        />
      </SettingsCard>

      {/* ADD USER DIALOG MODAL */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg w-full bg-white rounded-2xl p-6 text-left shadow-xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center">
              <UserPlus className="size-6 text-[#6366F1]" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#0F172A] mt-4">
              Add New User
            </DialogTitle>
            <p className="text-sm text-[#64748B] mt-1">
              Invite a team member to join TAS ERP
            </p>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="flex flex-col gap-4 mt-4">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Full Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Email Address <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                placeholder="e.g. john@company.com"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                placeholder="e.g. +91 9999999999"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Role <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="staff">Store Incharge</option>
                <option value="intern">Production User</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Temporary Password <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[#F3F4F6] mt-2">
              <span className="text-sm font-semibold text-[#374151]">
                Send Welcome Email
              </span>
              <Checkbox
                checked={sendWelcomeEmail}
                onCheckedChange={(val) => setSendWelcomeEmail(!!val)}
                className="w-5 h-5 rounded data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
              />
            </div>

            <DialogFooter className="border-t border-[#F3F4F6] pt-4 mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingUser}
                className="h-10 px-4 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center"
              >
                {addingUser ? "Adding User..." : "Add User"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
