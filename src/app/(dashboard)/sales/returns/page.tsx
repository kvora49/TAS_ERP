"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StandaloneSalesReturnsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/bills?type=return");
  }, [router]);

  return null;
}
