"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
} from "lucide-react";

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  prompt?: string;
  model?: string;
  filename?: string;
}

export default function ImageLightboxModal({
  isOpen,
  onClose,
  src,
  alt = "Generated Image",
  prompt,
  model,
  filename,
}: ImageLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset zoom on open
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setIsCopied(false);
      setIsLinkCopied(false);
    }
  }, [isOpen, src]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.25, 3));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === "0") {
        setZoom(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const handleCopyPrompt = async () => {
    if (!prompt && !alt) return;
    try {
      await navigator.clipboard.writeText(prompt || alt || "");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    if (!src) return;
    try {
      await navigator.clipboard.writeText(src);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = async () => {
    if (!src) return;
    const downloadName = filename || src.split("/").pop() || "generated-image.png";
    try {
      const response = await fetch(src, { mode: "cors" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      // Direct link fallback
      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen || !src) return null;

  const displayModel = model
    ? model.replace("@cf/", "").replace("black-forest-labs/", "").replace("stabilityai/", "")
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950/92 backdrop-blur-md transition-all duration-200 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <div
        className="relative z-20 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate">
                {alt && alt !== "AI Generated Image" && alt !== "Generated Image"
                  ? alt
                  : filename || "Image Preview"}
              </span>
              {displayModel && (
                <span className="hidden sm:inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300 border border-zinc-700">
                  {displayModel}
                </span>
              )}
            </div>
            {filename && (
              <p className="text-[11px] font-mono text-zinc-400 truncate">{filename}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom In / Out / Reset */}
          <div className="hidden sm:flex items-center rounded-xl bg-zinc-800/90 p-0.5 border border-zinc-700/80">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition disabled:opacity-40 cursor-pointer"
              title="Zoom out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-mono font-medium text-zinc-300 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition disabled:opacity-40 cursor-pointer"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            {zoom !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition cursor-pointer ml-0.5"
                title="Reset zoom (0)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-[#56C5D9] px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#45b2c6] transition cursor-pointer shadow-sm active:scale-95"
            title="Download Image"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Download</span>
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
            title="Copy Image URL"
          >
            {isLinkCopied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>

          {/* Open in new tab */}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
            title="Open original in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex rounded-xl border border-zinc-700 bg-zinc-800/80 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-800/90 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white transition cursor-pointer border border-zinc-700/80"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewing Canvas */}
      <div
        className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || "Generated Image"}
            className="max-h-[75vh] max-w-[90vw] sm:max-w-[85vw] object-contain rounded-xl shadow-2xl border border-zinc-800 select-none pointer-events-auto"
            draggable={false}
          />
        </div>
      </div>

      {/* Bottom Prompt Bar */}
      {(prompt || alt) && (
        <div
          className="relative z-20 border-t border-zinc-800/80 bg-zinc-900/80 px-4 py-3 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Prompt
              </span>
              <div className="text-xs text-zinc-200 leading-relaxed line-clamp-2 select-text">
                {prompt || alt}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition shrink-0 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
