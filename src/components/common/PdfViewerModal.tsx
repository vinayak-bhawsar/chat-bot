"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { getAccessToken } from "@/lib/api";

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = Boolean(
    file?.type?.startsWith("image/") ||
    (filename && /\.(png|jpe?g|webp)$/i.test(filename)) ||
    (url && /\.(png|jpe?g|webp)$/i.test(url.split("?")[0]))
  );

  useEffect(() => {
    if (!isOpen) {
      if (pdfUrl && !url) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);
      setDocumentMetadata(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    let objectUrlToCleanup: string | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setDocumentMetadata(null);

      // Case 1: Local File instance provided (highest priority)
      if (file) {
        try {
          const blobUrl = URL.createObjectURL(file);
          objectUrlToCleanup = blobUrl;
          if (!isCancelled) {
            setPdfUrl(blobUrl);
            setLoading(false);
          }
        } catch {
          if (!isCancelled) {
            setError(isImage ? "Failed to open local image file." : "Failed to open local PDF file.");
            setLoading(false);
          }
        }
        return;
      }

      // Case 2: Direct URL provided (Blob, Data URL, or HTTP)
      if (url) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
          if (!isCancelled) {
            setPdfUrl(url);
            setLoading(false);
          }
          return;
        }

        // For HTTP(S) URLs, try fetching as a blob to bypass X-Frame-Options in iframe
        try {
          const accessToken = getAccessToken();
          const authHeaders: Record<string, string> = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};
          const res = await fetch(url, { headers: authHeaders });
          if (res.ok) {
            const blob = await res.blob();
            const cType = res.headers.get("content-type") || "";
            const mimeType = cType || (isImage ? "image/png" : "application/pdf");
            const blobUrl = URL.createObjectURL(
              new Blob([blob], { type: mimeType })
            );
            objectUrlToCleanup = blobUrl;
            if (!isCancelled) {
              setPdfUrl(blobUrl);
              setLoading(false);
            }
            return;
          }
        } catch {
          // If fetch fails (e.g., CORS restriction), fallback to direct URL
        }

        if (!isCancelled) {
          setPdfUrl(url);
          setLoading(false);
        }
        return;
      }

      // Case 3: Stored Document ID provided
      if (documentId) {
        try {
          const accessToken = getAccessToken();
          const authHeaders: Record<string, string> = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};

          // Candidate endpoints for downloading / fetching document binary or metadata
          const candidateDownloadEndpoints = [
            `${API_URL}/documents/${encodeURIComponent(documentId)}/download`,
            `${API_URL}/documents/${encodeURIComponent(documentId)}/file`,
            `${API_URL}/documents/${encodeURIComponent(documentId)}/content`,
            `${API_URL}/documents/download/${encodeURIComponent(documentId)}`,
            `${API_URL}/documents/file/${encodeURIComponent(documentId)}`,
            `${API_URL}/documents/${encodeURIComponent(documentId)}`,
          ];

          for (const endpoint of candidateDownloadEndpoints) {
            try {
              const res = await fetch(endpoint, { headers: authHeaders });
              if (!res.ok) continue;

              const cType = res.headers.get("content-type") || "";

              // Direct binary stream
              if (
                cType.includes("application/pdf") ||
                cType.includes("image/") ||
                cType.includes("octet-stream") ||
                cType.includes("binary")
              ) {
                const blob = await res.blob();
                const mimeType = cType.includes("image/")
                  ? cType
                  : isImage
                    ? "image/png"
                    : "application/pdf";
                const blobUrl = URL.createObjectURL(
                  new Blob([blob], { type: mimeType })
                );
                objectUrlToCleanup = blobUrl;
                if (!isCancelled) {
                  setPdfUrl(blobUrl);
                  setLoading(false);
                }
                return;
              }

              // JSON response containing URL or Base64 or metadata
              if (cType.includes("application/json")) {
                const json = await res.json();
                const data = json?.data || json;

                // 1. Check for nested / direct URL
                const foundUrl =
                  data?.url ||
                  data?.download_url ||
                  data?.file_url ||
                  data?.s3_url ||
                  data?.document_url ||
                  data?.public_url ||
                  json?.url ||
                  json?.download_url;

                if (
                  foundUrl &&
                  typeof foundUrl === "string" &&
                  (foundUrl.startsWith("http") ||
                    foundUrl.startsWith("blob:") ||
                    foundUrl.startsWith("data:"))
                ) {
                  // If it is a remote URL, try to fetch as blob for smooth iframe rendering
                  if (foundUrl.startsWith("http")) {
                    try {
                      const fileRes = await fetch(foundUrl);
                      if (fileRes.ok) {
                        const fileBlob = await fileRes.blob();
                        const fileCType = fileRes.headers.get("content-type") || "";
                        const mimeType = fileCType || (isImage ? "image/png" : "application/pdf");
                        const blobUrl = URL.createObjectURL(
                          new Blob([fileBlob], { type: mimeType })
                        );
                        objectUrlToCleanup = blobUrl;
                        if (!isCancelled) {
                          setPdfUrl(blobUrl);
                          setLoading(false);
                        }
                        return;
                      }
                    } catch {
                      // Fallback to foundUrl directly
                    }
                  }

                  if (!isCancelled) {
                    setPdfUrl(foundUrl);
                    setLoading(false);
                  }
                  return;
                }

                // 2. Check for base64 encoded PDF or image
                const base64Data =
                  data?.base64 ||
                  data?.file_content ||
                  data?.content_base64 ||
                  data?.pdf_base64 ||
                  json?.base64;

                if (base64Data && typeof base64Data === "string") {
                  try {
                    const cleanBase64 = base64Data.replace(
                      /^data:(application\/pdf|image\/[a-zA-Z+]+);base64,/,
                      ""
                    );
                    const byteCharacters = atob(cleanBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], {
                      type: isImage ? "image/png" : "application/pdf",
                    });
                    const blobUrl = URL.createObjectURL(blob);
                    objectUrlToCleanup = blobUrl;

                    if (!isCancelled) {
                      setPdfUrl(blobUrl);
                      setLoading(false);
                    }
                    return;
                  } catch (decodeErr) {
                    console.warn("Failed to decode base64 document:", decodeErr);
                  }
                }

                // 3. Save metadata for knowledge base overview card
                if (data && typeof data === "object") {
                  setDocumentMetadata(data);
                }
              }
            } catch {
              // Try next candidate endpoint
            }
          }

          // If document metadata was found (indexed in vector database)
          if (!isCancelled) {
            setLoading(false);
          }
          return;
        } catch (err) {
          if (!isCancelled) {
            console.error("Document load error:", err);
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load document from server."
            );
            setLoading(false);
          }
          return;
        }
      }

      if (!isCancelled) {
        setError("No document source specified.");
        setLoading(false);
      }
    };

    void loadPdf();

    return () => {
      isCancelled = true;
      if (objectUrlToCleanup) {
        URL.revokeObjectURL(objectUrlToCleanup);
      }
    };
  }, [isOpen, file, documentId, url, isImage]);

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
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = filename || (isImage ? "image.png" : "document.pdf");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

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
                ${
                  isImage
                    ? "border-blue-100 bg-blue-50 text-blue-600"
                    : "border-red-100 bg-red-50 text-red-600"
                }
              `}
            >
              {isImage ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-900">
                {filename || documentMetadata?.file_name || (isImage ? "Image" : "PDF Document")}
              </h2>
              <span className="text-[11px] text-zinc-500 font-normal">
                {pdfUrl ? (isImage ? "Image Preview" : "Document Preview") : "Indexed Knowledge Document"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pdfUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition"
                  title={isImage ? "Download image" : "Download PDF"}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </>
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
                {isImage ? "Loading image..." : "Loading PDF document..."}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1">
                {isImage ? "Unable to open image" : "Unable to open PDF"}
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

          {/* Embedded PDF object / iframe or Image */}
          {pdfUrl && !loading && !error && (
            isImage ? (
              <div className="relative h-full w-full bg-zinc-950 flex items-center justify-center p-4 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pdfUrl}
                  alt={filename || "Image Preview"}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="relative h-full w-full bg-zinc-900 flex flex-col">
                <object
                  data={`${pdfUrl}#toolbar=1&navpanes=1`}
                  type="application/pdf"
                  className="h-full w-full border-0 bg-white"
                >
                  <iframe
                    src={`${pdfUrl}#toolbar=1&navpanes=1`}
                    className="h-full w-full border-0 bg-white"
                    title={filename || "PDF Preview"}
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
            )
          )}

          {/* Document Metadata / Knowledge Base Overview Card */}
          {!pdfUrl && !loading && !error && (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900 truncate">
                      {filename || documentMetadata?.file_name || "Knowledge Document"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Indexed for RAG Assistant</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-xl bg-zinc-50 p-3.5 text-xs text-zinc-600 border border-zinc-100 mb-5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Document ID</span>
                    <span className="font-mono text-zinc-800 truncate max-w-[200px]">
                      {documentId || documentMetadata?.id || "N/A"}
                    </span>
                  </div>
                  {documentMetadata?.size_bytes ? (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">File Size</span>
                      <span className="text-zinc-800">
                        {(documentMetadata.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Vector Search</span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Ready for Questions
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
                  This document is stored in the vector database and connected to the AI chat assistant. Ask questions directly in the chat to extract insights from this file.
                </p>

                <div className="flex gap-2">
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
