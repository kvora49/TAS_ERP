"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyPurchaseBillsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/raw-materials/purchases");
  }, [router]);

  return null;
}
