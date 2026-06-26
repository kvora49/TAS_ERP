"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const partySchema = z.object({
  name: z.string().min(2, "Party Name must be at least 2 characters"),
  type: z.array(z.string()).min(1, "Select at least one Party Type"),
  code: z.string().min(1, "Party Code is required"),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  company_name: z.string().optional(),
  email: z.string().email("Invalid email format").or(z.literal("")),
  website: z.string().url("Invalid website URL").or(z.literal("")),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  aadhar: z.string().optional(),
  msme_number: z.string().optional(),
  tan: z.string().optional(),
  billing_address_line1: z.string().optional(),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_pincode: z.string().optional(),
  shipping_address_line1: z.string().optional(),
  shipping_address_line2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_pincode: z.string().optional(),
  payment_terms: z.string(),
  credit_limit: z.coerce.number().min(0),
  opening_balance: z.coerce.number(),
  opening_balance_date: z.string().optional(),
  currency: z.string(),
  default_purchase_account: z.string().optional(),
  default_godown_id: z.string().optional(),
  remarks: z.string().optional(),
  status: z.string(),
  bank_details: z.array(
    z.object({
      bank_name: z.string().min(1, "Bank name is required"),
      account_number: z.string().min(5, "Account number must be at least 5 digits"),
      ifsc_code: z.string().min(11, "IFSC must be 11 characters"),
      branch: z.string().optional(),
      is_primary: z.boolean(),
    })
  ).optional(),
});

type PartyFormValues = z.infer<typeof partySchema>;

interface Godown {
  id: string;
  name: string;
}

interface PartyFormProps {
  initialData?: any;
  id?: string;
}

export function PartyForm({ initialData, id }: PartyFormProps) {
  const router = useRouter();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const defaultValues: PartyFormValues = {
    name: "",
    type: ["supplier"],
    code: "",
    phone: "",
    whatsapp_number: "",
    company_name: "",
    email: "",
    website: "",
    gstin: "",
    pan: "",
    aadhar: "",
    msme_number: "",
    tan: "",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_pincode: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
    payment_terms: "30_days",
    credit_limit: 0,
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().split("T")[0],
    currency: "INR",
    default_purchase_account: "",
    default_godown_id: "",
    remarks: "",
    status: "active",
    bank_details: [],
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema) as any,
    defaultValues: initialData ? { ...defaultValues, ...initialData } : defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bank_details",
  });

  const watchTypes = watch("type") || [];
  const watchBillingAddress1 = watch("billing_address_line1");
  const watchBillingAddress2 = watch("billing_address_line2");
  const watchBillingCity = watch("billing_city");
  const watchBillingState = watch("billing_state");
  const watchBillingPincode = watch("billing_pincode");

  // Fetch godowns list
  useEffect(() => {
    async function fetchGodowns() {
      setLoadingGodowns(true);
      try {
        const res = await fetch("/api/master-data/godowns");
        if (res.ok) {
          const data = await res.json();
          setGodowns(data.godowns || []);
        }
      } catch (err) {
        console.error("Failed to load godowns");
      } finally {
        setLoadingGodowns(false);
      }
    }
    fetchGodowns();
  }, []);

  // Sync shipping address with billing address when sameAsBilling toggle is ON
  useEffect(() => {
    if (sameAsBilling) {
      setValue("shipping_address_line1", watchBillingAddress1 || "");
      setValue("shipping_address_line2", watchBillingAddress2 || "");
      setValue("shipping_city", watchBillingCity || "");
      setValue("shipping_state", watchBillingState || "");
      setValue("shipping_pincode", watchBillingPincode || "");
    }
  }, [
    sameAsBilling,
    watchBillingAddress1,
    watchBillingAddress2,
    watchBillingCity,
    watchBillingState,
    watchBillingPincode,
    setValue,
  ]);

  // Generate next code when primary party type changes (only for new entries)
  useEffect(() => {
    if (!initialData && watchTypes.length > 0) {
      const primaryType = watchTypes[0]; // e.g. supplier, customer, worker
      fetch(`/api/parties/code/next?type=${primaryType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.code) {
            setValue("code", data.code);
          }
        })
        .catch((err) => console.error("Failed to fetch next party code", err));
    }
  }, [watchTypes, initialData, setValue]);

  const onSubmit = async (values: PartyFormValues) => {
    try {
      const url = id ? `/api/parties/${id}` : "/api/parties";
      const method = id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");

      toast.success(id ? "Party updated successfully" : "Party created successfully");
      router.push("/parties");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save party");
    }
  };

  const syncWhatsapp = () => {
    const phone = watch("phone");
    if (phone) {
      setValue("whatsapp_number", phone);
      toast.info("Copied phone to WhatsApp number");
    } else {
      toast.warning("Enter a phone number first");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner Actions */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/parties" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              {id ? "Edit Party Master" : "Add New Party"}
            </h1>
            <p className="text-xs text-[#64748B]">
              Configure profile, address, billing, and bank accounts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/parties"
            className="px-4 py-2 text-sm font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all shadow-md shadow-[#6366F1]/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {id ? "Save Changes" : "Create Party"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Basic Info & Tax details */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Basic Information */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              1. Basic Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Party Type *</label>
                <div className="flex items-center gap-4 mt-2">
                  {["supplier", "customer", "worker"].map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm font-medium text-[#1E293B] cursor-pointer">
                      <input
                        type="checkbox"
                        value={t}
                        {...register("type")}
                        className="rounded border-[#CBD5E1] text-[#6366F1] focus:ring-[#6366F1] h-4 w-4"
                      />
                      <span className="capitalize">{t}</span>
                    </label>
                  ))}
                </div>
                {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Party Code *</label>
                <input
                  type="text"
                  placeholder="e.g. SUP-0001"
                  {...register("code")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 font-mono font-bold text-[#0F172A] focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
                {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Display Name / Contact Person *</label>
                <input
                  type="text"
                  placeholder="Enter contact name"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Company / Business Name</label>
                <input
                  type="text"
                  placeholder="Enter registered business name"
                  {...register("company_name")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  {...register("email")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Phone Number</label>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  {...register("phone")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5 flex items-center justify-between">
                  <span>WhatsApp Number</span>
                  <button
                    type="button"
                    onClick={syncWhatsapp}
                    className="text-[10px] text-[#6366F1] hover:underline font-bold"
                  >
                    Same as Phone
                  </button>
                </label>
                <input
                  type="text"
                  placeholder="WhatsApp number"
                  {...register("whatsapp_number")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Billing & Shipping Address */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              2. Address Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Billing Address */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#0F172A]">Billing Address</h3>
                <input
                  type="text"
                  placeholder="Address Line 1"
                  {...register("billing_address_line1")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Address Line 2 (Optional)"
                  {...register("billing_address_line2")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    {...register("billing_city")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    {...register("billing_state")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    {...register("billing_pincode")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0F172A]">Shipping Address</h3>
                  <label className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="rounded border-[#CBD5E1] text-[#6366F1] h-3.5 w-3.5"
                    />
                    Same as Billing
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Address Line 1"
                  disabled={sameAsBilling}
                  {...register("shipping_address_line1")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
                />
                <input
                  type="text"
                  placeholder="Address Line 2"
                  disabled={sameAsBilling}
                  {...register("shipping_address_line2")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    disabled={sameAsBilling}
                    {...register("shipping_city")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    disabled={sameAsBilling}
                    {...register("shipping_state")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    disabled={sameAsBilling}
                    {...register("shipping_pincode")}
                    className="col-span-1 w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Dynamic Bank Accounts */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
                3. Bank Accounts
              </h2>
              <button
                type="button"
                onClick={() => append({ bank_name: "", account_number: "", ifsc_code: "", branch: "", is_primary: fields.length === 0 })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg flex items-center gap-1 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Add Bank Account
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#CBD5E1] rounded-xl text-xs text-[#64748B]">
                No bank accounts added yet. Click &quot;Add Bank Account&quot; to configure.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border border-[#E2E8F0] rounded-xl relative bg-slate-50 flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748B] mb-1">Bank Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          {...register(`bank_details.${index}.bank_name` as const)}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg text-xs"
                        />
                        {errors.bank_details?.[index]?.bank_name && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.bank_name?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#64748B] mb-1">Account Number *</label>
                        <input
                          type="text"
                          placeholder="Enter account no."
                          {...register(`bank_details.${index}.account_number` as const)}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg text-xs"
                        />
                        {errors.bank_details?.[index]?.account_number && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.account_number?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#64748B] mb-1">IFSC Code *</label>
                        <input
                          type="text"
                          placeholder="11-digit IFSC"
                          {...register(`bank_details.${index}.ifsc_code` as const)}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg text-xs font-mono"
                        />
                        {errors.bank_details?.[index]?.ifsc_code && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.ifsc_code?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#64748B] mb-1">Branch Name</label>
                        <input
                          type="text"
                          placeholder="Branch location"
                          {...register(`bank_details.${index}.branch` as const)}
                          className="w-full px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 h-9 md:h-auto pb-1 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(`bank_details.${index}.is_primary` as const)}
                          className="rounded border-[#CBD5E1] text-[#6366F1] h-3.5 w-3.5"
                        />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Remove Account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Registrations, Payment Terms, Ledger Defaults */}
        <div className="space-y-6">
          {/* SECTION 4: Tax Registrations */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              4. Tax Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">GSTIN</label>
                <input
                  type="text"
                  placeholder="15-digit GSTIN"
                  {...register("gstin")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">PAN Card Number</label>
                <input
                  type="text"
                  placeholder="10-digit PAN"
                  {...register("pan")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Aadhar Number</label>
                <input
                  type="text"
                  placeholder="12-digit Aadhar"
                  {...register("aadhar")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">MSME Registration Number</label>
                <input
                  type="text"
                  placeholder="UDYAM-XX-00-0000000"
                  {...register("msme_number")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">TAN Number</label>
                <input
                  type="text"
                  placeholder="10-digit TAN"
                  {...register("tan")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Payment Terms & Balance */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              5. Ledger & Credit Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Payment Terms</label>
                <select
                  {...register("payment_terms")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] bg-white"
                >
                  <option value="immediate">Immediate / Cash</option>
                  <option value="15_days">15 Days</option>
                  <option value="30_days">30 Days</option>
                  <option value="45_days">45 Days</option>
                  <option value="60_days">60 Days</option>
                  <option value="90_days">90 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Credit Limit (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  {...register("credit_limit")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Opening Balance (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 50000 for Cr, -5000 for Dr"
                  {...register("opening_balance")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                <p className="text-[10px] text-[#64748B] mt-1">
                  Positive means we owe them (Cr), negative means they owe us (Dr).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Opening Balance Date</label>
                <input
                  type="date"
                  {...register("opening_balance_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Default Godown</label>
                <select
                  disabled={loadingGodowns}
                  {...register("default_godown_id")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Default Ledger Account</label>
                <input
                  type="text"
                  placeholder="e.g. Purchase A/c"
                  {...register("default_purchase_account")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Status</label>
                <select
                  {...register("status")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white font-bold"
                >
                  <option value="active" className="text-green-600">Active</option>
                  <option value="inactive" className="text-red-600">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
