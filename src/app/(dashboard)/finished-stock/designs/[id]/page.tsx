import { redirect } from "next/navigation";

export default function FinishedStockDesignDetailRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/master-data/designs/${params.id}`);
}
