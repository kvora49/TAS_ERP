/** Export the complete filtered register, independent of the visible pagination page. */
export async function exportRegisterPDF(headers: string[], rows: string[][], pathname: string, search: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait" });
  const safe = (v: string) => v.replace(/₹/g, "Rs. ").replace(/[↑↓]/g, "");
  const title = pathname.split("/").filter(Boolean).join(" / ");
  const params = new URLSearchParams(search);
  const context = Array.from(params.entries()).map(([key, value]) => `${key}: ${value}`).join(" | ") || "Current report filters";
  doc.setFontSize(14); doc.text(`TAS ERP | ${safe(title)}`, 14, 15);
  doc.setFontSize(8); const lines = doc.splitTextToSize(safe(context), doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, 23);
  autoTable(doc, { head: [headers.map(safe)], body: rows.map(r => r.map(safe)), startY: 27 + lines.length * 4, styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" }, headStyles: { fillColor: [79, 70, 229] }, margin: { bottom: 16 }, didDrawPage: () => { doc.setFontSize(7); doc.text(`${rows.length} filtered rows | Generated ${new Date().toLocaleString("en-IN")}`, 14, doc.internal.pageSize.getHeight() - 7); } });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) { doc.setPage(page); doc.text(`${page} / ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 7); }
  doc.save(`${pathname.split("/").filter(Boolean).join("_")}_register.pdf`);
}
