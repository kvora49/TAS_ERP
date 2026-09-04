"use client";

import { PartyForm } from "@/components/forms/PartyForm";
import ModuleSubNav from "@/components/shared/ModuleSubNav";
import { PARTIES_NAV } from "@/lib/moduleNav";

export default function NewPartyPage() {
  return (
    <div className="p-2.5 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <ModuleSubNav items={PARTIES_NAV} />
      <PartyForm />
    </div>
  );
}
