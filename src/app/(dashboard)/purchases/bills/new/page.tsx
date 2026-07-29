"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCreatePurchaseBillRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/raw-materials/purchases/new");
  }, [router]);

  return null;
}
