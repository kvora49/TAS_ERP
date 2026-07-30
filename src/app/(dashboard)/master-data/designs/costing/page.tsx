"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CostingRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const designId = searchParams.get("design_id");

  useEffect(() => {
    if (designId) {
      router.replace(`/master-data/designs/${designId}`);
    } else {
      router.replace("/master-data/designs");
    }
  }, [designId, router]);

  return null;
}
