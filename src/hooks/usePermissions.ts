import { useQuery } from "@tanstack/react-query";
import { useRole } from "./useRole";

export interface RolePermission {
  id?: string;
  business_id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
}

export function usePermissions() {
  const role = useRole();

  const query = useQuery<{ permissions: RolePermission[] }>({
    queryKey: ["settings", "permissions", role],
    queryFn: async () => {
      const res = await fetch("/api/settings/permissions");
      if (!res.ok) {
        throw new Error("Failed to load permissions");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!role,
  });

  const permissionsList = query.data?.permissions || [];

  const getModulePermission = (moduleName: string): RolePermission | null => {
    if (!role) return null;
    // Only 'owner' (business creator/superuser) bypasses permission matrix
    if (role === "owner") {
      return {
        business_id: "",
        role,
        module: moduleName,
        can_view: true,
        can_add: true,
        can_edit: true,
        can_delete: true,
        can_approve: true,
        can_export: true,
      };
    }

    const found = permissionsList.find(
      (p) => p.role === role && p.module.toLowerCase() === moduleName.toLowerCase()
    );

    return found || null;
  };

  return {
    ...query,
    permissions: permissionsList,
    getModulePermission,
    canView: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      if (!perm) {
        // If permissions list is still loading, allow view to avoid UI flicker
        if (query.isLoading) return true;
        return false;
      }
      return perm.can_view;
    },
    canAdd: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      return perm ? perm.can_add : false;
    },
    canEdit: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      return perm ? perm.can_edit : false;
    },
    canDelete: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      return perm ? perm.can_delete : false;
    },
    canApprove: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      return perm ? perm.can_approve : false;
    },
    canExport: (moduleName: string) => {
      if (role === "owner") return true;
      const perm = getModulePermission(moduleName);
      return perm ? perm.can_export : false;
    },
  };
}
