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
  RotateCcw,
} from "lucide-react";
import { isValidQRUUID, isValidBarcodePayload } from "@/lib/utils/barcode";
import { toast } from "sonner";

export default function MobileScanPWAPage() {
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);
  
  // Camera state
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "permission_denied" | "active" | "error">("idle");
  const [cameraErrorMsg, setCameraErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const scannerRef = useRef<any>(null);
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const resumeScanning = () => {
    setScannedResult(null);
    setIsPaused(false);
    isProcessingRef.current = false;
    lastScannedRef.current = null;
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch (_) {}
    }
  };

  const startCameraScanner = async (overrideDeviceId?: string) => {
    setCameraState("requesting");
    setCameraErrorMsg("");
    isProcessingRef.current = false;
    setIsPaused(false);

    try {
      // 0. Pre-flight user-gesture permission request (Critical for Android / iOS PWA standalone WebAPKs)
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const testConstraints = {
            video: facingMode === "environment" ? { facingMode: { ideal: "environment" } } : { facingMode: "user" },
          };
          const stream = await navigator.mediaDevices.getUserMedia(testConstraints);
          // Release test stream tracks immediately so Html5Qrcode can bind without lock conflict
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          if (
            permErr?.name === "NotAllowedError" ||
            permErr?.name === "PermissionDeniedError" ||
            permErr?.message?.includes("Permission")
          ) {
            setCameraState("permission_denied");
            setCameraErrorMsg(
              "Camera permission was denied. Please tap the lock or site settings icon in your browser and allow Camera access for TAS ERP."
            );
            toast.error("Camera permission denied.");
            return;
          }
        }
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (_) {}
      }

      // Enumerate available cameras now that permission is granted
      let devices: { id: string; label: string }[] = [];
      try {
        devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
        }
      } catch (_) {}

      const html5QrCode = new Html5Qrcode("pwa-qr-reader");
      scannerRef.current = html5QrCode;

      // Dynamic 88% width box for wide 1D barcodes & native BarcodeDetector acceleration
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(Math.floor(viewfinderWidth * 0.88), 380);
          const height = Math.min(Math.floor(viewfinderHeight * 0.55), 220);
          return { width, height };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const handleDecodedCode = (decodedText: string) => {
        const now = Date.now();
        if (isProcessingRef.current) return;

        // 3-second cooldown for identical code to prevent infinite continuous scan spam
        if (
          lastScannedRef.current &&
          lastScannedRef.current.code === decodedText &&
          now - lastScannedRef.current.time < 3000
        ) {
          return;
        }

        isProcessingRef.current = true;
        lastScannedRef.current = { code: decodedText, time: now };

        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        handleScanSubmit(decodedText);
      };

      // Progressive 4-tier camera initialization strategy with valid html5-qrcode syntax
      let started = false;
      const targetId = overrideDeviceId || selectedCameraId;

      // Tier 1: Explicitly selected or cached device ID
      if (targetId) {
        try {
          await html5QrCode.start(targetId, config, handleDecodedCode, () => {});
          started = true;
        } catch (_) {}
      }

      // Tier 2: Search for Back / Rear / Environment camera in enumerated devices
      if (!started && devices && devices.length > 0) {
        const backCam = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        if (facingMode === "environment" && backCam) {
          try {
            await html5QrCode.start(backCam.id, config, handleDecodedCode, () => {});
            setSelectedCameraId(backCam.id);
            started = true;
          } catch (_) {}
        }
      }

      // Tier 3: Standard facingMode exact string constraint (mobile environment)
      if (!started && facingMode === "environment") {
        try {
          await html5QrCode.start({ facingMode: "environment" }, config, handleDecodedCode, () => {});
          started = true;
        } catch (_) {}
      }

      // Tier 4: User facing / default webcam (laptops & front cameras)
      if (!started) {
        try {
          await html5QrCode.start({ facingMode: "user" }, config, handleDecodedCode, () => {});
          started = true;
        } catch (_) {}
      }

      // Tier 5: Fallback to first available device ID
      if (!started && devices && devices.length > 0) {
        await html5QrCode.start(devices[0].id, config, handleDecodedCode, () => {});
        setSelectedCameraId(devices[0].id);
        started = true;
      }

      if (!started) {
        throw new Error("Unable to bind to any camera device. Please ensure camera is not in use.");
      }

      // Refresh camera devices list now that stream is live
      try {
        const freshDevices = await Html5Qrcode.getCameras();
        if (freshDevices && freshDevices.length > 0) {
          setAvailableCameras(freshDevices);
        }
      } catch (_) {}

      // Force inline video playback for mobile browsers (iOS Safari & Android Chrome WebAPKs)
      setTimeout(() => {
        const videoElement = document.querySelector("#pwa-qr-reader video") as HTMLVideoElement;
        if (videoElement) {
          videoElement.setAttribute("playsinline", "true");
          videoElement.setAttribute("webkit-playsinline", "true");
          videoElement.setAttribute("autoplay", "true");
          videoElement.setAttribute("muted", "true");
          videoElement.play().catch(() => {});
        }
      }, 100);

      setCameraState("active");
      toast.success("Camera scanner active!");
    } catch (err: any) {
      console.error("Camera init error:", err);
      if (
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.message?.includes("Permission")
      ) {
        setCameraState("permission_denied");
        setCameraErrorMsg("Camera access was denied. Please allow camera permissions in your browser or phone app settings.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCameraState("error");
        setCameraErrorMsg("No camera device found on this system.");
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        setCameraState("error");
        setCameraErrorMsg("Camera is in use by another application. Please close other camera apps and try again.");
      } else {
        setCameraState("error");
        setCameraErrorMsg(err?.message || "Failed to initialize camera scanner.");
      }
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
    setSelectedCameraId("");
    if (cameraState === "active" || scannerRef.current) {
      await stopCameraScanner();
      setTimeout(() => {
        startCameraScanner();
      }, 300);
    }
  };

  const handleSelectCamera = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    await stopCameraScanner();
    setTimeout(() => {
      startCameraScanner(deviceId);
    }, 300);
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
    if (!trimmed) {
      isProcessingRef.current = false;
      return;
    }

    if (!isValidBarcodePayload(trimmed)) {
      toast.error("Invalid QR / Barcode format.");
      isProcessingRef.current = false;
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

        // Auto pause scanner stream so result stays clear without auto-rescanning
        if (scannerRef.current) {
          try {
            scannerRef.current.pause(true);
            setIsPaused(true);
          } catch (_) {}
        }
      } else {
        setScannedResult(null);
        toast.error(data.message || "Stock item not found.");
        isProcessingRef.current = false;
      }
    } catch (err) {
      toast.error("Scan lookup failed.");
      isProcessingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)] pb-24 max-w-md mx-auto transition-colors">
      {/* Mobile Top Header */}
      <div className="bg-[var(--card-bg)] border-b border-[var(--border)] text-[var(--text-primary)] p-4 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/master-data/barcode-qr" className="p-1.5 rounded-lg bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-none text-[var(--text-primary)]">TAS ERP PWA Scanner</h1>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">1D Barcode & 2D Security QR Reader</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraState === "active" && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                torchOn ? "bg-amber-400 text-slate-900" : "bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--table-row-hover)]"
              }`}
            >
              <Zap className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleCameraFacing}
            className="p-2 rounded-lg bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Banner */}
        <div className="bg-[var(--primary-light)] border border-[var(--primary)]/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-[var(--text-body)]">
          <Info className="w-4 h-4 text-[var(--primary)] flex-shrink-0 mt-0.5" />
          <span>Point camera at 1D Barcode or 2D QR label tag for real-time authentication and ERP workflow routing.</span>
        </div>

        {/* Camera Scanner Container */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-lg min-h-[280px] w-full flex flex-col items-center justify-center p-2">
          {/* HTML5 QR Scanner DOM element - ALWAYS VISIBLE for dimension calculation */}
          <div id="pwa-qr-reader" className="w-full block" />

          {/* Idle / Pre-permission State Modal Overlay */}
          {cameraState === "idle" && (
            <div className="absolute inset-0 bg-slate-900 z-10 p-6 text-center flex flex-col items-center justify-center space-y-4">
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
                onClick={() => startCameraScanner()}
                className="w-full py-3 px-4 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Enable Camera & Start Scanning</span>
              </button>
            </div>
          )}

          {/* Requesting State Overlay */}
          {cameraState === "requesting" && (
            <div className="absolute inset-0 bg-slate-900 z-10 p-8 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#818CF8] animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Requesting camera permissions & initializing stream...</p>
            </div>
          )}

          {/* Permission Denied / Error State Overlay */}
          {(cameraState === "permission_denied" || cameraState === "error") && (
            <div className="absolute inset-0 bg-slate-900 z-10 p-6 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Camera Access Error</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">{cameraErrorMsg}</p>
              </div>
              <button
                onClick={() => startCameraScanner()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-700 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Camera Selector Dropdown */}
        {availableCameras.length > 0 && (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-[var(--text-muted)] flex items-center gap-1.5 shrink-0">
              <Camera size={14} className="text-[var(--primary)]" />
              Active Camera:
            </span>
            <select
              value={selectedCameraId}
              onChange={(e) => handleSelectCamera(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--primary)] flex-1 truncate cursor-pointer"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Manual Input Fallback */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 shadow-sm space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Manual Barcode / QR Payload Entry</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScanSubmit(manualInput);
              }}
              placeholder="Paste raw UUID or scan code..."
              className="flex-1 h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-xs font-mono font-bold transition-colors"
            />
            <button
              onClick={() => handleScanSubmit(manualInput)}
              disabled={loading || !manualInput.trim()}
              className="h-10 px-4 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:bg-[var(--primary-dark)] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
            </button>
          </div>
        </div>

        {/* Scanned Item Details Result Card */}
        {scannedResult && (
          <div className="bg-[var(--card-bg)] rounded-xl border border-emerald-500/30 p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Stock Authenticated</span>
              </div>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                IN STOCK
              </span>
            </div>

            <div>
              <p className="text-xs font-mono font-bold text-[var(--primary)]">{scannedResult.designs?.design_number || scannedResult.design_code || "DES-001"}</p>
              <p className="text-sm font-extrabold text-[var(--text-primary)]">{scannedResult.designs?.name || "Garment Item"}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Colour: <strong className="text-[var(--text-primary)]">{scannedResult.design_colours?.colour_name || "Standard"}</strong> • Size: <strong className="text-[var(--text-primary)]">{scannedResult.size || scannedResult.resolved_size || "—"}</strong>
              </p>
            </div>

            <div className="bg-[var(--page-bg)] rounded-lg border border-[var(--border)] p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Storage Godown:</span>
                <span className="font-bold text-[var(--text-primary)]">{scannedResult.godowns?.name || "Main Godown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Available Stock:</span>
                <span className="font-bold text-emerald-500">{scannedResult.resolved_quantity ?? scannedResult.total_quantity ?? 1} Pcs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Sale Price:</span>
                <span className="font-bold text-[var(--primary)]">₹{Number(scannedResult.designs?.sale_price || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Quick ERP Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={resumeScanning}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Scan Next Item</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/sales/bills/new?stock_id=${scannedResult.id}&design_id=${scannedResult.design_id || ""}&size=${encodeURIComponent(scannedResult.size || "")}&price=${scannedResult.designs?.sale_price || 0}`}
                  className="h-10 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Create Sales Bill</span>
                </Link>
                <Link
                  href={`/sales/returns/new?stock_id=${scannedResult.id}&design_id=${scannedResult.design_id || ""}&size=${encodeURIComponent(scannedResult.size || "")}`}
                  className="h-10 bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
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
                  className="h-10 bg-[var(--input-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Stock Adjust</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PWA Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)] border-t border-[var(--border)] h-16 max-w-md mx-auto flex items-center justify-around px-2 z-50 transition-colors">
        <Link href="/" className="flex flex-col items-center text-[10px] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
          <span>Dashboard</span>
        </Link>
        <Link href="/scan" className="flex flex-col items-center text-[10px] text-[var(--primary)] font-semibold">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center -mt-5 shadow-lg border-2 border-[var(--card-bg)]">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="mt-1">Scan</span>
        </Link>
        <Link href="/sales/bills" className="flex flex-col items-center text-[10px] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
          <span>Billing</span>
        </Link>
      </div>
    </div>
  );
}
