"use client";

import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw,
  ShieldAlert,
  ArrowRightLeft,
  SlidersHorizontal,
} from "lucide-react";
import { isValidQRUUID } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function MobileScanPWAPage() {
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);
  
  // Camera state
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "permission_denied" | "active" | "error">("idle");
  const [cameraErrorMsg, setCameraErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<any>(null);

  const startCameraScanner = async () => {
    setCameraState("requesting");
    setCameraErrorMsg("");

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      // Check camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
        });
        // Stop temporary stream used for permission prompt
        stream.getTracks().forEach((track) => track.stop());
      } catch (permErr: any) {
        if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
          setCameraState("permission_denied");
          setCameraErrorMsg("Camera access was denied. Please allow camera permissions in your browser settings.");
          toast.error("Camera permission denied.");
          return;
        }
      }

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (_) {}
      }

      const html5QrCode = new Html5Qrcode("pwa-qr-reader");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 160 }, // Wide rectangular reticle for 1D barcodes & 2D QR codes
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
        ],
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText: string) => {
          // Scan callback
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          handleScanSubmit(decodedText);
        },
        () => {
          // Frame failure callback (ignore noisy frame errors)
        }
      );

      setCameraState("active");
      toast.success("Camera scanner active. Position barcode or QR code in frame.");
    } catch (err: any) {
      console.error("Camera init error:", err);
      setCameraState("error");
      setCameraErrorMsg(err.message || "Failed to initialize camera scanner.");
      toast.error("Could not start camera scanner.");
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (_) {}
    }
    setCameraState("idle");
  };

  const toggleCameraFacing = async () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    if (cameraState === "active") {
      await stopCameraScanner();
      setTimeout(() => {
        startCameraScanner();
      }, 200);
    }
  };

  const toggleTorch = async () => {
    if (scannerRef.current) {
      try {
        const checkTorch = !torchOn;
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: checkTorch }],
        });
        setTorchOn(checkTorch);
      } catch (err) {
        toast.error("Flash/Torch not supported on this camera device.");
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScanSubmit = async (uuidPayload: string) => {
    const trimmed = uuidPayload.trim();
    if (!trimmed) return;

    if (!isValidQRUUID(trimmed)) {
      toast.error("Invalid QR / Barcode format. Must be a valid UUID payload.");
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

      if (res.ok && data.found && data.stock) {
        setScannedResult(data.stock);
        toast.success("Stock details authenticated!");
      } else {
        setScannedResult(null);
        toast.error(data.message || "Stock item not found.");
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
          <Link href="/master-data/barcode-qr" className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-none">TAS ERP PWA Scanner</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">1D Barcode & 2D Security QR Reader</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraState === "active" && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                torchOn ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Zap className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleCameraFacing}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs font-semibold flex items-center gap-1"
            title="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#374151]">
          <Info className="w-4 h-4 text-[#6366F1] flex-shrink-0 mt-0.5" />
          <span>Point camera at 1D Barcode or 2D QR label tag for real-time authentication and ERP workflow routing.</span>
        </div>

        {/* Camera Scanner Container */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-lg min-h-[260px] flex flex-col items-center justify-center p-2">
          {/* HTML5 QR Scanner DOM element */}
          <div id="pwa-qr-reader" className={`w-full ${cameraState === "active" ? "block" : "hidden"}`} />

          {/* Idle / Pre-permission State Modal Card */}
          {cameraState === "idle" && (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-[#6366F1]/20 rounded-2xl flex items-center justify-center mx-auto text-[#818CF8]">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Camera Access Required</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  TAS ERP requires camera access to scan physical 1D barcodes & 2D security QR codes.
                </p>
              </div>
              <button
                onClick={startCameraScanner}
                className="w-full py-3 px-4 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Enable Camera & Start Scanning</span>
              </button>
            </div>
          )}

          {/* Requesting State */}
          {cameraState === "requesting" && (
            <div className="p-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#818CF8] animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Requesting camera permissions...</p>
            </div>
          )}

          {/* Permission Denied / Error State */}
          {(cameraState === "permission_denied" || cameraState === "error") && (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Camera Permission Denied</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">{cameraErrorMsg}</p>
              </div>
              <button
                onClick={startCameraScanner}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-700 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
          <label className="text-xs font-semibold text-[#64748B]">Manual Barcode / QR Payload Entry</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScanSubmit(manualInput);
              }}
              placeholder="Paste raw UUID or scan code..."
              className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-lg text-xs font-mono font-bold"
            />
            <button
              onClick={() => handleScanSubmit(manualInput)}
              disabled={loading || !manualInput.trim()}
              className="h-10 px-4 bg-[#6366F1] text-white rounded-lg text-xs font-bold hover:bg-[#4F46E5] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
            </button>
          </div>
        </div>

        {/* Scanned Item Details Result Card */}
        {scannedResult && (
          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-md space-y-3 bg-emerald-50/20">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Stock Authenticated</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                IN STOCK
              </span>
            </div>

            <div>
              <p className="text-xs font-mono font-bold text-[#6366F1]">{scannedResult.designs?.design_number || scannedResult.design_code || "DES-001"}</p>
              <p className="text-sm font-extrabold text-[#0F172A]">{scannedResult.designs?.name || "Garment Item"}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Colour: <strong>{scannedResult.design_colours?.colour_name || "Standard"}</strong> • Size: <strong>{scannedResult.size || scannedResult.resolved_size || "—"}</strong>
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Godown:</span>
                <span className="font-bold text-slate-800">{scannedResult.godowns?.name || "Main Godown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available Stock:</span>
                <span className="font-bold text-emerald-600">{scannedResult.resolved_quantity ?? scannedResult.total_quantity ?? 1} Pcs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sale Price:</span>
                <span className="font-bold text-indigo-600">₹{Number(scannedResult.designs?.sale_price || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Quick ERP Action Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link
                href={`/sales/bills/new?stock_id=${scannedResult.id}&design_id=${scannedResult.design_id || ""}&size=${encodeURIComponent(scannedResult.size || "")}&price=${scannedResult.designs?.sale_price || 0}`}
                className="h-10 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Create Sales Bill</span>
              </Link>
              <Link
                href={`/sales/returns/new?stock_id=${scannedResult.id}&design_id=${scannedResult.design_id || ""}&size=${encodeURIComponent(scannedResult.size || "")}`}
                className="h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Sales Return</span>
              </Link>
              <Link
                href={`/finished-stock/operations?tab=transfer&stock_id=${scannedResult.id}&size=${encodeURIComponent(scannedResult.size || "")}`}
                className="h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Stock Transfer</span>
              </Link>
              <Link
                href={`/finished-stock/operations?tab=adjustment&stock_id=${scannedResult.id}&size=${encodeURIComponent(scannedResult.size || "")}`}
                className="h-10 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Stock Adjust</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* PWA Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] h-16 max-w-md mx-auto flex items-center justify-around px-2 z-50">
        <Link href="/" className="flex flex-col items-center text-[10px] text-[#94A3B8] hover:text-[#6366F1]">
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
