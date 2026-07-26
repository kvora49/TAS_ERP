import { redirect } from "next/navigation";

export default function StockAdjustmentsRedirectPage() {
  redirect("/finished-stock/operations?tab=adjustments");
}
