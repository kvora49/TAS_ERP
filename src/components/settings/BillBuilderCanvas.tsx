"use client";

import React, { useState } from "react";
import {
  Type,
  Table as TableIcon,
  Square,
  Minus,
  Sparkles,
  Save,
  Eye,
  RotateCcw,
  Trash2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
} from "lucide-react";
import { toast } from "sonner";
import { CustomBillLayout, DEFAULT_BILL_LAYOUT, LayoutElement, renderCustomLayoutPDF } from "@/lib/pdf/custom-layout-renderer";
import { Button } from "@/components/ui/button";

interface Props {
  initialLayout?: CustomBillLayout;
  onSave?: (layout: CustomBillLayout) => void;
}

export function BillBuilderCanvas({ initialLayout, onSave }: Props) {
  const [layout, setLayout] = useState<CustomBillLayout>(initialLayout || DEFAULT_BILL_LAYOUT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedElement, setDraggedElement] = useState<LayoutElement | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [history, setHistory] = useState<CustomBillLayout[]>([]);

  const selectedElement = layout.elements.find((el) => el.id === selectedId);

  const pushHistory = (newLayout: CustomBillLayout) => {
    setHistory((prev) => [...prev.slice(-10), layout]);
    setLayout(newLayout);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setLayout(prev);
  };

  const handleAddElement = (type: LayoutElement["type"], binding?: string, content?: string) => {
    const newEl: LayoutElement = {
      id: `el-${Date.now()}`,
      type,
      x: 50,
      y: 100 + layout.elements.length * 20,
      width: type === "table" || type === "divider" ? 700 : 250,
      height: type === "table" ? 300 : type === "divider" ? 2 : 30,
      fieldBinding: binding,
      content: content || (type === "text" ? "New Text Element" : undefined),
      fontSize: 12,
      fontWeight: "normal",
      align: "left",
      color: "#0F172A",
    };

    pushHistory({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    setSelectedId(newEl.id);
    toast.success("Element added to canvas!");
  };

  const handleUpdateSelected = (updates: Partial<LayoutElement>) => {
    if (!selectedId) return;
    const updated = layout.elements.map((el) =>
      el.id === selectedId ? { ...el, ...updates } : el
    );
    setLayout({ ...layout, elements: updated });
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    pushHistory({
      ...layout,
      elements: layout.elements.filter((el) => el.id !== selectedId),
    });
    setSelectedId(null);
    toast.info("Element removed.");
  };

  const handleSave = () => {
    if (onSave) {
      onSave(layout);
    }
    toast.success("Bill layout saved successfully!");
  };

  const handlePreviewPDF = () => {
    try {
      const mockBill = {
        business: {
          name: "TAS Garment Industries",
          address: "123 Textile Hub, GIDC, Ahmedabad",
          gstin: "24AAAAA0000A1Z5",
        },
        party: {
          name: "Billy Butcher (oi_cunts)",
          gstin: "24BBBCC1111B2Z9",
        },
        bill: {
          bill_number: "INV-2026-07-001",
          bill_date: "2026-07-23",
          totals_summary: "Subtotal: ₹37,500\nCGST (6%): ₹2,250\nSGST (6%): ₹2,250\nGrand Total: ₹42,000",
        },
        items: [
          { design_number: "DENIM-001", size: "32", quantity: 50, rate: 450, amount: 22500 },
          { design_number: "DENIM-002", size: "34", quantity: 30, rate: 500, amount: 15000 },
        ],
      };

      const doc = renderCustomLayoutPDF(layout, mockBill);
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (err: any) {
      toast.error("Failed to generate PDF preview: " + err.message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[var(--page-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 bg-[var(--card-bg)] border-b border-[var(--border)] px-4 flex items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Custom Bill Layout Designer
          </h2>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] font-semibold">
            {layout.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Undo
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => pushHistory(DEFAULT_BILL_LAYOUT)}
            className="text-xs"
          >
            Reset Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPDF}
            className="text-xs text-[var(--primary)] border-[var(--primary)]"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Preview PDF
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Layout
          </Button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Palette */}
        <div className="w-64 bg-[var(--card-bg)] border-r border-[var(--border)] p-4 space-y-5 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Business Fields
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.name")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Business Name
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.address")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Business Address
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.gstin")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Business GSTIN
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Billed Party Fields
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "party.name")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Customer Name
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "party.gstin")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Customer GSTIN
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Invoice Elements
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.bill_number")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Invoice Number
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.bill_date")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Invoice Date
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("table")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-2"
              >
                <TableIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
                Items Table
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.totals_summary")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                Totals Summary Box
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Extras & Static Text
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("text", undefined, "Sample Header Title")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-2"
              >
                <Type className="w-3.5 h-3.5 text-[var(--primary)]" />
                Free Static Text
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("divider")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-2"
              >
                <Minus className="w-3.5 h-3.5 text-[var(--primary)]" />
                Horizontal Divider Line
              </button>
            </div>
          </div>
        </div>

        {/* Center A4 Canvas Area */}
        <div className="flex-1 p-6 overflow-auto flex justify-center bg-[#475569]/10">
          <div
            className="relative bg-white shadow-xl rounded border border-gray-300 select-none transition-all"
            style={{
              width: `${layout.canvasWidth || 794}px`,
              height: `${layout.canvasHeight || 1123}px`,
            }}
            onClick={() => setSelectedId(null)}
          >
            {layout.elements.map((el) => {
              const isSelected = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                  style={{
                    position: "absolute",
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    height: el.height ? `${el.height}px` : "auto",
                    fontSize: `${el.fontSize || 12}px`,
                    fontWeight: el.fontWeight || "normal",
                    textAlign: el.align || "left",
                    color: el.color || "#0F172A",
                  }}
                  className={`cursor-pointer group p-1 transition-all rounded ${
                    isSelected
                      ? "ring-2 ring-[var(--primary)] bg-[var(--primary-light)]/20"
                      : "hover:ring-1 hover:ring-[var(--primary)]/50"
                  }`}
                >
                  {el.type === "text" && (el.content || "Text Element")}
                  {el.type === "field" && `{${el.fieldBinding}}`}
                  {el.type === "divider" && (
                    <div
                      className="w-full h-0.5"
                      style={{ backgroundColor: el.borderColor || "#CBD5E1" }}
                    />
                  )}
                  {el.type === "table" && (
                    <div className="w-full border border-gray-200 rounded p-2 text-xs text-gray-500 bg-gray-50">
                      <div className="font-bold border-b border-gray-300 pb-1 flex justify-between">
                        <span>Items Table Placeholder</span>
                        <span>[Auto-Table Rendered on PDF]</span>
                      </div>
                      <div className="py-4 text-center text-gray-400 font-mono">
                        Design Code | Size | Qty | Rate | Amount
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-72 bg-[var(--card-bg)] border-l border-[var(--border)] p-4 overflow-y-auto space-y-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
            Element Properties
          </h3>

          {selectedElement ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Element ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedElement.id}
                  className="w-full px-2 py-1 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[var(--text-muted)] font-mono text-[10px]"
                />
              </div>

              {selectedElement.type === "text" && (
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Text Content
                  </label>
                  <textarea
                    rows={3}
                    value={selectedElement.content || ""}
                    onChange={(e) => handleUpdateSelected({ content: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              )}

              {selectedElement.type === "field" && (
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Field Binding
                  </label>
                  <input
                    type="text"
                    value={selectedElement.fieldBinding || ""}
                    onChange={(e) => handleUpdateSelected({ fieldBinding: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--primary)] font-mono text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    X Position (px)
                  </label>
                  <input
                    type="number"
                    value={selectedElement.x}
                    onChange={(e) => handleUpdateSelected({ x: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[var(--text-primary)] block mb-1">
                    Y Position (px)
                  </label>
                  <input
                    type="number"
                    value={selectedElement.y}
                    onChange={(e) => handleUpdateSelected({ y: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Font Size ({selectedElement.fontSize || 12}px)
                </label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  value={selectedElement.fontSize || 12}
                  onChange={(e) => handleUpdateSelected({ fontSize: Number(e.target.value) })}
                  className="w-full accent-[var(--primary)]"
                />
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Text Alignment
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateSelected({ align: "left" })}
                    className={`p-1.5 rounded border flex-1 flex justify-center ${
                      selectedElement.align === "left"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelected({ align: "center" })}
                    className={`p-1.5 rounded border flex-1 flex justify-center ${
                      selectedElement.align === "center"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelected({ align: "right" })}
                    className={`p-1.5 rounded border flex-1 flex justify-center ${
                      selectedElement.align === "right"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-[var(--text-primary)] block mb-1">
                  Font Weight
                </label>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateSelected({
                      fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold",
                    })
                  }
                  className={`w-full py-1.5 px-3 rounded border flex items-center justify-center gap-2 font-bold ${
                    selectedElement.fontWeight === "bold"
                      ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" />
                  {selectedElement.fontWeight === "bold" ? "Bold Text" : "Normal Text"}
                </button>
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="w-full text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove Element
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              Click any element on the A4 canvas to edit its properties.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
