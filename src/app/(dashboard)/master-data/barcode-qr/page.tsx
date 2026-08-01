"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  QrCode,
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
import { isValidQRUUID, generate1DBarcode } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function MasterDataBarcodeQRPage() {
  const [activeTab, setActiveTab] = useState<"scan" | "generator">("scan");
  const [codeFormat, setCodeFormat] = useState<"barcode" | "qr">("barcode");
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
    if (singlePrintLabel.id && lbl.id) {
      return singlePrintLabel.id === lbl.id;
    }
    if (singlePrintLabel.qr_uuid && lbl.qr_uuid) {
      return singlePrintLabel.qr_uuid === lbl.qr_uuid;
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
      toast.error("Network error loading QR labels");
    } finally {
      setLoadingLabels(false);
    }
  };

  useEffect(() => {
    if (activeTab === "generator") {
      fetchStockLabels();
    }
  }, [activeTab]);

  const handleScanLookup = async (uuidToScan: string) => {
    const trimmed = uuidToScan.trim();
    if (!trimmed) return;

    if (!isValidQRUUID(trimmed)) {
      setScanStatus("invalid");
      toast.error("Invalid QR payload format. Must be a valid UUID.");
      return;
    }

    setLoading(true);
    setScanStatus("idle");

    try {
      const res = await fetch("/api/finished-stock/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_uuid: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.found && data.stock) {
        setScannedStock(data.stock);
        setScanStatus("success");
        setScanHistory((prev) => [
          {
            id: data.stock.id,
            qr_uuid: trimmed,
            design_code: data.stock.designs?.design_number || "DES-001",
            colour: data.stock.design_colours?.colour_name || "Red",
            size: data.stock.size || "M",
            godown: data.stock.godowns?.name || "Main Godown",
            time: new Date().toLocaleTimeString(),
            status: "In Stock",
          },
          ...prev,
        ]);
        toast.success("Item scanned successfully!");
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
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] print:hidden">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <Link href="/master-data/designs" className="hover:text-[#6366F1] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-[#334155] font-bold">Barcode / QR Management</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data/designs"
            className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-[#475569]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Barcode & QR Management</h1>
            <p className="text-sm text-[#64748B]">Generate printable SKU labels or scan items for real-time inventory lookup</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tabs */}
          <div className="bg-[#F1F5F9] p-1 rounded-xl flex gap-1 border border-[#E2E8F0]">
            <button
              onClick={() => setActiveTab("scan")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "scan" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Scan & Lookup
            </button>
            <button
              onClick={() => setActiveTab("generator")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "generator" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Generate & Print Labels
            </button>
          </div>

          <Link
            href="/scan"
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white text-sm font-bold transition-colors cursor-pointer shadow-md"
          >
            <QrCode className="h-4 w-4" />
            <span>Open Mobile PWA Scanner</span>
          </Link>
        </div>
      </div>

      {/* Main Content View */}
      {activeTab === "generator" ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm space-y-6 print:p-0 print:border-none print:shadow-none print:bg-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4 print:hidden">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">SKU Stock Label Generator</h2>
              <p className="text-xs text-[#64748B]">
                Lists all finished stock records. Select between standard <strong>1D Barcode</strong> or <strong>2D QR Code</strong> formats to print labels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Format Toggle: 1D Barcode vs 2D QR */}
              <div className="bg-[#F1F5F9] p-1 rounded-xl flex gap-1 border border-[#E2E8F0] text-xs font-semibold">
                <button
                  onClick={() => setCodeFormat("barcode")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    codeFormat === "barcode" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B]"
                  }`}
                >
                  1D Barcode (CODE128)
                </button>
                <button
                  onClick={() => setCodeFormat("qr")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    codeFormat === "qr" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B]"
                  }`}
                >
                  2D Security QR Code
                </button>
              </div>

              <button
                onClick={handlePrintAll}
                className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Print All Labels</span>
              </button>
            </div>
          </div>

          {/* Labels Grid */}
          {loadingLabels ? (
            <div className="py-20 text-center text-slate-500 font-bold text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin h-5 w-5 text-[#6366F1]" />
              <span>Loading stock labels from database...</span>
            </div>
          ) : generatedLabels.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <QrCode className="mx-auto text-slate-300 h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-slate-700">No Stock Items Found</p>
              <p className="text-xs text-slate-500 mt-0.5">Post stock entries or production lots to generate printable tags.</p>
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
                const barcodeImg = generate1DBarcode(lbl.qr_uuid);
                const isHiddenInPrint = singlePrintLabel !== null && !isSelectedForIndividualPrint(lbl);

                return (
                  <div
                    key={lbl.id || lbl.stock_id || lbl.qr_uuid || idx}
                    className={`border-2 border-dashed border-slate-300 rounded-xl p-4 bg-white space-y-3 relative group hover:border-[#6366F1] transition-all print:border-solid print:border-slate-400 print:rounded-lg print:w-[85mm] print:mx-auto print:break-inside-avoid break-inside-avoid ${
                      isHiddenInPrint ? "print:hidden" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">TAS ERP GARMENTS</span>
                        <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{lbl.design_name}</h4>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 font-extrabold text-xs rounded">
                        SIZE: {lbl.size}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Design Code</span>
                        <span className="font-extrabold text-slate-800">{lbl.design_code || lbl.design_number || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Colour</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lbl.colour_hex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-400 inline-block print:border-black"
                              style={{ backgroundColor: lbl.colour_hex }}
                            />
                          )}
                          <span className="font-extrabold text-slate-800 capitalize">{lbl.colour_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Barcode / QR Code Representation */}
                    <div className="py-2 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center space-y-1 min-h-[70px]">
                      {codeFormat === "barcode" ? (
                        barcodeImg ? (
                          <img src={barcodeImg} alt="Barcode" className="h-10 object-contain" />
                        ) : (
                          <div className="flex items-end justify-center h-10 gap-[1.5px] px-2 overflow-hidden">
                            {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 2, 1, 3, 2, 1, 4, 1, 2].map((w, idx) => (
                              <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w * 1.5}px` }} />
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="w-16 h-16 bg-white p-1 rounded border border-slate-300 flex items-center justify-center">
                          {lbl.qr_data_url ? (
                            <img src={lbl.qr_data_url} alt="2D QR Code" className="w-14 h-14 object-contain" />
                          ) : (
                            <QrCode className="w-12 h-12 text-slate-900" />
                          )}
                        </div>
                      )}
                      <span className="text-[9px] font-mono font-bold text-slate-500 truncate max-w-[200px]">
                        {lbl.qr_uuid}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-1">
                      <span>PRICE: ₹{Number(lbl.sale_price || 0).toFixed(2)}</span>
                      <button
                        onClick={() => handlePrintIndividual(lbl)}
                        className="p-1 text-[#6366F1] hover:bg-indigo-50 rounded transition-colors print:hidden flex items-center gap-1"
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
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[#6366F1]" />
                <span>Barcode / QR Scanner Lookup</span>
              </h2>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Scan or paste a security QR / Barcode UUID token. All raw business details are look-up authenticated without revealing sensitive data externally.
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
                    placeholder="Scan barcode payload or enter UUID..."
                    className="flex-1 h-11 px-4 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-[#5B63D3] outline-none"
                  />
                  <button
                    onClick={() => handleScanLookup(inputUuid)}
                    disabled={loading || !inputUuid.trim()}
                    className="h-11 px-5 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye size={16} />}
                    <span>Lookup</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scanned Stock Result Card */}
            {scannedStock && (
              <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-md space-y-4 bg-emerald-50/20">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-extrabold text-slate-900">Stock Item Authenticated</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase">
                    Status: {scannedStock.status || "In Stock"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Design Code</span>
                    <span className="font-extrabold text-[#6366F1]">{scannedStock.designs?.design_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Style Name</span>
                    <span className="font-bold text-slate-900">{scannedStock.designs?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Colour</span>
                    <span className="font-bold text-slate-800">{scannedStock.design_colours?.colour_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Size</span>
                    <span className="font-extrabold text-slate-900">{scannedStock.size || scannedStock.resolved_size || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Storage Godown</span>
                    <span className="font-bold text-slate-800">{scannedStock.godowns?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Available Stock</span>
                    <span className="font-extrabold text-emerald-600">{scannedStock.resolved_quantity ?? scannedStock.total_quantity ?? 1} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sale Price</span>
                    <span className="font-extrabold text-indigo-600">₹{Number(scannedStock.designs?.sale_price || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Quick ERP Action Buttons */}
                <div className="pt-3 border-t border-emerald-100 flex flex-wrap gap-2">
                  <Link
                    href={`/sales/bills/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}&price=${scannedStock.designs?.sale_price || 0}`}
                    className="px-3.5 py-2 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛒 Create Sales Bill</span>
                  </Link>

                  <Link
                    href={`/sales/returns/new?stock_id=${scannedStock.id}&design_id=${scannedStock.design_id || ""}&size=${encodeURIComponent(scannedStock.size || "")}`}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Stock Adjustment</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Scan History */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#6366F1]" />
              <span>Recent Scan History ({scanHistory.length})</span>
            </h3>

            {scanHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                No items scanned in this session.
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#6366F1]">{item.design_code}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium">
                      Colour: <strong>{item.colour}</strong> • Size: <strong>{item.size}</strong>
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
