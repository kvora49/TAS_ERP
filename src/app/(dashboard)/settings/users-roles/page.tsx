"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
import { usePermissions } from "@/hooks/usePermissions";
import { APP_MODULES } from "@/components/layout/Sidebar/navigation.config";
import {
  UserCircle,
  Settings2,
  UserPlus,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
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

const MODULES = APP_MODULES;

export default function UsersRolesSettingsPage() {
  const { canAdd, canEdit } = usePermissions();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

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

  // Edit / Dropdown actions
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Permissions Matrix States
  const [selectedRole, setSelectedRole] = useState("manager");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUserError(null);
    try {
      const query = new URLSearchParams();
      if (roleFilter !== "all") query.append("role", roleFilter);
      if (search) query.append("search", search);

      const res = await fetch(`/api/settings/users?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: Failed to load users`);
      setUsers(data.users || []);
    } catch (err: any) {
      setUserError(err.message || "Error loading users");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: Failed to load permissions`);
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
  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast.error("Please fill in all required fields (*)");
      return;
    }

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
      throw err;
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
  const handlePermissionChange = (moduleName: string, field: keyof Permission, checked: boolean) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === selectedRole && p.module.toLowerCase() === moduleName.toLowerCase()) {
          return { ...p, [field]: checked };
        }
        return p;
      })
    );
  };

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
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
      throw err;
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
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "US"
    );
  };

  const filteredPermissions = permissions.filter((p) => p.role === selectedRole);

  const getPermVal = (moduleName: string, field: keyof Permission): boolean => {
    const row = filteredPermissions.find(
      (p) => p.module.toLowerCase() === moduleName.toLowerCase()
    );
    return row ? !!row[field] : false;
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Users & Roles"
        title="Settings > Users & Roles"
        subtitle="Manage users, roles and permissions"
        actionLabel={canAdd("Settings") ? "Add User" : undefined}
        onAction={canAdd("Settings") ? () => setAddModalOpen(true) : undefined}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-[180px] h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
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
        <PageState
          isLoading={loadingUsers}
          isError={!!userError}
          error={userError || undefined}
          onRetry={fetchUsers}
          isEmpty={users.length === 0}
          skeletonVariant="table"
          skeletonRows={4}
          skeletonColumns={6}
          emptyTitle="No users found"
          emptyDescription="No system users match the current search or role filters."
        >
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm text-[var(--text-body)]">
              <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
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
                    <td className="px-4 py-3 text-[var(--text-muted)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge active={u.is_active} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
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
                      {canEdit("Settings") ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                            className="w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                          {activeMenuId === u.id && (
                            <div className="absolute right-4 mt-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-lg z-10 w-36 py-1 select-none">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer ${
                                  u.is_active
                                    ? "text-red-500 hover:bg-red-500/10"
                                    : "text-green-600 hover:bg-green-500/10"
                                }`}
                              >
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageState>
      </SettingsCard>

      {/* CARD 2 — Role Permissions Matrix */}
      <SettingsCard
        icon={Settings2}
        title="Role Permissions Matrix"
        subtitle="Define permissions for the selected role"
        headerRight={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Select Role</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
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
        <PageState
          isLoading={loadingPermissions}
          skeletonVariant="table"
          skeletonRows={7}
          skeletonColumns={7}
        >
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg mb-4">
            <table className="w-full text-sm text-[var(--text-body)]">
              <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-11">
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
              <tbody className="divide-y divide-[var(--border)]">
                {MODULES.map((module) => (
                  <tr key={module} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="px-4 py-3.5 font-medium text-[var(--text-primary)] text-left">
                      {module}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={getPermVal(module, "can_view")}
                          onCheckedChange={(val) =>
                            handlePermissionChange(module, "can_view", !!val)
                          }
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
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
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
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
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
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
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
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
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
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
                          className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageState>

        {/* Save Button inside card */}
        {canEdit("Settings") && (
          <div className="flex justify-end mb-4">
            <AsyncButton
              onClick={handleSavePermissions}
              variant="primary"
              className="h-9 px-4 text-xs"
            >
              <Check className="size-4 shrink-0 mr-1.5" />
              Save Permissions Matrix
            </AsyncButton>
          </div>
        )}

        <InfoBanner
          variant="info"
          text="Permissions define what actions a role can perform across modules. Changes will apply to all users under this role."
          className="mt-4"
        />
      </SettingsCard>

      {/* ADD USER MODAL */}
      <Modal open={addModalOpen} onOpenChange={setAddModalOpen} title="Add New User" maxWidth="max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddUser();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
              placeholder="e.g. john@company.com"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={newUserPhone}
              onChange={(e) => setNewUserPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
              placeholder="e.g. +91 9999999999"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
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
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                placeholder="Min 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-[var(--border)] mt-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Send Welcome Email
            </span>
            <Checkbox
              checked={sendWelcomeEmail}
              onCheckedChange={(val) => setSendWelcomeEmail(!!val)}
              className="w-5 h-5 rounded border-[var(--border)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
            />
          </div>

          <div className="border-t border-[var(--border)] pt-4 mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="h-10 px-4 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <AsyncButton
              onClick={handleAddUser}
              variant="primary"
              className="h-10 px-4 text-sm"
            >
              Add User
            </AsyncButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
