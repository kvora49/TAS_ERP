"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  ArrowLeft,
  Zap,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  FileText,
  Loader2,
  Camera,
} from "lucide-react";
import { isValidQRUUID } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function MobileScanPWAPage() {
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);
  const [flashOn, setFlashOn] = useState(false);

  const handleScanSubmit = async (uuidPayload: string) => {
    const trimmed = uuidPayload.trim();
    if (!trimmed) return;

    if (!isValidQRUUID(trimmed)) {
      toast.error("Invalid QR format. Must be a valid UUID payload.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/finished-stock/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_uuid: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.found) {
        setScannedResult(data.stock);
        toast.success("Stock details fetched.");
      } else {
        setScannedResult(null);
        toast.error(data.message || "Stock not found.");
      }
    } catch (err) {
      toast.error("Scan lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 max-w-md mx-auto">
      {/* Mobile Top Header */}
      <div className="bg-[#0F1629] text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/finished-stock" className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-none">11. Scan (PWA)</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Mobile QR & Barcode Scanner</p>
          </div>
        </div>

        <button
          onClick={() => setFlashOn(!flashOn)}
          className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            flashOn ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{flashOn ? "Flash ON" : "Flash OFF"}</span>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#374151]">
          <Info className="w-4 h-4 text-[#6366F1] flex-shrink-0 mt-0.5" />
          <span>Point camera at raw UUID QR label or enter UUID manually below.</span>
        </div>

        {/* Camera Feed View (Section 2.7) */}
        <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-900 border-2 border-slate-800 shadow-lg flex flex-col items-center justify-center">
          {/* Scan frame simulation */}
          <div className="relative w-48 h-48 border-2 border-[#6366F1] rounded-xl flex items-center justify-center bg-black/40">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#22C55E]" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#22C55E]" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#22C55E]" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#22C55E]" />

            {/* Auto detect indicator */}
            <div className="absolute top-2 left-2 bg-black/70 rounded-full px-2.5 py-0.5 flex items-center gap-1.5 text-[10px] text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Auto Detect ON</span>
            </div>

            <Camera className="w-10 h-10 text-white/40 animate-pulse" />
          </div>

          <p className="text-[11px] text-slate-400 mt-3">Ready to read raw UUID payload</p>
        </div>

        {/* Manual Input Fallback */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
          <label className="text-xs font-semibold text-[#64748B]">Manual Raw UUID Entry</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Paste raw UUID..."
              className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-lg text-xs font-mono"
            />
            <button
              onClick={() => handleScanSubmit(manualInput)}
              disabled={loading}
              className="h-10 px-4 bg-[#6366F1] text-white rounded-lg text-xs font-semibold hover:bg-[#4F46E5]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </button>
          </div>
        </div>

        {/* Scanned Item Details Result */}
        {scannedResult && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
              <span className="text-xs font-bold text-[#0F172A]">Scanned Item Info</span>
              <span className="bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold px-2 py-0.5 rounded-full">
                IN STOCK
              </span>
            </div>

            <div>
              <p className="text-xs font-mono text-[#6366F1]">{scannedResult.designs?.design_code || "DES-001"}</p>
              <p className="text-sm font-bold text-[#0F172A]">{scannedResult.designs?.name || "Premium Kurti"}</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Colour: {scannedResult.design_colours?.colour_name || "Red"} | Size: {scannedResult.size || "M"}
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Godown:</span>
                <span className="font-medium text-[#0F172A]">{scannedResult.godowns?.name || "Main Godown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Available Stock:</span>
                <span className="font-bold text-[#15803D]">{scannedResult.quantity || 0} Pcs</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link
                href="/sales/bills/new"
                className="h-10 bg-[#6366F1] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Add to Bill</span>
              </Link>
              <Link
                href="/finished-stock/transfers/new"
                className="h-10 border border-[#6366F1] text-[#6366F1] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Transfer</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* PWA Fixed Bottom Navigation (Section 2.8) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] h-16 max-w-md mx-auto flex items-center justify-around px-2 z-50">
        <Link href="/finished-stock" className="flex flex-col items-center text-[10px] text-[#94A3B8] hover:text-[#6366F1]">
          <span>Dashboard</span>
        </Link>
        <Link href="/scan" className="flex flex-col items-center text-[10px] text-[#6366F1] font-semibold">
          <div className="w-10 h-10 rounded-full bg-[#6366F1] text-white flex items-center justify-center -mt-5 shadow-lg border-2 border-white">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="mt-1">Scan</span>
        </Link>
        <Link href="/sales/bills" className="flex flex-col items-center text-[10px] text-[#94A3B8] hover:text-[#6366F1]">
          <span>Billing</span>
        </Link>
      </div>
    </div>
  );
}
