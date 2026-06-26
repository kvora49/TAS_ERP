"use client";

import { useEffect, useState } from "react";
import { PartyForm } from "@/components/forms/PartyForm";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EditPartyPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParty() {
      try {
        const res = await fetch(`/api/parties/${id}`);
        if (!res.ok) throw new Error("Failed to load party details");
        const data = await res.json();
        setInitialData(data.party);
      } catch (err: any) {
        toast.error(err.message || "Could not fetch party info");
      } finally {
        setLoading(false);
      }
    }
    fetchParty();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Party not found or could not be loaded.
      </div>
    );
  }

  return (
    <div className="p-6">
      <PartyForm initialData={initialData} id={id} />
    </div>
  );
}
