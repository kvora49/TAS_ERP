import { redirect } from "next/navigation";

export default function GodownTransfersRedirectPage() {
  redirect("/finished-stock/operations?tab=transfers");
}
