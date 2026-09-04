"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Lock,
  Globe,
  Settings,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  Laptop,
  LocateFixed,
} from "lucide-react";
import {
  getGeolocationPermissionStatus,
  getCurrentBrowserLocation,
  reverseGeocode,
  GeolocationCoordinates,
} from "@/lib/maps";

export interface LocationPermissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation?: (coords: GeolocationCoordinates) => void;
  onOpenMapPicker?: () => void;
  errorMessage?: string | null;
}

type BrowserTab = "chrome" | "edge" | "safari" | "firefox" | "mobile" | "windows";

export default function LocationPermissionGuideModal({
  isOpen,
  onClose,
  onSelectLocation,
  onOpenMapPicker,
  errorMessage,
}: LocationPermissionGuideModalProps) {
  const [activeTab, setActiveTab] = useState<BrowserTab>("chrome");
  const [permissionState, setPermissionState] = useState<
    "granted" | "prompt" | "denied" | "unsupported" | "checking"
  >("checking");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [hostName, setHostName] = useState<string>("localhost:3000");

  // Auto-detect user's browser on mount
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== "undefined") {
      setHostName(window.location.host || "localhost:3000");
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod|android/.test(ua)) {
        setActiveTab("mobile");
      } else if (ua.includes("edg/")) {
        setActiveTab("edge");
      } else if (ua.includes("firefox")) {
        setActiveTab("firefox");
      } else if (ua.includes("safari") && !ua.includes("chrome")) {
        setActiveTab("safari");
      } else {
        setActiveTab("chrome");
      }
    }

    checkStatus();
  }, [isOpen]);

  const checkStatus = async () => {
    setPermissionState("checking");
    const status = await getGeolocationPermissionStatus();
    setPermissionState(status);
  };

  const handleTestPermission = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const pos = await getCurrentBrowserLocation({
        enableHighAccuracy: false,
        timeout: 12000,
      });

      let address = "";
      try {
        address = await reverseGeocode(pos.latitude, pos.longitude);
      } catch {
        // Fallback to coordinates
      }

      const displayAddress =
        address || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;

      setTestResult({
        success: true,
        message: `Location access allowed! (${displayAddress})`,
      });
      await checkStatus();

      if (onSelectLocation) {
        onSelectLocation({
          latitude: pos.latitude,
          longitude: pos.longitude,
          altitude: pos.altitude,
          accuracy: pos.accuracy,
          address: displayAddress,
          full_address: displayAddress,
        });
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Location permission is still blocked.";
      setTestResult({
        success: false,
        message: msg,
      });
      await checkStatus();
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                How to Enable Location Permission
              </h3>
              <p className="text-[12px] text-zinc-500">
                Quick guide to unblock GPS access in your browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Permission Status Pill */}
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200/80 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">Browser Permission Status:</span>
              {permissionState === "checking" && (
                <span className="inline-flex items-center gap-1 text-zinc-600 font-semibold">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
                </span>
              )}
              {permissionState === "denied" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 font-semibold px-2.5 py-0.5 text-[11px]">
                  <AlertTriangle className="h-3 w-3 text-red-600" /> Blocked / Denied
                </span>
              )}
              {permissionState === "granted" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Allowed
                </span>
              )}
              {permissionState === "prompt" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 font-semibold px-2.5 py-0.5 text-[11px]">
                  <HelpCircle className="h-3 w-3 text-amber-600" /> Waiting for Prompt
                </span>
              )}
              {permissionState === "unsupported" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 text-zinc-700 font-semibold px-2.5 py-0.5 text-[11px]">
                  Unsupported
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={checkStatus}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-2.5 w-2.5" /> Re-check
            </button>
          </div>

          {/* Single Alert Banner for Error or Test Result */}
          {testResult ? (
            <div
              className={`flex items-start gap-2.5 rounded-xl p-3 text-xs border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200/80 text-red-700"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              )}
              <div className="leading-relaxed font-medium">{testResult.message}</div>
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200/80 p-3 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          ) : null}

          {/* Visual Browser Address Bar Helper */}
          <div className="rounded-xl border border-cyan-200/80 bg-linear-to-b from-[#f0fbfd] to-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 mb-2">
              <span className="flex items-center gap-1.5 text-[#0e879c]">
                <Lock className="h-3.5 w-3.5" />
                Browser URL Bar Quick Guide
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">2-Step Quick Unblock</span>
            </div>

            {/* Mock URL bar */}
            <div className="flex items-center gap-2 rounded-lg bg-white border border-zinc-300/80 px-3 py-2 shadow-xs">
              <div className="relative flex items-center justify-center">
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  <Lock className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-700 min-w-0 flex-1">
                <span className="text-emerald-600 font-medium">https://</span>
                <span className="truncate">
                  {hostName}
                </span>
              </div>

              <div className="flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600">
                <span>Location:</span>
                <span className="font-bold text-emerald-600">Allow</span>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-zinc-600 leading-snug">
              👉 Click the <strong>🔒 Lock / Site settings icon</strong> on the left side of your browser address bar above, set <strong>Location &rarr; Allow</strong>, then click <strong>&quot;Retry Permission &amp; Detect Location&quot;</strong> below.
            </p>
          </div>

          {/* Browser Selection Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("chrome")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "chrome"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-[#2ba8be]" />
              Chrome
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("edge")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "edge"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              Edge
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("safari")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "safari"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Compass className="h-3.5 w-3.5 text-blue-600" />
              Safari
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("firefox")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "firefox"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-orange-500" />
              Firefox
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "mobile"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-purple-600" />
              iOS / Android
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("windows")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                activeTab === "windows"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Laptop className="h-3.5 w-3.5 text-zinc-700" />
              Windows OS
            </button>
          </div>

          {/* Browser Specific Instructions */}
          <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/60 p-4">
            {activeTab === "chrome" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Lock className="h-4 w-4 text-[#2ba8be]" />
                  <span>Google Chrome Instructions:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    Look at the <strong>address bar (URL bar)</strong> at the very top of your browser.
                  </li>
                  <li>
                    Click the <strong>Tune / Site Settings icon (or 🔒 Lock icon)</strong> located immediately to the left of the website URL.
                  </li>
                  <li>
                    Find <strong>Location</strong> in the permissions menu and toggle it to <strong>Allow</strong> (or choose <em>Reset permission</em>).
                  </li>
                  <li>
                    Click the <strong>&quot;Test &amp; Request Location&quot;</strong> button below or refresh the page.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "edge" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <span>Microsoft Edge Instructions:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    Click the <strong>🔒 Lock icon</strong> or <strong>Site permissions icon</strong> in the address bar next to the URL.
                  </li>
                  <li>
                    Under <strong>Permissions for this site</strong>, locate <strong>Location</strong>.
                  </li>
                  <li>
                    Change the dropdown from <em>Block</em> to <strong>Allow</strong>.
                  </li>
                  <li>
                    Click <strong>&quot;Test &amp; Request Location&quot;</strong> below or reload the page.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "safari" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Compass className="h-4 w-4 text-blue-600" />
                  <span>Apple Safari (macOS) Instructions:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    In the top macOS menu bar, click <strong>Safari</strong> &rarr; <strong>Settings...</strong> (or Preferences).
                  </li>
                  <li>
                    Click the <strong>Websites</strong> tab at the top.
                  </li>
                  <li>
                    Select <strong>Location</strong> from the left sidebar.
                  </li>
                  <li>
                    Find this website in the list on the right and set the dropdown to <strong>Allow</strong>.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "firefox" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Lock className="h-4 w-4 text-orange-500" />
                  <span>Mozilla Firefox Instructions:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    Click the <strong>Padlock / Permissions icon</strong> to the left of the URL in the address bar.
                  </li>
                  <li>
                    If Location shows <em>Blocked Temporarily</em> or <em>Blocked</em>, click the <strong>&apos;X&apos;</strong> next to it to clear the block.
                  </li>
                  <li>
                    Click <strong>&quot;Test &amp; Request Location&quot;</strong> below, and choose <strong>&quot;Allow Location Access&quot;</strong> when prompted.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "mobile" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <span>Mobile Devices (iPhone / iPad / Android):</span>
                </div>
                <ul className="list-disc list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    <strong>iOS (Safari):</strong> Go to iPhone Settings &rarr; Privacy &amp; Security &rarr; Location Services (ensure ON) &rarr; Safari Websites &rarr; Select <em>While Using the App</em>.
                  </li>
                  <li>
                    <strong>Android (Chrome):</strong> Tap the 3 dots in Chrome &rarr; Settings &rarr; Site Settings &rarr; Location &rarr; Allow.
                  </li>
                  <li>
                    Tap the <strong>AA</strong> or <strong>Lock icon</strong> in the mobile address bar to view site permissions.
                  </li>
                </ul>
              </div>
            )}

            {activeTab === "windows" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <Settings className="h-4 w-4 text-zinc-700" />
                  <span>Windows 10 / 11 Device Location Service:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-700 leading-relaxed pl-1">
                  <li>
                    Open <strong>Windows Settings</strong> (press <kbd className="bg-zinc-200 px-1 py-0.5 rounded text-[10px] font-mono">Win + I</kbd>).
                  </li>
                  <li>
                    Navigate to <strong>Privacy &amp; Security</strong> &rarr; <strong>Location</strong>.
                  </li>
                  <li>
                    Ensure <strong>Location Services</strong> is toggled <strong>ON</strong>.
                  </li>
                  <li>
                    Scroll down and ensure <strong>Let desktop apps access your location</strong> is also <strong>ON</strong>.
                  </li>
                </ol>
              </div>
            )}
          </div>

          {/* Quick Fallback Note */}
          <div className="flex items-center justify-between rounded-xl bg-[#eef9fb] border border-[#56C5D9]/30 p-3 text-xs text-zinc-700">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#2ba8be] shrink-0" />
              <span>
                Don&apos;t want to grant GPS access? You can drop a pin or search on the map anytime.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-2">
            {onOpenMapPicker && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMapPicker();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-[#2ba8be]" />
                <span>Drop on Map</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleTestPermission}
              disabled={isTesting}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isTesting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#56C5D9]" />
              ) : (
                <LocateFixed className="h-3.5 w-3.5 text-[#56C5D9]" />
              )}
              <span>{isTesting ? "Re-requesting GPS..." : "Retry Permission & Detect Location"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
