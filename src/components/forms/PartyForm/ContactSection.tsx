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

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
        1. Basic Profile
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Party Type *</label>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {["supplier", "customer", "worker"].map((t) => {
              const watchTypes = watch("type") || [];
              const isChecked = watchTypes.includes(t);
              return (
                <label key={t} className="flex items-center gap-2 text-sm font-medium text-[#1E293B] cursor-pointer">
                  <input
                    type="checkbox"
                    value={t}
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setValue("type", [...watchTypes, t]);
                      } else {
                        setValue("type", watchTypes.filter((x) => x !== t));
                      }
                    }}
                    className="rounded border-[#CBD5E1] text-[#6366F1] focus:ring-[#6366F1] h-4 w-4"
                  />
                  <span className="capitalize">{t === "worker" ? "Worker" : t}</span>
                </label>
              );
            })}
          </div>
          {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
        </div>

        <div>
          <label htmlFor="party-code" className="block text-xs font-semibold text-[#64748B] mb-1.5">Party Code *</label>
          <input
            id="party-code"
            type="text"
            placeholder="e.g. SUP-0001"
            {...register("code")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 font-mono font-bold text-[#0F172A] focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
          {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="display-name" className="block text-xs font-semibold text-[#64748B] mb-1.5">Display Name / Contact Person *</label>
          <input
            id="display-name"
            type="text"
            placeholder="Enter contact name"
            {...register("name")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="company-name" className="block text-xs font-semibold text-[#64748B] mb-1.5">Company / Business Name</label>
          <input
            id="company-name"
            type="text"
            placeholder="Enter registered business name"
            {...register("company_name")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
        </div>

        <div>
          <label htmlFor="email-address" className="block text-xs font-semibold text-[#64748B] mb-1.5">Email Address</label>
          <input
            id="email-address"
            type="email"
            placeholder="name@company.com"
            {...register("email")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="phone-number" className="block text-xs font-semibold text-[#64748B] mb-1.5">Phone Number</label>
          <input
            id="phone-number"
            type="text"
            placeholder="10-digit mobile number"
            {...register("phone")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
        </div>

        <div>
          <label htmlFor="whatsapp-number" className="block text-xs font-semibold text-[#64748B] mb-1.5 flex items-center justify-between">
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
            id="whatsapp-number"
            type="text"
            placeholder="WhatsApp number"
            {...register("whatsapp_number")}
            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
        </div>

        {/* Repeatable Contacts List */}
        <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-4 col-span-full mt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                Contact Numbers
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                Configure multiple telephone numbers with a primary identifier.
              </p>
            </div>
            <button
              type="button"
              onClick={() => appendContact({ label: "Office", number: "", is_primary: contactFields.length === 0 })}
              className="h-8 px-2.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-[#6366F1] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {contactFields.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs font-semibold text-[#64748B]">
              No contact numbers added yet. Click Add Contact to specify.
            </div>
          ) : (
            <div className="space-y-3">
              {contactFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 animate-fadeIn">
                  {/* Number */}
                  <div className="flex-1 space-y-1">
                    <label htmlFor={`contact-number-${field.id}`} className="text-[10px] font-bold text-[#475569] uppercase">
                      Phone Number
                    </label>
                    <input
                      id={`contact-number-${field.id}`}
                      type="text"
                      placeholder="e.g. 9876543210"
                      className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                      {...register(`contact_numbers.${index}.number` as const)}
                    />
                  </div>

                  {/* Label */}
                  <div className="w-28 space-y-1">
                    <label htmlFor={`contact-label-${field.id}`} className="text-[10px] font-bold text-[#475569] uppercase">
                      Label
                    </label>
                    <select
                      id={`contact-label-${field.id}`}
                      className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
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
                      className="h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
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
                    <label htmlFor={`contact-primary-${field.id}`} className="text-[10px] font-bold text-[#475569] uppercase cursor-pointer select-none">
                      Primary
                    </label>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-md flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-rose-100 shrink-0"
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
