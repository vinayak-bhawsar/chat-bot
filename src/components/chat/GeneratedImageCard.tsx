"use client";

import { useState, useMemo } from "react";
import {
  Download,
  Maximize2,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { resolveImageUrl } from "@/lib/chat";
import ImageLightboxModal from "@/components/common/ImageLightboxModal";

export interface GeneratedImageCardProps {
  src: string;
  alt?: string;
  prompt?: string;
  model?: string;
  filename?: string;
  className?: string;
}

export default function GeneratedImageCard({
  src,
  alt = "AI Generated Image",
  prompt,
  model,
  filename,
  className = "",
}: GeneratedImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Compute full resolved URL
  const resolvedUrl = useMemo(() => {
    return resolveImageUrl(src);
  }, [src]);

  const displayFilename = useMemo(() => {
    if (filename) return filename;
    if (src) {
      const parts = src.split("/");
      return parts[parts.length - 1] || "image.png";
    }
    return "image.png";
  }, [filename, src]);

  const displayModel = useMemo(() => {
    if (!model) return undefined;
    return model
      .replace("@cf/", "")
      .replace("black-forest-labs/", "")
      .replace("stabilityai/", "");
  }, [model]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resolvedUrl) return;
    try {
      const response = await fetch(resolvedUrl, { mode: "cors" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = displayFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      const link = document.createElement("a");
      link.href = resolvedUrl;
      link.target = "_blank";
      link.download = displayFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = prompt || alt || "";
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setIsLoaded(false);
    setRetryKey((k) => k + 1);
  };

  if (!src) return null;

  return (
    <>
      <div
        className={`group relative my-3.5 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xs transition-all duration-200 hover:shadow-md hover:border-zinc-300 max-w-lg ${className}`}
      >
        {/* Image Display Area */}
        <div
          className="relative w-full overflow-hidden bg-zinc-100 cursor-zoom-in min-h-[180px] flex items-center justify-center"
          onClick={() => setIsLightboxOpen(true)}
        >
          {/* Floating Action Buttons on Top Right */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-md p-2 text-white hover:bg-black/80 transition cursor-pointer shadow-sm border border-white/15"
              title="Download image"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLightboxOpen(true);
              }}
              className="flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-md p-2 text-white hover:bg-black/80 transition cursor-pointer shadow-sm border border-white/15"
              title="Expand image"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Loading Skeleton */}
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/90 text-zinc-400 gap-2 z-10 animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin text-[#2ba8be]" />
              <span className="text-xs font-medium text-zinc-500">Loading image...</span>
            </div>
          )}

          {/* Error State */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center gap-2.5 z-10 w-full bg-zinc-50">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <div className="space-y-0.5">
                <span className="block text-xs font-semibold text-zinc-800">Unable to preview image</span>
                <span className="block text-[11px] text-zinc-500 break-all max-w-xs">{displayFilename}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="h-3 w-3 text-zinc-500" />
                  <span>Retry</span>
                </button>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 transition"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open link</span>
                </a>
              </div>
            </div>
          ) : (
            /* Main Image */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={retryKey}
              src={resolvedUrl}
              alt={alt || "AI Generated Image"}
              onLoad={() => {
                setIsLoaded(true);
                setHasError(false);
              }}
              onError={() => {
                setHasError(true);
                setIsLoaded(true);
              }}
              className={`w-full max-h-[460px] object-cover transition-all duration-300 ${
                isLoaded ? "opacity-100 group-hover:scale-[1.015]" : "opacity-0"
              }`}
              loading="lazy"
            />
          )}

          {/* Hover overlay hint */}
          {isLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <span className="flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-2xs shadow-lg">
                <Maximize2 className="h-3 w-3" />
                Click to expand
              </span>
            </div>
          )}
        </div>

        {/* Bottom Caption / Prompt */}
        {(prompt || (alt && alt !== "AI Generated Image" && alt !== "Generated Image")) && (
          <div className="flex items-start justify-between gap-2 border-t border-zinc-100 bg-zinc-50/50 p-2.5 text-xs text-zinc-700">
            <div className="line-clamp-2 text-[11.5px] leading-relaxed text-zinc-600 flex-1 select-text">
              <span className="font-semibold text-zinc-800">Prompt: </span>
              {prompt || alt}
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 transition shrink-0 cursor-pointer"
              title="Copy prompt"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={resolvedUrl}
        alt={alt}
        prompt={prompt}
        model={model}
        filename={displayFilename}
      />
    </>
  );
}
