"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ArrowLeftRight,
  Truck,
  Printer,
  Keyboard,
  Info,
  Clock,
  Download,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";
import { isValidBarcodePayload, generate1DBarcode } from "@/lib/utils/barcode";
import { toast } from "sonner";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { MASTER_DATA_NAV } from "@/lib/moduleNav";

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

  useEffect(() => {
    const handleAfterPrint = () => {
      setSinglePrintLabel(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const isSelectedForIndividualPrint = (lbl: any) => {
    if (!singlePrintLabel) return false;
    const targetCode = singlePrintLabel.barcode || singlePrintLabel.qr_uuid;
    const currentCode = lbl.barcode || lbl.qr_uuid;
    if (targetCode && currentCode) {
      return targetCode === currentCode;
    }
    if (singlePrintLabel.id && lbl.id) {
      return singlePrintLabel.id === lbl.id;
    }
    return false;
  };

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
            time: new Date().toLocaleTimeString(),
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] print:hidden">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <Link href="/master-data/designs" className="hover:text-[var(--primary)] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-primary)] font-bold">Barcode Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Barcode Management</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">Generate printable 1D SKU labels or scan items for real-time inventory lookup</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Sub-tabs */}
          <div className="bg-[var(--input-bg)] p-1 rounded-xl flex gap-1 border border-[var(--border)]">
            <button
              onClick={() => setActiveTab("scan")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === "scan"
                  ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Scan & Lookup
            </button>
            <button
              onClick={() => setActiveTab("generator")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === "generator"
                  ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Generate & Print
            </button>
          </div>

          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-bold transition-colors cursor-pointer shadow-md"
          >
            <Barcode className="h-4 w-4" />
            <span>Open PWA Scanner</span>
          </Link>
        </div>
      </div>

      <ModuleSubNav items={MASTER_DATA_NAV} />

      {/* Main Content View */}
      {activeTab === "generator" ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-sm space-y-6 print:p-0 print:border-none print:shadow-none print:bg-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4 print:hidden">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">SKU 1D Barcode Generator</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Prints standard high-contrast 1D linear barcodes (CODE128) based on brand numbering, design code, and size.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrintAll}
                className="h-9 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print All Labels</span>
              </button>
            </div>
          </div>

          {/* Labels Grid */}
          {loadingLabels ? (
            <div className="py-20 text-center text-[var(--text-muted)] font-bold text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin h-5 w-5 text-[var(--primary)]" />
              <span>Loading stock labels from database...</span>
            </div>
          ) : generatedLabels.length === 0 ? (
            <div className="py-16 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
              <Barcode className="mx-auto text-[var(--text-faint)] h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-[var(--text-primary)]">No Stock Items Found</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Post stock entries or production lots to generate printable tags.</p>
            </div>
          ) : (
            <div
              className={
                singlePrintLabel !== null
                  ? "flex justify-center items-center w-full pt-8 print:w-full print:pt-8 print:flex print:justify-center print:items-center print:overflow-visible"
                  : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid print:grid-cols-2 print:gap-4 print:justify-items-center print:w-full print:overflow-visible"
              }
            >
              {generatedLabels.map((lbl, idx) => {
                const barcodePayload = lbl.barcode || lbl.qr_uuid;
                const barcodeImg = generate1DBarcode(barcodePayload, { height: 48, width: 2 });
                const isHiddenInPrint = singlePrintLabel !== null && !isSelectedForIndividualPrint(lbl);

                return (
                  <div
                    key={lbl.id || lbl.stock_id || barcodePayload || idx}
                    className={`border-2 border-dashed border-[var(--border)] rounded-xl p-4 bg-[var(--card-bg)] space-y-3 relative group hover:border-[var(--primary)] transition-all print:border-solid print:border-slate-400 print:rounded-lg print:w-[85mm] print:mx-auto print:break-inside-avoid break-inside-avoid print:bg-white print:text-black ${
                      isHiddenInPrint ? "print:hidden" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border)] print:border-slate-200 pb-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-[var(--primary)] print:text-indigo-600 tracking-wider">TAS ERP GARMENTS</span>
                        <h4 className="font-extrabold text-sm text-[var(--text-primary)] print:text-slate-900 leading-tight">{lbl.design_name}</h4>
                      </div>
                      <span className="px-2 py-0.5 bg-[var(--input-bg)] print:bg-slate-100 border border-[var(--border)] print:border-slate-200 text-[var(--text-primary)] print:text-slate-800 font-extrabold text-xs rounded">
                        SIZE: {lbl.size}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-[var(--text-muted)] print:text-slate-400 font-bold uppercase block">Design Code</span>
                        <span className="font-extrabold text-[var(--text-primary)] print:text-slate-800">{lbl.design_code || lbl.design_number || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[var(--text-muted)] print:text-slate-400 font-bold uppercase block">Colour</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lbl.colour_hex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-[var(--border)] print:border-slate-400 inline-block"
                              style={{ backgroundColor: lbl.colour_hex }}
                            />
                          )}
                          <span className="font-extrabold text-[var(--text-primary)] print:text-slate-800 capitalize">{lbl.colour_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* 1D Barcode Representation */}
                    <div className="py-2.5 px-2 bg-white rounded-lg border border-[var(--border)] print:border-slate-200 flex flex-col items-center justify-center space-y-1">
                      {barcodeImg ? (
                        <img src={barcodeImg} alt="1D Barcode" className="h-12 w-auto max-w-full object-contain" />
                      ) : (
                        <div className="flex items-end justify-center h-12 gap-[1.5px] px-2 overflow-hidden">
                          {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 2, 1, 3, 2, 1, 4, 1, 2].map((w, idx) => (
                            <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w * 1.5}px` }} />
                          ))}
                        </div>
                      )}
                      {/* Short, Readable Barcode ID */}
                      <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                        {barcodePayload}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] print:text-slate-500 pt-1">
                      <span>PRICE: ₹{Number(lbl.sale_price || 0).toFixed(2)}</span>
                      <button
                        onClick={() => handlePrintIndividual(lbl)}
                        className="p-1 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded transition-colors print:hidden flex items-center gap-1 cursor-pointer font-bold"
                        title="Print Single Tag"
                      >
                        <Printer size={13} />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SCAN & LOOKUP TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Manual / Hardware Scanner Input */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[var(--primary)]" />
                <span>1D Barcode Lookup</span>
              </h2>

              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Scan with a handheld 1D laser scanner or type a barcode ID (e.g. <strong>NIG.0042-M</strong>, <strong>DES-001-FREE</strong>). Instant stock lookup with zero external exposure.
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputUuid}
                    onChange={(e) => setInputUuid(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleScanLookup(inputUuid);
                    }}
                    placeholder="Scan barcode or enter ID (e.g. NIG.0042-M)..."
                    className="flex-1 h-11 px-4 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-xs font-mono font-bold transition-colors"
                  />
                  <button
                    onClick={() => handleScanLookup(inputUuid)}
                    disabled={loading || !inputUuid.trim()}
                    className="h-11 px-5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye size={16} />}
                    <span>Lookup</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scanned Stock Result Card */}
            {scannedStock && (
              <div className="bg-[var(--card-bg)] rounded-2xl border border-emerald-500/40 p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">Stock Item Authenticated</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold rounded-full uppercase">
                    Status: {scannedStock.status || "In Stock"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Design Code</span>
                    <span className="font-extrabold text-[var(--primary)]">{scannedStock.designs?.design_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Style Name</span>
                    <span className="font-bold text-[var(--text-primary)]">{scannedStock.designs?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Colour</span>
                    <span className="font-bold text-[var(--text-primary)]">{scannedStock.design_colours?.colour_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Size</span>
                    <span className="font-extrabold text-[var(--text-primary)]">{scannedStock.size || scannedStock.resolved_size || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Storage Godown</span>
                    <span className="font-bold text-[var(--text-primary)]">{scannedStock.godowns?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Available Stock</span>
                    <span className="font-extrabold text-emerald-500">{scannedStock.resolved_quantity ?? scannedStock.total_quantity ?? 1} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block">Sale Price</span>
                    <span className="font-extrabold text-[var(--primary)]">₹{Number(scannedStock.designs?.sale_price || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Quick ERP Action Buttons */}
                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
                  <Link
                    href={`/sales/bills/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}&price=${scannedStock.designs?.sale_price || 0}`}
                    className="px-3.5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛒 Create Sales Bill</span>
                  </Link>

                  <Link
                    href={`/sales/returns/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}`}
                    className="px-3.5 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>↩️ Create Sales Return</span>
                  </Link>

                  <Link
                    href={`/finished-stock/operations?tab=transfer&stock_id=${scannedStock.id}&size=${encodeURIComponent(scannedStock.size || "")}`}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🚚 Godown Transfer</span>
                  </Link>

                  <Link
                    href={`/finished-stock/operations?tab=adjustment&stock_id=${scannedStock.id}&size=${encodeURIComponent(scannedStock.size || "")}`}
                    className="px-3.5 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Stock Adjustment</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Scan History */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--primary)]" />
              <span>Recent Scan History ({scanHistory.length})</span>
            </h3>

            {scanHistory.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)] text-xs">
                No items scanned in this session.
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[var(--primary)]">{item.barcode || item.design_code}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                      Colour: <strong className="text-[var(--text-primary)]">{item.colour}</strong> • Size: <strong className="text-[var(--text-primary)]">{item.size}</strong>
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
