import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface LotDefect {
  id: string;
  business_id: string;
  lot_id: string;
  defect_number: string;
  defect_date: string;
  detected_at_stage_id?: string;
  defect_category: string;
  quantity: number;
  size_quantities?: Record<string, number>;
  colour_id?: string;
  source?: "in_production" | "post_stock";
  description?: string;
  responsible_worker_id?: string;
  responsible_stage_id?: string;
  status:
    | "pending"
    | "sent_for_rework"
    | "reworked_fixed"
    | "rework_failed"
    | "moved_to_b_grade"
    | "written_off"
    | "resolved";
  created_at: string;
  lot?: {
    id: string;
    lot_number: string;
    lot_name?: string;
    design_id?: string;
    design?: { id: string; name: string; code: string };
    colour?: { id: string; colour_name: string; hex_code: string };
  };
  colour?: {
    id: string;
    colour_name: string;
    hex_code?: string;
    colour_hex?: string;
  };
  responsible_worker?: {
    id: string;
    name: string;
    code: string;
  };
  detected_at_stage?: {
    id: string;
    stage_name: string;
    sequence_no: number;
  };
  responsible_stage?: {
    id: string;
    stage_name: string;
    sequence_no: number;
  };
  resolutions?: Array<{
    id: string;
    resolution_type: string;
    resolution_date: string;
    qty_recovered: number;
    qty_b_grade: number;
    qty_scrapped: number;
    recovered_size_quantities?: Record<string, number>;
    b_grade_size_quantities?: Record<string, number>;
    scrapped_size_quantities?: Record<string, number>;
    rework_cost: number;
    rework_cost_mode?: "free" | "paid_normal" | "paid_custom";
    deduction_amount: number;
    cloth_cost_recovery: number;
    material_write_off_value?: number;
    waste_reason?: string;
    rework_stage_id?: string;
    rework_stage?: { id: string; stage_name: string; sequence_no: number };
    rework_worker_id?: string;
    rework_worker?: { id: string; name: string; code: string };
    target_godown?: { id: string; name: string };
    created_at: string;
  }>;
}

export interface BGradeStockItem {
  id: string;
  business_id: string;
  lot_id?: string;
  design_id: string;
  colour_id?: string;
  godown_id: string;
  size_quantities: Record<string, number>;
  total_quantity: number;
  cost_per_piece: number;
  total_value: number;
  b_grade_sale_price?: number | null;
  status: "available" | "partially_sold" | "fully_sold" | "written_off";
  notes?: string;
  created_at: string;
  design?: { id: string; name: string; design_number: string };
  colour?: { id: string; colour_name: string; colour_hex?: string };
  godown?: { id: string; name: string };
  lot?: { id: string; lot_number: string; lot_name?: string };
  resolution?: {
    id: string;
    resolution_date: string;
    waste_reason?: string;
    rework_cost?: number;
    defect?: { id: string; defect_number: string; defect_category: string; description?: string };
  };
}

export function useLotDefects(lotId?: string, filters?: { status?: string; category?: string; search?: string }) {
  return useQuery({
    queryKey: ["lot-defects", lotId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lotId) params.append("lot_id", lotId);
      if (filters?.status && filters.status !== "all") params.append("status", filters.status);
      if (filters?.category && filters.category !== "all") params.append("category", filters.category);
      if (filters?.search && filters.search.trim()) params.append("search", filters.search.trim());

      const res = await fetch(`/api/production/defects?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch defects");
      }
      return res.json() as Promise<{ defects: LotDefect[] }>;
    },
    enabled: !!lotId,
    staleTime: 10_000,
  });
}

export function useBGradeStock(filters?: { design_id?: string; godown_id?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: ["b-grade-stock", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.design_id) params.append("design_id", filters.design_id);
      if (filters?.godown_id) params.append("godown_id", filters.godown_id);
      if (filters?.status && filters.status !== "all") params.append("status", filters.status);
      if (filters?.search && filters.search.trim()) params.append("search", filters.search.trim());

      const res = await fetch(`/api/production/b-grade-stock?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch B-grade stock");
      }
      return res.json() as Promise<{
        stock: BGradeStockItem[];
        stats: {
          total_quantity: number;
          total_value: number;
          unique_designs: number;
          active_godowns: number;
          godown_breakdown: Array<{ godown_name: string; quantity: number; value: number }>;
          design_breakdown: Array<{ design_id: string; design_code: string; design_name: string; quantity: number; value: number; colours: string[] }>;
          size_breakdown: Array<{ size: string; quantity: number }>;
        };
      }>;
    },
    staleTime: 15_000,
  });
}

export function useWorkerDeductions(workerId?: string) {
  return useQuery({
    queryKey: ["worker-deductions", workerId],
    queryFn: async () => {
      const params = workerId ? `?worker_id=${workerId}` : "";
      const res = await fetch(`/api/production/worker-deductions${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch worker deductions");
      }
      return res.json();
    },
    enabled: !!workerId,
    staleTime: 15_000,
  });
}

export function useCreateDefectMutation(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      lot_id: string;
      defect_date?: string;
      detected_at_stage_id?: string;
      defect_category: string;
      size_quantities: Record<string, number>;
      colour_id?: string;
      description?: string;
      responsible_worker_id?: string;
      responsible_stage_id?: string;
    }) => {
      const res = await fetch("/api/production/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record defect");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["lot-defects", lotId] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail", lotId] });
      if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Defect recorded successfully");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record defect");
    },
  });
}

export function useResolveDefectMutation(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      defectId,
      payload,
    }: {
      defectId: string;
      payload: {
        resolution_type: string;
        resolution_date?: string;
        recovered_size_quantities?: Record<string, number>;
        b_grade_size_quantities?: Record<string, number>;
        scrapped_size_quantities?: Record<string, number>;
        rework_stage_id?: string;
        rework_worker_id?: string;
        rework_cost?: number;
        rework_cost_mode?: "free" | "paid_normal" | "paid_custom";
        deduction_amount?: number;
        cloth_cost_recovery?: number;
        target_godown_id?: string;
        source_finished_stock_id?: string;
        responsible_worker_id?: string;
        waste_reason?: string;
        remarks?: string;
      };
    }) => {
      const res = await fetch(`/api/production/defects/${defectId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resolve defect");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lot-defects", lotId] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail", lotId] });
      queryClient.invalidateQueries({ queryKey: ["finished-stock"] });
      queryClient.invalidateQueries({ queryKey: ["b-grade-stock"] });
      queryClient.invalidateQueries({ queryKey: ["job-work-ledger"] });
      toast.success("Defect resolved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to resolve defect");
    },
  });
}
