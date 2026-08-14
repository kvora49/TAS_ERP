"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { invalidatePartyRelatedQueries } from "@/lib/utils/party";
import { NumericInput } from "@/components/ui/numeric-input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { partySchema, PartyFormValues, Godown, Stage } from "./PartyForm/party.schema";
import { WorkerFieldsSection } from "./PartyForm/WorkerFieldsSection";
import { AddressSection } from "./PartyForm/AddressSection";
import { ContactSection } from "./PartyForm/ContactSection";

interface PartyFormProps {
  initialData?: any;
  id?: string;
}

export function PartyForm({ initialData, id }: PartyFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  
  // Worker-specific stages list
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

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
    contact_numbers: [],
    bank_details: [],
    // Worker defaults
    stage_specialty: [],
    wage_type: "piece_rate",
    wage_rate: 0,
    worker_type: "in_house",
    preferred_stage_id: "",
    working_since: new Date().toISOString().split("T")[0],
  };

  const sanitizedInitialData = initialData
    ? Object.keys(initialData).reduce((acc: any, key) => {
        if (initialData[key] === null) {
          acc[key] = (key === "contact_numbers" || key === "bank_details" || key === "stage_specialty") ? [] : "";
        } else {
          acc[key] = initialData[key];
        }
        return acc;
      }, {})
    : null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema) as any,
    defaultValues: sanitizedInitialData ? { ...defaultValues, ...sanitizedInitialData } : defaultValues,
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

  // Fetch production stages for worker options
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
        console.error("Failed to load production stages", err);
      } finally {
        setLoadingStages(false);
      }
    }
    fetchStages();
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

      // Synchronize phone and whatsapp_number for backward compatibility
      const primaryContact = values.contact_numbers?.find((c) => c.is_primary) || values.contact_numbers?.[0];
      const whatsappContact = values.contact_numbers?.find((c) => c.label === "WhatsApp");

      if (primaryContact) {
        values.phone = primaryContact.number;
      }
      if (whatsappContact) {
        values.whatsapp_number = whatsappContact.number;
      } else if (primaryContact) {
        values.whatsapp_number = primaryContact.number;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");

      toast.success(id ? "Party updated successfully" : "Party created successfully");
      invalidatePartyRelatedQueries(queryClient);
      router.push("/parties");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save party";
      toast.error(message);
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
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/parties" className="p-2 hover:bg-[var(--table-row-hover)] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[var(--text-muted)]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {id ? "Edit Party Master" : "Add New Party"}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Configure profile, address, billing, and bank accounts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/parties"
            className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {id ? "Save Changes" : "Create Party"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Basic Info & Tax details */}
        <div className="lg:col-span-2 space-y-6">
          <ContactSection
            register={register}
            setValue={setValue}
            watch={watch}
            control={control}
            syncWhatsapp={syncWhatsapp}
            errors={errors}
          />

          <WorkerFieldsSection
            register={register}
            control={control}
            setValue={setValue}
            stages={stages}
            loadingStages={loadingStages}
            errors={errors}
          />

          <AddressSection
            register={register}
            watch={watch}
            sameAsBilling={sameAsBilling}
            setSameAsBilling={setSameAsBilling}
          />

          {/* SECTION 3: Dynamic Bank Accounts */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
                3. Bank Accounts
              </h2>
              <button
                type="button"
                onClick={() => append({ bank_name: "", account_number: "", ifsc_code: "", branch: "", is_primary: fields.length === 0 })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Bank Account
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">
                No bank accounts added yet. Click &quot;Add Bank Account&quot; to configure.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border border-[var(--border)] rounded-xl relative bg-[var(--page-bg)] flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label htmlFor={`bank-name-${field.id}`} className="block text-[10px] font-bold text-[var(--text-muted)] mb-1">Bank Name *</label>
                        <input
                          id={`bank-name-${field.id}`}
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          {...register(`bank_details.${index}.bank_name` as const)}
                          className="w-full px-2.5 py-1.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs"
                        />
                        {errors.bank_details?.[index]?.bank_name && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.bank_name?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`account-number-${field.id}`} className="block text-[10px] font-bold text-[var(--text-muted)] mb-1">Account Number *</label>
                        <input
                          id={`account-number-${field.id}`}
                          type="text"
                          placeholder="Enter account no."
                          {...register(`bank_details.${index}.account_number` as const)}
                          className="w-full px-2.5 py-1.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs"
                        />
                        {errors.bank_details?.[index]?.account_number && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.account_number?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`ifsc-code-${field.id}`} className="block text-[10px] font-bold text-[var(--text-muted)] mb-1">IFSC Code *</label>
                        <input
                          id={`ifsc-code-${field.id}`}
                          type="text"
                          placeholder="11-digit IFSC"
                          {...register(`bank_details.${index}.ifsc_code` as const)}
                          className="w-full px-2.5 py-1.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-mono"
                        />
                        {errors.bank_details?.[index]?.ifsc_code && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.bank_details[index]?.ifsc_code?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`branch-name-${field.id}`} className="block text-[10px] font-bold text-[var(--text-muted)] mb-1">Branch Name</label>
                        <input
                          id={`branch-name-${field.id}`}
                          type="text"
                          placeholder="Branch location"
                          {...register(`bank_details.${index}.branch` as const)}
                          className="w-full px-2.5 py-1.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 h-9 md:h-auto pb-1 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(`bank_details.${index}.is_primary` as const)}
                          className="rounded border-[var(--input-border)] text-[var(--primary)] h-3.5 w-3.5"
                        />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
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
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-l-4 border-[var(--primary)] pl-2.5">
              4. Tax Details
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="gstin" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">GSTIN</label>
                <input
                  id="gstin"
                  type="text"
                  placeholder="15-digit GSTIN"
                  {...register("gstin")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="pan" className="block text-xs font-semibold text-[#64748B] mb-1.5">PAN Card Number</label>
                <input
                  id="pan"
                  type="text"
                  placeholder="10-digit PAN"
                  {...register("pan")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label htmlFor="aadhar" className="block text-xs font-semibold text-[#64748B] mb-1.5">Aadhar Number</label>
                <input
                  id="aadhar"
                  type="text"
                  placeholder="12-digit Aadhar"
                  {...register("aadhar")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label htmlFor="msme-number" className="block text-xs font-semibold text-[#64748B] mb-1.5">MSME Registration Number</label>
                <input
                  id="msme-number"
                  type="text"
                  placeholder="UDYAM-XX-00-0000000"
                  {...register("msme_number")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label htmlFor="tan" className="block text-xs font-semibold text-[#64748B] mb-1.5">TAN Number</label>
                <input
                  id="tan"
                  type="text"
                  placeholder="10-digit TAN"
                  {...register("tan")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Payment Terms & Balance */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-l-4 border-[var(--primary)] pl-2.5">
              5. Ledger & Credit Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="payment-terms" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Payment Terms</label>
                <select
                  id="payment-terms"
                  {...register("payment_terms")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
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
                <label htmlFor="credit-limit" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Credit Limit (₹)</label>
                <NumericInput
                  id="credit-limit"
                  placeholder="0.00"
                  {...register("credit_limit")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="opening-balance" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Opening Balance (₹)</label>
                <NumericInput
                  id="opening-balance"
                  placeholder="e.g. 50000 for Cr, -5000 for Dr"
                  {...register("opening_balance")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Positive means we owe them (Cr), negative means they owe us (Dr).
                </p>
              </div>

              <div>
                <label htmlFor="opening-balance-date" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Opening Balance Date</label>
                <input
                  id="opening-balance-date"
                  type="date"
                  {...register("opening_balance_date")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="default-godown" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Default Godown</label>
                <select
                  id="default-godown"
                  disabled={loadingGodowns}
                  {...register("default_godown_id")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
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
                <label htmlFor="default-ledger" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Default Ledger Account</label>
                <input
                  id="default-ledger"
                  type="text"
                  placeholder="e.g. Purchase A/c"
                  {...register("default_purchase_account")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Status</label>
                <select
                  id="status"
                  {...register("status")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                >
                  <option value="active" className="text-green-600 bg-[var(--card-bg)]">Active</option>
                  <option value="inactive" className="text-red-600 bg-[var(--card-bg)]">Inactive</option>
                </select>
              </div>

              <div>
                <label htmlFor="remarks" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Remarks / Comments</label>
                <textarea
                  id="remarks"
                  placeholder="Additional remarks or notes about the party..."
                  rows={3}
                  {...register("remarks")}
                  className="w-full p-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
