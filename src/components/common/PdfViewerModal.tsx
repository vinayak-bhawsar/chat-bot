"use client";

import { useEffect, useState, useMemo } from "react";
import {
  X,
  ExternalLink,
  Download,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File as GenericFileIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { getAccessToken } from "@/lib/api";
import { getFileDetails, cleanDisplayName, FileCategory } from "@/lib/fileTypes";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://rag-chatbot-v2hu.onrender.com";

export interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  file?: File | null;
  documentId?: string | null;
  url?: string | null;
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  filename,
  file,
  documentId,
  url,
}: PdfViewerModalProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileDetails = useMemo(() => {
    return getFileDetails(filename || file?.name || documentMetadata?.file_name, file?.type);
  }, [filename, file, documentMetadata]);

  const { category, label, colorClass } = fileDetails;

  useEffect(() => {
    if (!isOpen) {
      if (contentUrl && !url) {
        URL.revokeObjectURL(contentUrl);
      }
      setContentUrl(null);
      setTextContent(null);
      setDocumentMetadata(null);
      setError(null);
      setLoading(false);
      setCopied(false);
      return;
    }

    let isCancelled = false;
    let objectUrlToCleanup: string | null = null;
    const controller = new AbortController();

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setTextContent(null);
      setDocumentMetadata(null);

      // -------------------------------------------------------------
      // Case 1: Local File instance provided (Instant load < 10ms)
      // -------------------------------------------------------------
      if (file) {
        try {
          // If text or code file, read text directly
          if (
            category === "text" ||
            category === "code" ||
            file.name.endsWith(".csv") ||
            file.name.endsWith(".json") ||
            file.name.endsWith(".md") ||
            file.name.endsWith(".txt")
          ) {
            try {
              const text = await file.text();
              if (!isCancelled) {
                setTextContent(text);
                setLoading(false);
              }
              return;
            } catch {
              // fallback to blob url
            }
          }

          const blobUrl = URL.createObjectURL(file);
          objectUrlToCleanup = blobUrl;
          if (!isCancelled) {
            setContentUrl(blobUrl);
            setLoading(false);
          }
        } catch {
          if (!isCancelled) {
            setError(`Failed to open local ${label.toLowerCase()}.`);
            setLoading(false);
          }
        }
        return;
      }

      // -------------------------------------------------------------
      // Case 2: Direct URL provided (Blob, Data URL, or HTTP)
      // -------------------------------------------------------------
      if (url) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
          if (!isCancelled) {
            setContentUrl(url);
            setLoading(false);
          }
          return;
        }

        try {
          const accessToken = getAccessToken();
          const authHeaders: Record<string, string> = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};

          const res = await fetch(url, {
            headers: authHeaders,
            signal: controller.signal,
          });

          if (res.ok) {
            const cType = res.headers.get("content-type") || "";

            if (
              category === "text" ||
              category === "code" ||
              cType.includes("text/") ||
              cType.includes("application/json")
            ) {
              const text = await res.text();
              if (!isCancelled) {
                setTextContent(text);
                setLoading(false);
              }
              return;
            }

            const blob = await res.blob();
            const mimeType = cType || (category === "image" ? "image/png" : "application/pdf");
            const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
            objectUrlToCleanup = blobUrl;
            if (!isCancelled) {
              setContentUrl(blobUrl);
              setLoading(false);
            }
            return;
          }
        } catch {
          // fallback to direct URL
        }

        if (!isCancelled) {
          setContentUrl(url);
          setLoading(false);
        }
        return;
      }

      // -------------------------------------------------------------
      // Case 3: Stored Document ID provided (Fast parallel fetch)
      // -------------------------------------------------------------
      if (documentId) {
        try {
          const accessToken = getAccessToken();
          const authHeaders: Record<string, string> = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};

          // Fetch download binary and metadata in parallel for maximum speed
          const downloadUrl = `${API_URL}/documents/${encodeURIComponent(documentId)}/download`;
          const metaUrl = `${API_URL}/documents/${encodeURIComponent(documentId)}`;

          const [downloadRes, metaRes] = await Promise.allSettled([
            fetch(downloadUrl, { headers: authHeaders, signal: controller.signal }),
            fetch(metaUrl, { headers: authHeaders, signal: controller.signal }),
          ]);

          if (isCancelled) return;

          // Check if binary download endpoint succeeded
          if (downloadRes.status === "fulfilled" && downloadRes.value.ok) {
            const res = downloadRes.value;
            const cType = res.headers.get("content-type") || "";

            if (
              category === "text" ||
              category === "code" ||
              cType.includes("text/") ||
              cType.includes("json")
            ) {
              const text = await res.text();
              if (!isCancelled) {
                setTextContent(text);
                setLoading(false);
              }
              return;
            }

            if (
              cType.includes("application/pdf") ||
              cType.includes("image/") ||
              cType.includes("octet-stream") ||
              cType.includes("binary") ||
              category === "pdf" ||
              category === "image"
            ) {
              const blob = await res.blob();
              const mimeType =
                cType || (category === "image" ? "image/png" : "application/pdf");
              const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
              objectUrlToCleanup = blobUrl;
              if (!isCancelled) {
                setContentUrl(blobUrl);
                setLoading(false);
              }
              return;
            }
          }

          // Check metadata JSON endpoint
          if (metaRes.status === "fulfilled" && metaRes.value.ok) {
            const json = await metaRes.value.json();
            const data = json?.data || json;

            // Check if backend returned embedded content/text/summary
            const embeddedText =
              data?.content ||
              data?.text ||
              data?.summary ||
              data?.raw_text ||
              data?.extracted_text;

            if (embeddedText && typeof embeddedText === "string" && embeddedText.trim()) {
              if (!isCancelled) {
                setTextContent(embeddedText);
                setDocumentMetadata(data);
                setLoading(false);
              }
              return;
            }

            // Check if backend returned download URL
            const remoteUrl =
              data?.url ||
              data?.download_url ||
              data?.file_url ||
              data?.s3_url ||
              json?.url;

            if (remoteUrl && typeof remoteUrl === "string") {
              if (!isCancelled) {
                setContentUrl(remoteUrl);
                setDocumentMetadata(data);
                setLoading(false);
              }
              return;
            }

            // Check for base64 encoded content
            const base64Data =
              data?.base64 ||
              data?.file_content ||
              data?.content_base64 ||
              data?.pdf_base64;

            if (base64Data && typeof base64Data === "string") {
              try {
                const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
                const byteCharacters = atob(cleanBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {
                  type: category === "image" ? "image/png" : "application/pdf",
                });
                const blobUrl = URL.createObjectURL(blob);
                objectUrlToCleanup = blobUrl;

                if (!isCancelled) {
                  setContentUrl(blobUrl);
                  setDocumentMetadata(data);
                  setLoading(false);
                }
                return;
              } catch (decodeErr) {
                console.warn("Base64 decode failed:", decodeErr);
              }
            }

            // Stored RAG overview card
            if (!isCancelled) {
              setDocumentMetadata(data);
              setLoading(false);
            }
            return;
          }

          // If both endpoints failed or returned 404
          if (!isCancelled) {
            setDocumentMetadata({
              id: documentId,
              file_name: filename,
            });
            setLoading(false);
          }
        } catch (err: any) {
          if (!isCancelled) {
            console.warn("Document load error:", err);
            setDocumentMetadata({
              id: documentId,
              file_name: filename,
            });
            setLoading(false);
          }
        }
        return;
      }

      if (!isCancelled) {
        setError("No document source specified.");
        setLoading(false);
      }
    };

    void loadContent();

    return () => {
      isCancelled = true;
      controller.abort();
      if (objectUrlToCleanup) {
        URL.revokeObjectURL(objectUrlToCleanup);
      }
    };
  }, [isOpen, file, documentId, url, category, filename, label]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (textContent) {
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "document.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (contentUrl) {
      const a = document.createElement("a");
      a.href = contentUrl;
      a.download = filename || (category === "image" ? "image.png" : "document.pdf");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenNewTab = () => {
    if (contentUrl) {
      window.open(contentUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const renderIcon = () => {
    switch (category) {
      case "image":
        return <ImageIcon className="h-4 w-4" />;
      case "code":
        return <FileCode className="h-4 w-4" />;
      case "excel":
        return <FileSpreadsheet className="h-4 w-4" />;
      case "archive":
        return <FileArchive className="h-4 w-4" />;
      case "text":
      case "pdf":
      case "word":
      case "powerpoint":
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const rawTitle =
    filename ||
    file?.name ||
    documentMetadata?.file_name ||
    documentMetadata?.name ||
    label;

  const displayTitle = cleanDisplayName(rawTitle, label);

  const displaySubtitle =
    contentUrl || textContent
      ? `${label} Preview`
      : "Indexed Knowledge Document";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 transition-all duration-200">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                border
                ${colorClass}
              `}
            >
              {renderIcon()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-900">
                {displayTitle}
              </h2>
              <span className="text-[11px] text-zinc-500 font-normal">
                {displaySubtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {textContent && (
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition"
                title="Copy file text"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="hidden sm:inline text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copy Text</span>
                  </>
                )}
              </button>
            )}

            {contentUrl && (category === "pdf" || category === "image") && (
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition"
                title="Open in new browser tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}

            {(contentUrl || textContent || file) && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition"
                title={`Download ${label}`}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900 transition"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="relative flex-1 bg-zinc-50 overflow-hidden flex flex-col">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
              <p className="text-sm font-medium text-zinc-600">
                {`Loading ${label.toLowerCase()}...`}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1">
                {`Unable to open ${label.toLowerCase()}`}
              </h3>
              <p className="text-sm text-zinc-500 max-w-md mb-4">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition"
              >
                Close
              </button>
            </div>
          )}

          {/* 1. Image Viewer */}
          {category === "image" && contentUrl && !loading && !error && (
            <div className="relative h-full w-full bg-zinc-950 flex items-center justify-center p-4 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contentUrl}
                alt={displayTitle}
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          )}

          {/* 2. PDF Viewer */}
          {category === "pdf" && contentUrl && !loading && !error && (
            <div className="relative h-full w-full bg-zinc-900 flex flex-col">
              <object
                data={`${contentUrl}#toolbar=1&navpanes=1`}
                type="application/pdf"
                className="h-full w-full border-0 bg-white"
              >
                <iframe
                  src={`${contentUrl}#toolbar=1&navpanes=1`}
                  className="h-full w-full border-0 bg-white"
                  title={displayTitle}
                >
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-700 bg-zinc-50">
                    <FileText className="h-10 w-10 text-red-500 mb-3" />
                    <p className="text-sm font-semibold mb-2">PDF Document Ready</p>
                    <p className="text-xs text-zinc-500 mb-4">
                      Click below to open or download the PDF in your browser.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenNewTab}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition shadow-xs"
                      >
                        Open in New Tab
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition shadow-xs"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </iframe>
              </object>
            </div>
          )}

          {/* 3. Text / Code / CSV / Markdown Viewer */}
          {textContent !== null && !loading && !error && (
            <div className="flex h-full w-full flex-col bg-zinc-900 text-zinc-100 overflow-hidden font-mono text-xs sm:text-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-800 text-[11px] text-zinc-400">
                <span>{displayTitle}</span>
                <span>{textContent.length} characters</span>
              </div>
              <div className="flex-1 overflow-auto p-4 sm:p-6 leading-relaxed select-text">
                <pre className="whitespace-pre-wrap font-mono text-zinc-100 selection:bg-zinc-700">
                  {textContent}
                </pre>
              </div>
            </div>
          )}

          {/* 4. Document Metadata / Overview Card (When file binary cannot be embedded directly) */}
          {!contentUrl && textContent === null && !loading && !error && (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${colorClass}`}
                  >
                    {renderIcon()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-zinc-900 truncate">
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Indexed for AI Chat Assistant</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-xl bg-zinc-50 p-3.5 text-xs text-zinc-600 border border-zinc-100 mb-5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Document Type</span>
                    <span className="font-medium text-zinc-800">{label}</span>
                  </div>
                  {documentId ? (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Document ID</span>
                      <span className="font-mono text-zinc-800 truncate max-w-[200px]">
                        {documentId}
                      </span>
                    </div>
                  ) : null}
                  {documentMetadata?.size_bytes ? (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">File Size</span>
                      <span className="text-zinc-800">
                        {(documentMetadata.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">AI Knowledge Base</span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Ready for Questions
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
                  This {label.toLowerCase()} is stored in your RAG vector database. Ask questions directly in the chat to extract insights, summaries, and answers from this file.
                </p>

                <div className="flex gap-2">
                  {(file || contentUrl) && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 rounded-xl border border-zinc-300 bg-white py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition text-center shadow-xs"
                    >
                      Download File
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition text-center shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
