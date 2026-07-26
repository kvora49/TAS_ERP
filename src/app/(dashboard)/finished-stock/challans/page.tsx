import { redirect } from "next/navigation";

export default function DeliveryChallansRedirectPage() {
  redirect("/finished-stock/operations?tab=challans");
}
