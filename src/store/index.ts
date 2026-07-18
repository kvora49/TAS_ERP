import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  selectedBusinessId: string | null;
  setSelectedBusinessId: (id: string | null) => void;

  user: {
    id: string;
    email: string;
    fullName: string;
    role: "owner" | "admin" | "manager" | "accountant" | "staff" | "intern";
    businessId: string;
  } | null;
  setUser: (user: AppState["user"]) => void;

  filters: {
    brandId: string; // "all" or specific brand UUID
    dateRange: string; // "this_month", "last_month", "last_3_months", etc.
  };
  setFilters: (filters: Partial<AppState["filters"]>) => void;

  navigatingTo: string | null;
  setNavigatingTo: (path: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  selectedBusinessId: null,
  setSelectedBusinessId: (id) => set({ selectedBusinessId: id }),

  user: null,
  setUser: (user) => set({ user }),

  filters: {
    brandId: "all",
    dateRange: "this_month",
  },
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  navigatingTo: null,
  setNavigatingTo: (navigatingTo) => set({ navigatingTo }),
}));
