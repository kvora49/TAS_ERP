"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Eye,
  Printer,
  Keyboard,
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Truck,
  SlidersHorizontal,
} from "lucide-react";
import { isValidBarcodePayload, generate1DBarcode } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function MasterDataBarcodePage() {
  const [activeTab, setActiveTab] = useState<"scan" | "generator">("scan");
  const [inputUuid, setInputUuid] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedStock, setScannedStock] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "not_found" | "invalid">("idle");
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  // Generator state
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);
  const [singlePrintLabel, setSinglePrintLabel] = useState<any | null>(null);

  // Search & Pagination in Generator Tab
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const handleAfterPrint = () => {
      setSinglePrintLabel(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const handlePrintIndividual = (lbl: any) => {
    setSinglePrintLabel(lbl);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintAll = () => {
    setSinglePrintLabel(null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const fetchStockLabels = async () => {
    setLoadingLabels(true);
    try {
      const res = await fetch("/api/finished-stock/qr/list");
      const data = await res.json();
      if (res.ok && data.labels) {
        setGeneratedLabels(data.labels);
      } else {
        toast.error(data.error || "Failed to load stock labels");
      }
    } catch (err) {
      toast.error("Network error loading barcode labels");
    } finally {
      setLoadingLabels(false);
    }
  };

  useEffect(() => {
    if (activeTab === "generator") {
      fetchStockLabels();
    }
  }, [activeTab]);

  const handleScanLookup = async (codeToScan: string) => {
    const trimmed = codeToScan.trim();
    if (!trimmed) return;

    if (!isValidBarcodePayload(trimmed)) {
      setScanStatus("invalid");
      toast.error("Invalid barcode payload format.");
      return;
    }

    setLoading(true);
    setScanStatus("idle");

    try {
      const res = await fetch("/api/finished-stock/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.found && data.stock) {
        setScannedStock(data.stock);
        setScanStatus("success");
        setScanHistory((prev) => [
          {
            id: data.stock.id,
            barcode: trimmed,
            design_code: data.stock.designs?.design_number || "DES-001",
            colour: data.stock.design_colours?.colour_name || "Standard",
            size: data.stock.size || data.stock.resolved_size || "M",
            godown: data.stock.godowns?.name || "Main Godown",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "In Stock",
          },
          ...prev,
        ]);
        toast.success("Item authenticated successfully!");
      } else {
        setScannedStock(null);
        setScanStatus("not_found");
        toast.error(data.message || "Stock item not found.");
      }
    } catch (err: any) {
      toast.error("Error looking up barcode.");
      setScanStatus("not_found");
    } finally {
      setLoading(false);
    }
  };

  // Filter labels based on search query
  const filteredLabels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return generatedLabels;
    return generatedLabels.filter((lbl) => {
      return (
        lbl.design_name?.toLowerCase().includes(q) ||
        lbl.design_code?.toLowerCase().includes(q) ||
        lbl.design_number?.toLowerCase().includes(q) ||
        lbl.colour_name?.toLowerCase().includes(q) ||
        lbl.size?.toLowerCase().includes(q) ||
        lbl.barcode?.toLowerCase().includes(q) ||
        lbl.godown_name?.toLowerCase().includes(q)
      );
    });
  }, [generatedLabels, searchQuery]);

  // Paginated labels
  const totalPages = Math.max(1, Math.ceil(filteredLabels.length / pageSize));
  const paginatedLabels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLabels.slice(start, start + pageSize);
  }, [filteredLabels, page, pageSize]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] select-none print:hidden">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <Link href="/master-data" className="hover:text-[var(--primary)] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-primary)] font-bold">Barcode Management</span>
      </div>

      {/* Header & Navigation App Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer shrink-0"
            title="Back to Master Data"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Barcode Management
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                1D Code128
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Generate printable SKU labels or scan items for real-time inventory lookup
            </p>
          </div>
        </div>

        {/* Scanner link button */}
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--primary)]/15"
          >
            <Barcode className="h-4 w-4" />
            <span>Open PWA Scanner</span>
          </Link>
        </div>
      </div>

      {/* Sleek Segmented Subtabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl w-fit print:hidden">
        <button
          onClick={() => setActiveTab("scan")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "scan"
              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Keyboard size={14} />
          <span>Scan & Lookup</span>
        </button>
        <button
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "generator"
              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Printer size={14} />
          <span>Generate & Print</span>
          {generatedLabels.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--input-bg)] text-[var(--text-muted)]">
              {generatedLabels.length}
            </span>
          )}
        </button>
      </div>

      {/* ── ISOLATED SINGLE LABEL PRINT CONTAINER ── */}
      {singlePrintLabel && (
        <div className="hidden print:flex print:flex-col print:items-center print:justify-start print:min-h-screen print:pt-6">
          {(() => {
            const barcodePayload = singlePrintLabel.barcode || singlePrintLabel.qr_uuid;
            const barcodeImg = generate1DBarcode(barcodePayload, { height: 44, width: 2 });
            return (
              <div className="border-2 border-slate-700 rounded-xl p-4 bg-white text-black w-[75mm] space-y-2.5 mx-auto block print:block">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">
                      TAS ERP GARMENTS
                    </span>
                    <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                      {singlePrintLabel.design_name}
                    </h4>
                  </div>
                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 font-black text-xs rounded">
                    SIZE: {singlePrintLabel.size}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">Design Code</span>
                    <span className="font-extrabold text-slate-800">
                      {singlePrintLabel.design_code || singlePrintLabel.design_number || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">Colour</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {singlePrintLabel.colour_hex && (
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-400 inline-block"
                          style={{ backgroundColor: singlePrintLabel.colour_hex }}
                        />
                      )}
                      <span className="font-extrabold text-slate-800 capitalize">
                        {singlePrintLabel.colour_name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barcode Graphic */}
                <div className="py-2 px-1.5 bg-white rounded border border-slate-200 flex flex-col items-center justify-center space-y-1">
                  {barcodeImg ? (
                    <img src={barcodeImg} alt="1D Barcode" className="h-11 w-auto max-w-full object-contain" />
                  ) : (
                    <div className="flex items-end justify-center h-10 gap-[1.5px] px-2 overflow-hidden">
                      {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 2, 1, 3, 2, 1, 4, 1, 2].map((w, idx) => (
                        <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w * 1.5}px` }} />
                      ))}
                    </div>
                  )}
                  <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                    {barcodePayload}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 pt-0.5">
                  <span>PRICE: ₹{Number(singlePrintLabel.sale_price || 0).toFixed(2)}</span>
                  <span className="text-[8px] text-slate-400 uppercase">{singlePrintLabel.godown_name}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB 1: GENERATE & PRINT ── */}
      {activeTab === "generator" ? (
        <div
          className={`bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6 ${
            singlePrintLabel
              ? "print:hidden"
              : "print:p-0 print:border-none print:shadow-none print:bg-transparent"
          }`}
        >
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4 print:hidden">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                SKU 1D Barcode Labels
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Prints standard Code 128 linear barcodes based on design code, colour, and size breakdown.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintAll}
                disabled={loadingLabels || filteredLabels.length === 0}
                className="h-9 px-3.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print All ({filteredLabels.length})</span>
              </button>
            </div>
          </div>

          {/* Live Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-faint)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by design code, name, colour, size..."
                className="w-full h-10 pl-9 pr-8 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-[var(--text-muted)]">
              Showing <strong className="text-[var(--text-primary)]">{filteredLabels.length}</strong> items
              {searchQuery && <span> (filtered from {generatedLabels.length})</span>}
            </div>
          </div>

          {/* Labels Grid */}
          {loadingLabels ? (
            <div className="py-20 text-center text-[var(--text-muted)] font-bold text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin h-6 w-6 text-[var(--primary)]" />
              <span>Loading stock labels from catalog...</span>
            </div>
          ) : filteredLabels.length === 0 ? (
            <div className="py-16 text-center bg-[var(--page-bg)] rounded-2xl border border-dashed border-[var(--border)] p-6 space-y-2">
              <Barcode className="mx-auto text-[var(--text-faint)] h-10 w-10" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {searchQuery ? "No Matching Labels Found" : "No Stock Items Found"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {searchQuery
                  ? "Try searching for a different design number, colour, or size."
                  : "Post finished stock entries or production lots to generate printable tags."}
              </p>
            </div>
          ) : (
            <>
              {/* Responsive Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 print:grid print:grid-cols-2 print:gap-4 print:justify-items-center print:w-full print:overflow-visible">
                {paginatedLabels.map((lbl, idx) => {
                  const barcodePayload = lbl.barcode || lbl.qr_uuid;
                  const barcodeImg = generate1DBarcode(barcodePayload, { height: 42, width: 2 });

                  return (
                    <div
                      key={lbl.id || lbl.stock_id || barcodePayload || idx}
                      className="border border-[var(--border)] rounded-2xl p-4 bg-[var(--card-bg)] space-y-3 relative group hover:border-[var(--primary)]/60 hover:shadow-sm transition-all print:border-solid print:border-slate-400 print:rounded-lg print:w-[80mm] print:mx-auto print:break-inside-avoid break-inside-avoid print:bg-white print:text-black"
                    >
                      {/* Card Header: Brand & Size */}
                      <div className="flex items-center justify-between border-b border-[var(--border)] print:border-slate-200 pb-2">
                        <div className="min-w-0 pr-2">
                          <span className="text-[9px] font-black uppercase text-[var(--primary)] print:text-indigo-600 tracking-wider block">
                            TAS ERP GARMENTS
                          </span>
                          <h4 className="font-extrabold text-sm text-[var(--text-primary)] print:text-slate-900 leading-tight truncate">
                            {lbl.design_name}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 bg-[var(--input-bg)] print:bg-slate-100 border border-[var(--border)] print:border-slate-200 text-[var(--text-primary)] print:text-slate-800 font-extrabold text-xs rounded shrink-0">
                          SIZE: {lbl.size}
                        </span>
                      </div>

                      {/* Design Code & Colour */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[9px] text-[var(--text-muted)] print:text-slate-400 font-bold uppercase block">
                            Design Code
                          </span>
                          <span className="font-extrabold text-[var(--text-primary)] print:text-slate-800 truncate block">
                            {lbl.design_code || lbl.design_number || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--text-muted)] print:text-slate-400 font-bold uppercase block">
                            Colour
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {lbl.colour_hex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-[var(--border)] print:border-slate-400 shrink-0"
                                style={{ backgroundColor: lbl.colour_hex }}
                              />
                            )}
                            <span className="font-extrabold text-[var(--text-primary)] print:text-slate-800 capitalize truncate">
                              {lbl.colour_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 1D Barcode Graphic Box */}
                      <div className="py-2.5 px-2 bg-white rounded-xl border border-[var(--border)] print:border-slate-200 flex flex-col items-center justify-center space-y-1">
                        {barcodeImg ? (
                          <img src={barcodeImg} alt="1D Barcode" className="h-11 w-auto max-w-full object-contain" />
                        ) : (
                          <div className="flex items-end justify-center h-10 gap-[1.5px] px-2 overflow-hidden">
                            {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 2, 1, 3, 2, 1, 4, 1, 2].map((w, i) => (
                              <div key={i} className="bg-slate-900 h-full" style={{ width: `${w * 1.5}px` }} />
                            ))}
                          </div>
                        )}
                        <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                          {barcodePayload}
                        </span>
                      </div>

                      {/* Card Footer: Price & Single Print Button */}
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[var(--border-light)] print:border-slate-100">
                        <span className="text-[11px] text-[var(--text-secondary)] print:text-slate-600">
                          PRICE: <strong className="text-[var(--text-primary)]">₹{Number(lbl.sale_price || 0).toFixed(2)}</strong>
                        </span>

                        <button
                          onClick={() => handlePrintIndividual(lbl)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all print:hidden flex items-center gap-1.5 cursor-pointer font-bold text-xs"
                          title="Print Single Tag"
                        >
                          <Printer size={12} />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border)] text-xs print:hidden">
                  <span className="text-[var(--text-muted)]">
                    Page <strong className="text-[var(--text-primary)]">{page}</strong> of{" "}
                    <strong className="text-[var(--text-primary)]">{totalPages}</strong> ({filteredLabels.length} items)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft size={15} />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = page - 2 + i;
                      if (pageNum < 1) pageNum = i + 1;
                      if (pageNum > totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            page === pageNum
                              ? "bg-[var(--primary)] text-white shadow-xs"
                              : "bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── TAB 2: SCAN & LOOKUP ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 print:hidden">
          {/* Left Column: Scanner Input & Authenticated Card */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 sm:p-6 shadow-sm space-y-3 sm:space-y-4">
              <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[var(--primary)]" />
                <span>1D Barcode Lookup</span>
              </h2>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Scan with a handheld laser scanner or enter a barcode SKU ID (e.g. <strong>DW-02-30</strong>, <strong>DES-001-FREE</strong>). Instant item lookup from finished goods inventory.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="text"
                  value={inputUuid}
                  onChange={(e) => setInputUuid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScanLookup(inputUuid);
                  }}
                  placeholder="Scan barcode or type SKU ID..."
                  className="flex-1 h-11 px-3.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-xs font-mono font-bold transition-colors"
                />
                <button
                  onClick={() => handleScanLookup(inputUuid)}
                  disabled={loading || !inputUuid.trim()}
                  className="h-11 px-5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye size={15} />}
                  <span>Lookup</span>
                </button>
              </div>
            </div>

            {/* Scanned Stock Result Card */}
            {scannedStock && (
              <div className="bg-[var(--card-bg)] rounded-2xl border border-emerald-500/40 p-4 sm:p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      Stock Item Authenticated
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold rounded-full uppercase">
                    {scannedStock.status || "In Stock"}
                  </span>
                </div>

                {/* 2x2 Responsive Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 text-xs">
                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Design Code
                    </span>
                    <span className="font-extrabold text-[var(--primary)]">
                      {scannedStock.designs?.design_number || "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Style Name
                    </span>
                    <span className="font-bold text-[var(--text-primary)] truncate block">
                      {scannedStock.designs?.name || "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Colour
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {scannedStock.design_colours?.colour_name || "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Size
                    </span>
                    <span className="font-extrabold text-[var(--text-primary)]">
                      {scannedStock.size || scannedStock.resolved_size || "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Available Stock
                    </span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {scannedStock.resolved_quantity ?? scannedStock.total_quantity ?? 1} Pcs
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Sale Price
                    </span>
                    <span className="font-extrabold text-[var(--text-primary)]">
                      ₹{Number(scannedStock.designs?.sale_price || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl col-span-2">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">
                      Storage Godown
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {scannedStock.godowns?.name || "Main Godown"}
                    </span>
                  </div>
                </div>

                {/* ERP Action Buttons: Clean 2x2 Grid on Mobile */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                    Quick Actions
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Link
                      href={`/sales/bills/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}&price=${scannedStock.designs?.sale_price || 0}`}
                      className="h-10 px-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag size={14} />
                      <span>Sales Bill</span>
                    </Link>

                    <Link
                      href={`/sales/returns/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}`}
                      className="h-10 px-3 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Sales Return</span>
                    </Link>

                    <Link
                      href={`/finished-stock/operations?tab=transfer&stock_id=${scannedStock.id}&size=${encodeURIComponent(scannedStock.size || "")}`}
                      className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Truck size={14} />
                      <span>Transfer</span>
                    </Link>

                    <Link
                      href={`/finished-stock/operations?tab=adjustment&stock_id=${scannedStock.id}&size=${encodeURIComponent(scannedStock.size || "")}`}
                      className="h-10 px-3 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <SlidersHorizontal size={14} />
                      <span>Adjustment</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Scan History */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--primary)]" />
                <span>Recent History</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--input-bg)] border border-[var(--border)] font-bold text-[var(--text-muted)]">
                {scanHistory.length}
              </span>
            </div>

            {scanHistory.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)] text-xs">
                No items scanned in this session yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-xs space-y-1 hover:border-[var(--primary)]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[var(--primary)] font-mono">{item.barcode || item.design_code}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                      Colour: <strong className="text-[var(--text-primary)]">{item.colour}</strong> • Size:{" "}
                      <strong className="text-[var(--text-primary)]">{item.size}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
