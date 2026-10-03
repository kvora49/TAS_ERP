import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DeliveryDocument, deliveryTotals } from "@/lib/delivery-challan";

/** A4, compact bordered invoice styling. Print and download use this exact document. */
export function buildDeliveryChallanPdf(data: DeliveryDocument, cancelled = false) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = cancelled ? "DELIVERY CHALLAN - INVOICE CANCELLED" : "DELIVERY CHALLAN";
  const formatDate = (value: string) => value.split("-").reverse().join("/");
  const plain = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  let y = 10;
  const table = (head: string[][], body: any[][], options: Record<string, any> = {}) => {
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10, top: 20, bottom: 14 }, theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: 20, lineColor: 130, lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: 242, textColor: 15, fontStyle: "bold", lineWidth: 0.15 },
      head, body, rowPageBreak: "avoid", ...options,
    });
    y = (doc as any).lastAutoTable.finalY;
  };
  table([], [[{ content: [plain(data.company.name), plain(data.company.address), [data.company.gstin && `GSTIN: ${data.company.gstin}`, data.company.phone && `Tel: ${data.company.phone}`, data.company.email].filter(Boolean).join(" | ")].filter(Boolean).join("\n"), styles: { halign: "center", fontSize: 10, fontStyle: "bold", cellPadding: 3 } }]]);
  table([], [[{ content: title, styles: { halign: "center", fontSize: 11, fontStyle: "bold", fillColor: 242 } }]]);
  table([], [[
    `Customer company: ${plain(data.customer.company || data.customer.name)}\nCustomer name: ${plain(data.customer.name)}\nBilling address: ${plain(data.customer.address)}\n${[data.customer.gstin && `GSTIN: ${data.customer.gstin}`, data.customer.phone && `Phone: ${data.customer.phone}`].filter(Boolean).join(" | ")}`,
    `Challan No: ${plain(data.number)}\nDate: ${formatDate(data.date)}\nSales Bill: ${plain(data.billNumber)}\nBill Date: ${formatDate(data.billDate)}\n${[data.transporter && `Transport: ${data.transporter}`, data.vehicle && `Vehicle: ${data.vehicle}`, data.lrNumber && `LR/AWB: ${data.lrNumber}`].filter(Boolean).join("\n")}`,
  ]], { columnStyles: { 0: { cellWidth: 117 }, 1: { cellWidth: 73 } } });
  table([["Sr.", "Item / Design", "Roll / Serial No.", "Colour / Size", "Width", "Wt. (kg)", "Quality", "Qty / Unit"]], data.rows.map((row, index) => [
    index + 1, [plain(row.name), row.design && `Design: ${plain(row.design)}`].filter(Boolean).join("\n"), plain(row.serial) || "-",
    [plain(row.colour), row.size && `Size: ${plain(row.size)}`].filter(Boolean).join("\n") || "-",
    plain(row.width) || "-", row.weight == null ? "-" : row.weight, plain(row.quality) || "-", `${Number(row.quantity.toFixed(4))} ${plain(row.unit)}`,
  ]), { columnStyles: { 0: { cellWidth: 9, halign: "center" }, 1: { cellWidth: 42 }, 2: { cellWidth: 27 }, 3: { cellWidth: 28 }, 4: { cellWidth: 15 }, 5: { cellWidth: 16, halign: "right" }, 6: { cellWidth: 25 }, 7: { cellWidth: 28, halign: "right" } } });
  table([], [
    [{ content: `Total: ${deliveryTotals(data.rows)} | Recorded rolls: ${data.rows.filter(row => row.kind === "roll" && row.serial).length}`, colSpan: 2, styles: { fontStyle: "bold" } }],
    [{ content: `Deliver to: ${plain(data.shippingName)}\nShipping address: ${plain(data.shippingAddress)}${data.notes ? `\nNotes: ${plain(data.notes)}` : ""}`, colSpan: 2 }],
    ["Received the above goods in good condition.\n\n\nCustomer signature / stamp\nReceived by: __________________   Date: __________", `For ${plain(data.company.name)}\n\n\nAuthorised signature`],
  ], { pageBreak: "avoid", columnStyles: { 0: { cellWidth: 115 }, 1: { cellWidth: 75 } }, styles: { fontSize: 8, cellPadding: 3, lineColor: 130, lineWidth: 0.15 } });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    if (page > 1) doc.text(`${title} | ${plain(data.number)}`, 10, 12, { maxWidth: 190 });
    doc.text(`${plain(data.number)} | Sales bill ${plain(data.billNumber)}`, 10, 289, { maxWidth: 155 });
    doc.text(`${page} / ${pages}`, 200, 289, { align: "right" });
  }
  return doc;
}
