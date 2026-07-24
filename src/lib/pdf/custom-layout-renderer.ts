import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface LayoutElement {
  id: string;
  type: "text" | "field" | "image" | "table" | "box" | "divider";
  x: number; // in pixels relative to 794x1123 canvas
  y: number;
  width: number;
  height: number;
  content?: string;
  fieldBinding?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface CustomBillLayout {
  id?: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: LayoutElement[];
}

export const DEFAULT_BILL_LAYOUT: CustomBillLayout = {
  name: "Default System Template",
  canvasWidth: 794,
  canvasHeight: 1123,
  elements: [
    {
      id: "biz-logo",
      type: "field",
      x: 30,
      y: 30,
      width: 120,
      height: 45,
      fieldBinding: "business.logo_url",
    },
    {
      id: "biz-name",
      type: "field",
      x: 160,
      y: 30,
      width: 350,
      height: 25,
      fieldBinding: "business.name",
      fontSize: 18,
      fontWeight: "bold",
      color: "#0F172A",
    },
    {
      id: "biz-address",
      type: "field",
      x: 160,
      y: 58,
      width: 350,
      height: 35,
      fieldBinding: "business.address",
      fontSize: 10,
      color: "#64748B",
    },
    {
      id: "bill-title",
      type: "text",
      x: 550,
      y: 30,
      width: 214,
      height: 30,
      content: "TAX INVOICE",
      fontSize: 20,
      fontWeight: "bold",
      align: "right",
      color: "#6366F1",
    },
    {
      id: "bill-no",
      type: "field",
      x: 550,
      y: 65,
      width: 214,
      height: 20,
      fieldBinding: "bill.bill_number",
      fontSize: 11,
      fontWeight: "bold",
      align: "right",
      color: "#0F172A",
    },
    {
      id: "bill-date",
      type: "field",
      x: 550,
      y: 85,
      width: 214,
      height: 20,
      fieldBinding: "bill.bill_date",
      fontSize: 10,
      align: "right",
      color: "#64748B",
    },
    {
      id: "divider-1",
      type: "divider",
      x: 30,
      y: 120,
      width: 734,
      height: 2,
      borderColor: "#E2E8F0",
    },
    {
      id: "party-box-title",
      type: "text",
      x: 30,
      y: 135,
      width: 300,
      height: 18,
      content: "BILLED TO:",
      fontSize: 10,
      fontWeight: "bold",
      color: "#64748B",
    },
    {
      id: "party-name",
      type: "field",
      x: 30,
      y: 155,
      width: 350,
      height: 20,
      fieldBinding: "party.name",
      fontSize: 14,
      fontWeight: "bold",
      color: "#0F172A",
    },
    {
      id: "party-gstin",
      type: "field",
      x: 30,
      y: 178,
      width: 350,
      height: 18,
      fieldBinding: "party.gstin",
      fontSize: 10,
      color: "#475569",
    },
    {
      id: "items-table",
      type: "table",
      x: 30,
      y: 220,
      width: 734,
      height: 400,
    },
    {
      id: "totals-section",
      type: "field",
      x: 480,
      y: 650,
      width: 284,
      height: 120,
      fieldBinding: "bill.totals_summary",
      fontSize: 11,
    },
    {
      id: "terms-box",
      type: "text",
      x: 30,
      y: 650,
      width: 420,
      height: 80,
      content: "Terms & Conditions:\n1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.\n3. E.&O.E.",
      fontSize: 9,
      color: "#64748B",
    },
    {
      id: "sign-box",
      type: "text",
      x: 530,
      y: 800,
      width: 234,
      height: 50,
      content: "Authorized Signatory",
      fontSize: 10,
      fontWeight: "bold",
      align: "center",
      color: "#0F172A",
    },
  ],
};

export function renderCustomLayoutPDF(layout: CustomBillLayout, billData: any): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // A4 dimensions in mm: 210 x 297
  const mmWidth = 210;
  const mmHeight = 297;
  const scaleX = mmWidth / (layout.canvasWidth || 794);
  const scaleY = mmHeight / (layout.canvasHeight || 1123);

  // Helper to extract nested field
  const getFieldValue = (path: string) => {
    if (!path || !billData) return "";
    const parts = path.split(".");
    let curr = billData;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = curr[p];
      } else {
        return "";
      }
    }
    return String(curr ?? "");
  };

  layout.elements.forEach((el) => {
    const x = el.x * scaleX;
    const y = el.y * scaleY;
    const w = el.width * scaleX;

    if (el.type === "text" || el.type === "field") {
      const text = el.type === "text" ? el.content || "" : getFieldValue(el.fieldBinding || "");
      if (!text) return;

      doc.setFontSize(el.fontSize || 10);
      doc.setTextColor(el.color || "#0F172A");

      if (el.fontWeight === "bold") {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      if (el.align === "right") {
        doc.text(text, x + w, y, { align: "right" });
      } else if (el.align === "center") {
        doc.text(text, x + w / 2, y, { align: "center" });
      } else {
        doc.text(text, x, y);
      }
    } else if (el.type === "divider") {
      doc.setDrawColor(el.borderColor || "#CBD5E1");
      doc.setLineWidth(0.3);
      doc.line(x, y, x + w, y);
    } else if (el.type === "box") {
      if (el.backgroundColor) {
        doc.setFillColor(el.backgroundColor);
        doc.rect(x, y, w, el.height * scaleY, "F");
      }
      if (el.borderColor) {
        doc.setDrawColor(el.borderColor);
        doc.rect(x, y, w, el.height * scaleY, "D");
      }
    } else if (el.type === "table") {
      const tableItems = billData?.items || [
        { design_number: "DES-001", size: "32", quantity: 50, rate: 450, amount: 22500 },
        { design_number: "DES-002", size: "34", quantity: 30, rate: 500, amount: 15000 },
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: x, right: mmWidth - (x + w) },
        head: [["Item / Design", "Size", "Qty", "Rate (₹)", "Amount (₹)"]],
        body: tableItems.map((it: any) => [
          it.design_number || it.name || "Item",
          it.size || "All",
          it.quantity || 0,
          `₹${it.rate || 0}`,
          `₹${(it.quantity || 0) * (it.rate || 0)}`,
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      });
    }
  });

  return doc;
}
