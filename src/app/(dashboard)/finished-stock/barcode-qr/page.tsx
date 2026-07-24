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
} from "lucide-react";
import { isValidQRUUID, generate1DBarcode } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function BarcodeQRScanningPage() {
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

  const handlePrintIndividual = (lbl: any) => {
    setSinglePrintLabel(lbl);
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
        <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <span className="text-[#334155]">Barcode / QR</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/finished-stock"
            className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-[#475569]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">9. Barcode / QR Management</h1>
            <p className="text-sm text-[#64748B]">Lookup items or generate printable security labels</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-tabs */}
          <div className="bg-[#F1F5F9] p-1 rounded-xl flex gap-1 border border-[#E2E8F0]">
            <button
              onClick={() => setActiveTab("scan")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "scan" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Scan & Lookup
            </button>
            <button
              onClick={() => setActiveTab("generator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "generator" ? "bg-white text-[#6366F1] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Generate & Print Labels
            </button>
          </div>

          <Link
            href="/scan"
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-[#6366F1]/10"
          >
            <QrCode className="h-4 w-4" />
            <span>Open Mobile PWA Scanner</span>
          </Link>
        </div>
      </div>

      {/* Main Content View */}
      {activeTab === "generator" ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm space-y-6 print:p-0 print:border-none print:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4 print:hidden">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Stock Label & Barcode Generator</h2>
              <p className="text-xs text-[#64748B]">
                Lists all finished stock records. Select between standard **1D Barcode** or **2D QR Code** formats and print individual labels.
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
                  2D Security QR
                </button>
              </div>

              <button
                onClick={() => window.print()}
                disabled={generatedLabels.length === 0}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#6366F1] text-white text-sm font-semibold hover:bg-[#4F46E5]"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sheet</span>
              </button>
            </div>
          </div>

          {loadingLabels ? (
            <div className="py-12 text-center text-[#64748B] flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#6366F1]" />
              <span>Loading finished stock items...</span>
            </div>
          ) : generatedLabels.length === 0 ? (
            <div className="py-12 text-center text-[#94A3B8]">
              <QrCode className="w-12 h-12 mx-auto mb-2 text-[#CBD5E1]" />
              <p className="text-sm font-medium text-[#475569]">No Finished Stock Records Found</p>
              <p className="text-xs">Create stock entries or complete production lots to generate printable labels.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedLabels.map((lbl) => {
                const barcode1dUrl = generate1DBarcode(lbl.qr_uuid);
                return (
                  <div
                    key={lbl.stock_id}
                    className="border-2 border-[#0F172A] rounded-xl p-4 bg-white shadow-sm space-y-3 print:break-inside-avoid relative group"
                  >
                    {/* Individual Print Button */}
                    <button
                      onClick={() => handlePrintIndividual(lbl)}
                      title="Print this individual label"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-100 hover:bg-[#EEF2FF] hover:text-[#6366F1] text-gray-600 transition-colors print:hidden flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Label</span>
                    </button>

                    <div className="flex justify-center bg-gray-50 p-3 rounded-lg border border-gray-200 min-h-[140px] items-center">
                      {codeFormat === "barcode" ? (
                        <img
                          src={barcode1dUrl || lbl.qr_data_url}
                          alt="1D Barcode"
                          className="max-h-24 w-full object-contain"
                        />
                      ) : (
                        <img src={lbl.qr_data_url} alt="Security QR" className="w-32 h-32 object-contain" />
                      )}
                    </div>

                    <div className="border-t border-[#0F172A] pt-2 text-center space-y-0.5">
                      <p className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">{lbl.design_code}</p>
                      <p className="text-xs font-semibold text-[#374151]">{lbl.design_name}</p>
                      <p className="text-xs text-[#64748B]">
                        {lbl.colour_name} · Size: <span className="font-bold text-[#0F172A]">{lbl.size}</span>
                      </p>
                      <p className="text-[11px] text-[#64748B]">{lbl.godown_name}</p>
                    </div>

                    <div className="border-t border-dashed border-gray-300 pt-1 flex items-center justify-between text-[10px] font-mono text-gray-400">
                      <span className="truncate max-w-[140px]">{lbl.qr_uuid}</span>
                      <span>{codeFormat === "barcode" ? "CODE128" : "RAW UUID"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Main Content Grid for Scan & Lookup */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Scan Zone + History */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-4">Scan Barcode / QR</h2>

              <div className="border-2 border-dashed border-[#6366F1] rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
                <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
                  <QrCode className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#374151]">Scan barcode/QR label</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Encodes secure raw UUID string</p>
                </div>

                {/* Manual input */}
                <div className="flex items-center gap-2 mt-2 w-full max-w-md">
                  <input
                    type="text"
                    value={inputUuid}
                    onChange={(e) => setInputUuid(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanLookup(inputUuid)}
                    placeholder="Enter or paste raw UUID (e.g. 8f6e0b6b-...)"
                    className="flex-1 h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm focus:ring-1 focus:ring-[#6366F1]"
                  />
                  <button
                    onClick={() => handleScanLookup(inputUuid)}
                    disabled={loading}
                    className="h-10 px-4 rounded-lg bg-[#6366F1] text-white text-sm font-medium hover:bg-[#4F46E5] flex items-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                  </button>
                </div>
              </div>

              {/* Tip Banner */}
              <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-3 mt-4 flex items-center gap-2 text-xs text-[#374151]">
                <Info className="w-4 h-4 text-[#6366F1] flex-shrink-0" />
                <span>Tip: External camera apps will see only an unreadable UUID string for security protection.</span>
              </div>

              {/* Success Banner */}
              {scanStatus === "success" && (
                <div className="bg-[#DCFCE7] border border-[#BBFCC7] rounded-xl p-4 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
                    <div>
                      <p className="text-sm font-semibold text-[#15803D]">Scan Successful!</p>
                      <p className="text-xs text-[#374151]">Item retrieved safely from inventory database.</p>
                    </div>
                  </div>
                  <button onClick={() => setScanStatus("idle")} className="text-[#94A3B8] hover:text-[#0F172A]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Recent Scans Table */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Recent Scans</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9FAFB] text-[#64748B] uppercase font-semibold">
                    <tr>
                      <th className="p-3">UUID Payload</th>
                      <th className="p-3">Design</th>
                      <th className="p-3">Colour/Size</th>
                      <th className="p-3">Godown</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {scanHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-[#94A3B8]">
                          No recent scans in this session.
                        </td>
                      </tr>
                    ) : (
                      scanHistory.map((item, i) => (
                        <tr key={i} className="hover:bg-[#F8FAFC]">
                          <td className="p-3 font-mono text-[#374151] truncate max-w-[120px]">
                            {item.qr_uuid}
                          </td>
                          <td className="p-3 font-medium text-[#0F172A]">{item.design_code}</td>
                          <td className="p-3">{item.colour} · {item.size}</td>
                          <td className="p-3">{item.godown}</td>
                          <td className="p-3 text-[#64748B]">{item.time}</td>
                          <td className="p-3">
                            <span className="bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full font-semibold">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Item Details & Actions */}
          <div className="lg:col-span-5 space-y-6">
            {scannedStock ? (
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Item Details</h3>
                  <span className="bg-[#DCFCE7] text-[#15803D] text-xs font-semibold px-2.5 py-1 rounded-full">
                    In Stock
                  </span>
                </div>

                <div className="border-b border-[#E5E7EB] pb-4">
                  <p className="text-xs font-mono text-[#6366F1]">{scannedStock.designs?.design_number || "DES-001"}</p>
                  <p className="text-base font-bold text-[#0F172A]">{scannedStock.designs?.name || "Garment Item"}</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Colour</span>
                    <span className="font-medium text-[#0F172A]">{scannedStock.design_colours?.colour_name || "Red"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Size</span>
                    <span className="font-medium text-[#0F172A]">{scannedStock.size || "M"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Godown</span>
                    <span className="font-medium text-[#0F172A]">{scannedStock.godowns?.name || "Main Godown"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Available Quantity</span>
                    <span className="font-bold text-[#15803D]">{scannedStock.quantity || 0} Pcs</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Sale Price</span>
                    <span className="font-medium text-[#0F172A]">₹{scannedStock.designs?.sale_price || "0.00"}</span>
                  </div>
                </div>

                {/* Actions list */}
                <div className="pt-4 border-t border-[#E5E7EB]">
                  <h4 className="text-xs font-semibold uppercase text-[#94A3B8] tracking-wider mb-2">Available Actions</h4>
                  <div className="space-y-2">
                    <Link
                      href="/finished-stock/adjustments/new"
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F8FAFC] text-sm text-[#374151]"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-[#DC2626]" />
                      <span>Create Stock Adjustment</span>
                    </Link>
                    <Link
                      href="/finished-stock/transfers/new"
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F8FAFC] text-sm text-[#374151]"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-[#16A34A]" />
                      <span>Initiate Stock Transfer</span>
                    </Link>
                    <Link
                      href="/finished-stock/challans/new"
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F8FAFC] text-sm text-[#374151]"
                    >
                      <Truck className="w-4 h-4 text-[#D97706]" />
                      <span>Create Delivery Challan</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center text-[#94A3B8]">
                <QrCode className="w-12 h-12 mx-auto mb-3 text-[#CBD5E1]" />
                <p className="text-sm font-medium text-[#475569]">No Item Scanned</p>
                <p className="text-xs mt-1">Scan or input a valid raw UUID label to view stock details and actions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Label Print Container (Shown ONLY during window.print when singlePrintLabel is set) */}
      {singlePrintLabel && (
        <div className="print-target hidden print:flex fixed inset-0 bg-white z-[999999] p-6 text-black items-center justify-center">
          <div className="w-80 border-2 border-black rounded-xl p-4 bg-white space-y-3 mx-auto">
            <div className="flex justify-center bg-gray-50 p-3 rounded-lg border border-gray-300 min-h-[140px] items-center">
              {codeFormat === "barcode" ? (
                <img
                  src={generate1DBarcode(singlePrintLabel.qr_uuid) || singlePrintLabel.qr_data_url}
                  alt="1D Barcode"
                  className="max-h-24 w-full object-contain"
                />
              ) : (
                <img src={singlePrintLabel.qr_data_url} alt="Security QR" className="w-32 h-32 object-contain" />
              )}
            </div>

            <div className="border-t-2 border-black pt-2 text-center space-y-0.5">
              <p className="text-base font-bold text-black uppercase tracking-wide">{singlePrintLabel.design_code}</p>
              <p className="text-xs font-semibold text-gray-800">{singlePrintLabel.design_name}</p>
              <p className="text-xs text-gray-700">
                {singlePrintLabel.colour_name} · Size: <span className="font-bold text-black">{singlePrintLabel.size}</span>
              </p>
              <p className="text-[11px] text-gray-600">{singlePrintLabel.godown_name}</p>
            </div>

            <div className="border-t border-dashed border-gray-400 pt-1 flex items-center justify-between text-[10px] font-mono text-gray-600">
              <span className="truncate max-w-[160px]">{singlePrintLabel.qr_uuid}</span>
              <span>{codeFormat === "barcode" ? "CODE128" : "RAW UUID"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
