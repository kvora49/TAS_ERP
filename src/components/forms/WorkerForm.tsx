"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const workerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  worker_id: z.string().min(1, "Worker ID is required"),
  type: z.enum(["job_worker", "permanent"]),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").or(z.literal("")).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  aadhaar: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  preferred_stage_id: z.string().optional().nullable(),
  default_rate: z.coerce.number().min(0, "Rate must be positive"),
  max_capacity_per_day: z.coerce.number().int().min(0).optional().nullable(),
  payment_mode: z.string(),
  payment_cycle: z.string(),
  working_since: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  ifsc_code: z.string().optional().nullable(),
  account_holder_name: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  is_active: z.boolean(),
});

type WorkerFormValues = z.infer<typeof workerSchema>;

interface ProductionStage {
  id: string;
  name: string;
}

interface WorkerFormProps {
  initialData?: any;
  id?: string;
}

export function WorkerForm({ initialData, id }: WorkerFormProps) {
  const router = useRouter();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema) as any,
    defaultValues: {
      name: "",
      worker_id: "",
      type: "job_worker",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      gstin: "",
      pan: "",
      aadhaar: "",
      specialization: "",
      preferred_stage_id: "",
      default_rate: 0,
      max_capacity_per_day: 0,
      payment_mode: "bank_transfer",
      payment_cycle: "weekly",
      working_since: new Date().toISOString().split("T")[0],
      bank_name: "",
      account_number: "",
      ifsc_code: "",
      account_holder_name: "",
      remarks: "",
      is_active: true,
    },
  });

  const workerType = watch("type");

  // Fetch production stages
  useEffect(() => {
    async function fetchStages() {
      setLoadingStages(true);
      try {
        const res = await fetch("/api/master-data/production-stages");
        if (res.ok) {
          const data = await res.json();
          setStages(data.stages || []);
        }
      } catch (err) {
        console.error("Failed to fetch stages", err);
      } finally {
        setLoadingStages(false);
      }
    }
    fetchStages();
  }, []);

  // Set initial data if editing
  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach((key) => {
        const val = initialData[key];
        if (val !== null && val !== undefined) {
          if (key === "working_since" && typeof val === "string") {
            setValue(key as any, val.split("T")[0]);
          } else {
            setValue(key as any, val);
          }
        }
      });
    }
  }, [initialData, setValue]);

  // Auto-generate code when type changes (only on Create mode)
  useEffect(() => {
    if (!id && workerType) {
      const fetchNextCode = async () => {
        try {
          const res = await fetch(`/api/workers/code/next?type=${workerType}`);
          if (res.ok) {
            const data = await res.json();
            setValue("worker_id", data.code);
          }
        } catch (err) {
          console.error("Failed to fetch next worker code", err);
        }
      };
      fetchNextCode();
    }
  }, [workerType, id, setValue]);

  const onSubmit = async (data: WorkerFormValues) => {
    setSubmitting(true);
    const url = id ? `/api/workers/${id}` : "/api/workers";
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          preferred_stage_id: data.preferred_stage_id || null,
          max_capacity_per_day: data.max_capacity_per_day || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to save worker");
      }

      toast.success(id ? "Worker updated successfully" : "Worker created successfully");
      router.push("/master-data/workers");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-5xl">
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data/workers"
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {id ? "Edit Worker Details" : "Register New Worker"}
            </h2>
            <p className="text-xs text-[#64748B]">
              {id ? `Update profile info for worker: ${initialData?.worker_id}` : "Add worker to master directory"}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-sm px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {id ? "Save Changes" : "Create Worker"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Personal & Contact */}
        <div className="md:col-span-2 space-y-6">
          {/* Card 1: Personal Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider">
              Personal & Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. Shakti Sewing"
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Worker ID / Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("worker_id")}
                  disabled={!!id}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm focus:outline-none font-mono font-bold"
                  placeholder="Auto-generated"
                />
                {errors.worker_id && (
                  <p className="text-xs text-red-500 mt-1">{errors.worker_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Worker Type <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("type")}
                  disabled={!!id}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="job_worker">Job Worker</option>
                  <option value="permanent">Permanent Worker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Phone Number
                </label>
                <input
                  type="text"
                  {...register("phone")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. 98765 43210"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. worker@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  GSTIN
                </label>
                <input
                  type="text"
                  {...register("gstin")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] uppercase"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  PAN Number
                </label>
                <input
                  type="text"
                  {...register("pan")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] uppercase"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  {...register("aadhaar")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. 1234 5678 9012"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Address
                </label>
                <input
                  type="text"
                  {...register("address")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="Street details"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    City
                  </label>
                  <input
                    type="text"
                    {...register("city")}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    placeholder="e.g. Tiruppur"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    State
                  </label>
                  <input
                    type="text"
                    {...register("state")}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    placeholder="e.g. Tamil Nadu"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Employment Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider">
              Employment Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Joined Since
                </label>
                <input
                  type="date"
                  {...register("working_since")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Specialization (e.g. Stitching, Cutting)
                </label>
                <input
                  type="text"
                  {...register("specialization")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. Collar Stitching"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Preferred Production Stage
                </label>
                <select
                  {...register("preferred_stage_id")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Select Preferred Stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {workerType === "job_worker" && (
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Default Piece Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("default_rate")}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    placeholder="e.g. 12.00"
                  />
                  {errors.default_rate && (
                    <p className="text-xs text-red-500 mt-1">{errors.default_rate.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Max Capacity Per Day (Pcs)
                </label>
                <input
                  type="number"
                  {...register("max_capacity_per_day")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                Remarks
              </label>
              <textarea
                rows={3}
                {...register("remarks")}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                placeholder="Add notes..."
              />
            </div>
          </div>
        </div>

        {/* Right Col: Bank & Status */}
        <div className="space-y-6">
          {/* Card 3: Bank Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider">
              Bank Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Bank Name
                </label>
                <input
                  type="text"
                  {...register("bank_name")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. HDFC Bank"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Account Number
                </label>
                <input
                  type="text"
                  {...register("account_number")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="e.g. 50200012345678"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  IFSC Code
                </label>
                <input
                  type="text"
                  {...register("ifsc_code")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] uppercase"
                  placeholder="e.g. HDFC0001234"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  {...register("account_holder_name")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="Exact name as in bank"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Payments & Preferences */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider">
              Payments & Preferences
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Payment Mode
                </label>
                <select
                  {...register("payment_mode")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Payment Cycle
                </label>
                <select
                  {...register("payment_cycle")}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Fortnightly (Bi-weekly)</option>
                  <option value="monthly">Monthly</option>
                  <option value="piece_rate">On Piece Completion</option>
                </select>
              </div>

              <div className="flex items-center gap-3.5 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register("is_active")}
                  className="h-4.5 w-4.5 rounded border-[#E5E7EB] text-[#6366F1] focus:ring-[#6366F1]"
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-[#374151] select-none">
                  Is Active Worker
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
