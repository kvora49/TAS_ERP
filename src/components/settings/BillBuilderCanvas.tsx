"use client";

import React, { useState, useEffect } from "react";
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  CustomBillLayout,
  DEFAULT_BILL_LAYOUT,
  LayoutElement,
  renderCustomLayoutPDF,
} from "@/lib/pdf/custom-layout-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  initialLayout?: CustomBillLayout;
  onSave?: (layout: CustomBillLayout) => void;
}

export function BillBuilderCanvas({ initialLayout, onSave }: Props) {
  const [layout, setLayout] = useState<CustomBillLayout>(
    initialLayout || DEFAULT_BILL_LAYOUT
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomBillLayout[]>([]);
  const [mobileStudioTab, setMobileStudioTab] = useState<
    "canvas" | "palette" | "properties"
  >("canvas");
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Auto-fit initial zoom scale based on screen width
  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window.innerWidth;
      if (w < 440) {
        setZoomScale(0.40);
      } else if (w < 640) {
        setZoomScale(0.48);
      } else if (w < 1024) {
        setZoomScale(0.68);
      } else {
        setZoomScale(1);
      }
    }
  }, []);

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

  const handleAddElement = (
    type: LayoutElement["type"],
    binding?: string,
    content?: string
  ) => {
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
    // On mobile, switch directly to canvas view so user sees the newly added element
    setMobileStudioTab("canvas");
    toast.success("Element added to canvas! Tap it to edit properties.");
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
          totals_summary:
            "Subtotal: ₹37,500\nCGST (6%): ₹2,250\nSGST (6%): ₹2,250\nGrand Total: ₹42,000",
        },
        items: [
          {
            design_number: "DENIM-001",
            size: "32",
            quantity: 50,
            rate: 450,
            amount: 22500,
          },
          {
            design_number: "DENIM-002",
            size: "34",
            quantity: 30,
            rate: 500,
            amount: 15000,
          },
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
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-[var(--page-bg)] rounded-xl border border-[var(--border)] overflow-hidden shadow-xs">
      {/* Top Toolbar */}
      <div className="h-12 sm:h-14 bg-[var(--card-bg)] border-b border-[var(--border)] px-3 sm:px-4 flex items-center justify-between gap-2 select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
            Bill Designer
          </h2>
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] font-semibold hidden md:inline-block truncate max-w-[120px]">
            {layout.name}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="text-xs h-8 px-2 sm:px-2.5"
            title="Undo last change"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Undo</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => pushHistory(DEFAULT_BILL_LAYOUT)}
            className="text-xs h-8 px-2 sm:px-2.5 hidden sm:flex"
          >
            Reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPDF}
            className="text-xs h-8 px-2 sm:px-2.5 text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary-light)]"
          >
            <Eye className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Preview PDF</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs h-8 px-2.5 sm:px-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
          >
            <Save className="w-3.5 h-3.5 sm:mr-1" />
            <span>Save</span>
          </Button>
        </div>
      </div>

      {/* Mobile Studio Tabs Switcher (< lg) */}
      <div className="lg:hidden flex border-b border-[var(--border)] bg-[var(--card-bg)] p-1.5 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileStudioTab("canvas")}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer",
            mobileStudioTab === "canvas"
              ? "bg-[var(--primary)] text-white shadow-xs"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--page-bg)]"
          )}
        >
          <Eye className="size-3.5" />
          <span>Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileStudioTab("palette")}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer",
            mobileStudioTab === "palette"
              ? "bg-[var(--primary)] text-white shadow-xs"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--page-bg)]"
          )}
        >
          <Plus className="size-3.5" />
          <span>+ Elements</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileStudioTab("properties")}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer relative",
            mobileStudioTab === "properties"
              ? "bg-[var(--primary)] text-white shadow-xs"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--page-bg)]"
          )}
        >
          <Sliders className="size-3.5" />
          <span>Properties</span>
          {selectedId && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Left Palette (Elements library) */}
        <div
          className={cn(
            "w-full lg:w-64 bg-[var(--card-bg)] border-r border-[var(--border)] p-4 space-y-5 overflow-y-auto shrink-0",
            mobileStudioTab === "palette" ? "block" : "hidden lg:block"
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Component Palette
            </h3>
            <span className="text-[10px] text-[var(--text-faint)] lg:hidden">
              Tap to add
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Business Fields
            </h4>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.name")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Business Name
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.address")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Business Address
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "business.gstin")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Business GSTIN
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Billed Party Fields
            </h4>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "party.name")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Customer Name
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "party.gstin")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Customer GSTIN
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Invoice Elements
            </h4>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.bill_number")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Invoice Number
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.bill_date")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Invoice Date
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("table")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-1.5 cursor-pointer"
              >
                <TableIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>+ Items Table</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("field", "bill.totals_summary")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] cursor-pointer"
              >
                + Totals Summary Box
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Extras &amp; Static Text
            </h4>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleAddElement("text", undefined, "Sample Static Text")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-1.5 cursor-pointer"
              >
                <Type className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>+ Free Static Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddElement("divider")}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--page-bg)] hover:bg-[var(--border-light)] text-xs font-medium text-[var(--text-primary)] transition-colors border border-[var(--border)] flex items-center gap-1.5 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>+ Horizontal Divider Line</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Center A4 Canvas Area with Zoom Controls */}
        <div
          className={cn(
            "flex-1 p-2 sm:p-6 overflow-auto flex flex-col items-center bg-[var(--page-bg)] relative",
            mobileStudioTab === "canvas" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Zoom & Canvas Controls Bar */}
          <div className="sticky top-2 z-20 mb-3 flex items-center gap-1.5 bg-[var(--card-bg)]/95 border border-[var(--border)] px-2.5 py-1 rounded-full shadow-md select-none text-xs">
            <span className="text-[11px] text-[var(--text-muted)] font-bold mr-1">
              Zoom:
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.max(0.3, Number((s - 0.1).toFixed(2))))}
              className="p-1 rounded hover:bg-[var(--page-bg)] text-[var(--text-primary)] cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="font-mono font-bold text-xs text-[var(--primary)] px-1 min-w-[36px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.min(1.5, Number((s + 0.1).toFixed(2))))}
              className="p-1 rounded hover:bg-[var(--page-bg)] text-[var(--text-primary)] cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <div className="h-3 w-px bg-[var(--border)] mx-1" />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  setZoomScale(window.innerWidth < 440 ? 0.40 : window.innerWidth < 640 ? 0.48 : window.innerWidth < 1024 ? 0.68 : 1);
                }
              }}
              className="px-2 py-0.5 rounded text-[10px] font-bold text-[var(--text-primary)] hover:bg-[var(--page-bg)] cursor-pointer"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="px-2 py-0.5 rounded text-[10px] font-bold text-[var(--text-primary)] hover:bg-[var(--page-bg)] cursor-pointer hidden sm:inline-block"
            >
              100%
            </button>
          </div>

          {/* Canvas Wrapper */}
          <div
            className="relative transition-transform origin-top select-none shadow-2xl rounded border border-gray-300 bg-white"
            style={{
              width: `${layout.canvasWidth || 794}px`,
              height: `${layout.canvasHeight || 1123}px`,
              transform: `scale(${zoomScale})`,
              transformOrigin: "top center",
              marginBottom: `${-(layout.canvasHeight || 1123) * (1 - zoomScale) + 30}px`,
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
                  className={cn(
                    "cursor-pointer group p-1 transition-all rounded",
                    isSelected
                      ? "ring-2 ring-[var(--primary)] bg-[var(--primary-light)]/30"
                      : "hover:ring-1 hover:ring-[var(--primary)]/50"
                  )}
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

          {/* Floating Selected Element Pill on Mobile */}
          {selectedElement && (
            <div className="sticky bottom-4 z-20 flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border)] px-3 py-2 rounded-xl shadow-xl animate-in fade-in-50 mt-4 max-w-[90%]">
              <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[140px]">
                {selectedElement.type === "field"
                  ? selectedElement.fieldBinding
                  : selectedElement.content || selectedElement.type}
              </span>
              <button
                type="button"
                onClick={() => setMobileStudioTab("properties")}
                className="px-2.5 py-1 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="size-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                title="Delete element"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Right Properties Panel */}
        <div
          className={cn(
            "w-full lg:w-72 bg-[var(--card-bg)] border-l border-[var(--border)] p-4 overflow-y-auto space-y-4 shrink-0",
            mobileStudioTab === "properties" ? "block" : "hidden lg:block"
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileStudioTab("canvas")}
                className="lg:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md cursor-pointer"
              >
                <ArrowLeft className="size-4" />
              </button>
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Element Properties
              </h3>
            </div>
            {selectedElement && (
              <span className="text-[10px] font-bold text-[var(--primary)] uppercase bg-[var(--primary-light)] px-1.5 py-0.5 rounded">
                {selectedElement.type}
              </span>
            )}
          </div>

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
                    onChange={(e) =>
                      handleUpdateSelected({ content: e.target.value })
                    }
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
                    onChange={(e) =>
                      handleUpdateSelected({ fieldBinding: e.target.value })
                    }
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
                    onChange={(e) =>
                      handleUpdateSelected({ x: Number(e.target.value) })
                    }
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
                    onChange={(e) =>
                      handleUpdateSelected({ y: Number(e.target.value) })
                    }
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
                  onChange={(e) =>
                    handleUpdateSelected({ fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--primary)] cursor-pointer"
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
                    className={cn(
                      "p-1.5 rounded border flex-1 flex justify-center cursor-pointer",
                      selectedElement.align === "left"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                    )}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelected({ align: "center" })}
                    className={cn(
                      "p-1.5 rounded border flex-1 flex justify-center cursor-pointer",
                      selectedElement.align === "center"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                    )}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelected({ align: "right" })}
                    className={cn(
                      "p-1.5 rounded border flex-1 flex justify-center cursor-pointer",
                      selectedElement.align === "right"
                        ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                    )}
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
                      fontWeight:
                        selectedElement.fontWeight === "bold"
                          ? "normal"
                          : "bold",
                    })
                  }
                  className={cn(
                    "w-full py-1.5 px-3 rounded border flex items-center justify-center gap-2 font-bold cursor-pointer",
                    selectedElement.fontWeight === "bold"
                      ? "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--text-muted)]"
                  )}
                >
                  <Bold className="w-3.5 h-3.5" />
                  {selectedElement.fontWeight === "bold"
                    ? "Bold Text"
                    : "Normal Text"}
                </button>
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="w-full text-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove Element
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              <p className="mb-2">No element selected.</p>
              <button
                type="button"
                onClick={() => setMobileStudioTab("canvas")}
                className="lg:hidden text-[var(--primary)] font-bold hover:underline"
              >
                Go to Canvas to select an element
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
