import { redirect } from "next/navigation";

export default function PartyStatementRedirect() {
  redirect("/reports/party-reports?tab=statement");
}
