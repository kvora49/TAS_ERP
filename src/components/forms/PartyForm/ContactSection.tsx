import React from "react";
import { UseFormRegister, UseFormSetValue, UseFormWatch, Control } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Trash2, Plus } from "lucide-react";
import { PartyFormValues } from "./party.schema";

interface ContactSectionProps {
  register: UseFormRegister<PartyFormValues>;
  setValue: UseFormSetValue<PartyFormValues>;
  watch: UseFormWatch<PartyFormValues>;
  control: Control<PartyFormValues>;
  syncWhatsapp: () => void;
  errors: any;
}

export function ContactSection({
  register,
  setValue,
  watch,
  control,
  syncWhatsapp,
  errors,
}: ContactSectionProps) {
  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
    control,
    name: "contact_numbers",
  });

  const watchTypes = watch("type") || [];
  const selectedType = watchTypes[0] || "supplier";

  return (
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-l-4 border-[var(--primary)] pl-2.5">
        1. Basic Profile
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Party Type *</label>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {[
              { id: "supplier", label: "Supplier" },
              { id: "customer", label: "Customer" },
              { id: "worker", label: "Worker" },
            ].map((t) => {
              const isChecked = selectedType === t.id;
              return (
                <label key={t.id} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] cursor-pointer select-none">
                  <input
                    type="radio"
                    name="party_type_radio"
                    value={t.id}
                    checked={isChecked}
                    onChange={() => {
                      setValue("type", [t.id]);
                    }}
                    className="h-4 w-4 text-[var(--primary)] border-[var(--input-border)] focus:ring-[var(--input-focus)] cursor-pointer"
                  />
                  <span>{t.label}</span>
                </label>
              );
            })}
          </div>
          {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
        </div>

        <div>
          <label htmlFor="party-code" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Party Code *</label>
          <input
            id="party-code"
            type="text"
            placeholder="e.g. SUP-0001"
            {...register("code")}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--page-bg)] font-mono font-bold text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
          {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="display-name" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Display Name / Contact Person *</label>
          <input
            id="display-name"
            type="text"
            placeholder="Enter contact name"
            {...register("name")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="company-name" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Company / Business Name</label>
          <input
            id="company-name"
            type="text"
            placeholder="Enter registered business name"
            {...register("company_name")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="email-address" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Email Address</label>
          <input
            id="email-address"
            type="email"
            placeholder="name@company.com"
            {...register("email")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="phone-number" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Phone Number</label>
          <input
            id="phone-number"
            type="text"
            placeholder="10-digit mobile number"
            {...register("phone")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="whatsapp-number" className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 flex items-center justify-between">
            <span>WhatsApp Number</span>
            <button
              type="button"
              onClick={syncWhatsapp}
              className="text-[10px] text-[var(--primary)] hover:underline font-bold cursor-pointer"
            >
              Same as Phone
            </button>
          </label>
          <input
            id="whatsapp-number"
            type="text"
            placeholder="WhatsApp number"
            {...register("whatsapp_number")}
            className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
        </div>

        {/* Repeatable Contacts List */}
        <div className="border border-[var(--border)] rounded-xl p-4 space-y-4 col-span-full mt-2 bg-[var(--card-bg)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Contact Numbers
              </h3>
              <p className="text-[10px] text-[var(--text-faint)] font-medium leading-none mt-0.5">
                Configure multiple telephone numbers with a primary identifier.
              </p>
            </div>
            <button
              type="button"
              onClick={() => appendContact({ label: "Office", number: "", is_primary: contactFields.length === 0 })}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-[var(--primary)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {contactFields.length === 0 ? (
            <div className="text-center py-4 bg-[var(--page-bg)] border border-dashed border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-muted)]">
              No contact numbers added yet. Click Add Contact to specify.
            </div>
          ) : (
            <div className="space-y-3">
              {contactFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 bg-[var(--page-bg)] p-2.5 rounded-lg border border-[var(--border)] animate-fadeIn">
                  {/* Number */}
                  <div className="flex-1 space-y-1">
                    <label htmlFor={`contact-number-${field.id}`} className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                      Phone Number
                    </label>
                    <input
                      id={`contact-number-${field.id}`}
                      type="text"
                      placeholder="e.g. 9876543210"
                      className="w-full h-8 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      {...register(`contact_numbers.${index}.number` as const)}
                    />
                  </div>

                  {/* Label */}
                  <div className="w-28 space-y-1">
                    <label htmlFor={`contact-label-${field.id}`} className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                      Label
                    </label>
                    <select
                      id={`contact-label-${field.id}`}
                      className="w-full h-8 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      {...register(`contact_numbers.${index}.label` as const)}
                    >
                      <option value="Main">Main</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Office">Office</option>
                      <option value="Personal">Personal</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </div>

                  {/* Primary Checkbox */}
                  <div className="flex items-center gap-1.5 pb-2">
                    <input
                      type="checkbox"
                      id={`contact-primary-${field.id}`}
                      className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--input-focus)] border-[var(--input-border)] rounded cursor-pointer"
                      {...register(`contact_numbers.${index}.is_primary` as const)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          contactFields.forEach((_, i) => {
                            if (i !== index) {
                              setValue(`contact_numbers.${i}.is_primary`, false);
                            }
                          });
                        }
                        setValue(`contact_numbers.${index}.is_primary`, e.target.checked);
                      }}
                    />
                    <label htmlFor={`contact-primary-${field.id}`} className="text-[10px] font-bold text-[var(--text-muted)] uppercase cursor-pointer select-none">
                      Primary
                    </label>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-rose-200 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
