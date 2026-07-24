import React from "react";
import { UseFormRegister, UseFormWatch } from "react-hook-form";
import { PartyFormValues } from "./party.schema";

interface AddressSectionProps {
  register: UseFormRegister<PartyFormValues>;
  watch: UseFormWatch<PartyFormValues>;
  sameAsBilling: boolean;
  setSameAsBilling: (val: boolean) => void;
}

export function AddressSection({
  register,
  watch,
  sameAsBilling,
  setSameAsBilling,
}: AddressSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
        2. Address Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Billing Address */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#0F172A]">Billing Address</h3>
          <div>
            <label htmlFor="billing-address-1" className="sr-only">Billing Address Line 1</label>
            <input
              id="billing-address-1"
              type="text"
              placeholder="Address Line 1"
              {...register("billing_address_line1")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
            />
          </div>
          <div>
            <label htmlFor="billing-address-2" className="sr-only">Billing Address Line 2</label>
            <input
              id="billing-address-2"
              type="text"
              placeholder="Address Line 2 (Optional)"
              {...register("billing_address_line2")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="billing-city" className="sr-only">Billing City</label>
              <input
                id="billing-city"
                type="text"
                placeholder="City"
                {...register("billing_city")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="billing-state" className="sr-only">Billing State</label>
              <input
                id="billing-state"
                type="text"
                placeholder="State"
                {...register("billing_state")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="billing-pincode" className="sr-only">Billing Pincode</label>
              <input
                id="billing-pincode"
                type="text"
                placeholder="Pincode"
                {...register("billing_pincode")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
              />
            </div>
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
          <div>
            <label htmlFor="shipping-address-1" className="sr-only">Shipping Address Line 1</label>
            <input
              id="shipping-address-1"
              type="text"
              placeholder="Address Line 1"
              disabled={sameAsBilling}
              {...register("shipping_address_line1")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label htmlFor="shipping-address-2" className="sr-only">Shipping Address Line 2</label>
            <input
              id="shipping-address-2"
              type="text"
              placeholder="Address Line 2"
              disabled={sameAsBilling}
              {...register("shipping_address_line2")}
              className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="shipping-city" className="sr-only">Shipping City</label>
              <input
                id="shipping-city"
                type="text"
                placeholder="City"
                disabled={sameAsBilling}
                {...register("shipping_city")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label htmlFor="shipping-state" className="sr-only">Shipping State</label>
              <input
                id="shipping-state"
                type="text"
                placeholder="State"
                disabled={sameAsBilling}
                {...register("shipping_state")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label htmlFor="shipping-pincode" className="sr-only">Shipping Pincode</label>
              <input
                id="shipping-pincode"
                type="text"
                placeholder="Pincode"
                disabled={sameAsBilling}
                {...register("shipping_pincode")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
