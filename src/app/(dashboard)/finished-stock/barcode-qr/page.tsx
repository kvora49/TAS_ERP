import { redirect } from "next/navigation";

export default function FinishedStockBarcodeQRRedirectPage() {
  redirect("/master-data/barcode-qr");
}
