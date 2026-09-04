"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  LogIn,
  MapPin,
  Paperclip,
  Square,
  X,
} from "lucide-react";

import { getLocalizedErrorMessage } from "@/i18n";
import { getFileDetails, cleanDisplayName } from "@/lib/fileTypes";
import { isLocationQuery } from "@/lib/maps";

// ================================================================
// Types
// ================================================================

export interface UploadedDocument {
  file: File | null;
  documentId?: string;
  filename: string;
  source?: "knowledge_base" | "conversation";
  chunks?: number;
  totalChunks?: number;
  currentChunk?: number;
  progress?: number;
  statusMessage?: string;
  isProcessing?: boolean;
}

export interface AttachedLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  address?: string | null;
  full_address?: string | null;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatInputProps {
  hasStarted: boolean;
  uploadedDocument: UploadedDocument | null;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemoveFile: () => void;
  onSubmit: (message: string, coordinates?: AttachedLocation) => void;
  isStreaming?: boolean;
  isAuthenticated?: boolean;
  attachedLocation?: AttachedLocation | null;
  onOpenLocationPicker?: () => void;
  onRemoveLocation?: () => void;
  isLocating?: boolean;
}

// ================================================================
// Component
// ================================================================

export default function ChatInput({
  hasStarted,
  uploadedDocument,
  isUploading,
  onUpload,
  onRemoveFile,
  onSubmit,
  isStreaming = false,
  isAuthenticated = false,
  attachedLocation = null,
  onOpenLocationPicker,
  onRemoveLocation,
  isLocating = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);

  /*
   * Local file state.
   * This is used to show the attached file immediately
   * while the upload request is running.
   */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ==============================================================
  // Auto-resize textarea height on content change
  // ==============================================================

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 36), 160)}px`;
    }
  }, [message]);

  // ==============================================================
  // Auto-focus on mount
  // ==============================================================

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ==============================================================
  // Sync Local File With Parent
  // ==============================================================

  useEffect(() => {
    if (!uploadedDocument) {
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [uploadedDocument]);

  // ==============================================================
  // File displayed in input
  // ==============================================================

  const rawFilename =
    uploadedDocument?.filename ||
    uploadedDocument?.file?.name ||
    selectedFile?.name;

  const displayFilename = cleanDisplayName(rawFilename, "Attached File");

  const hasAttachment = Boolean(
    uploadedDocument || selectedFile
  );

  const isImageAttachment = Boolean(
    (selectedFile?.type && selectedFile.type.startsWith("image/")) ||
    (uploadedDocument?.file?.type && uploadedDocument.file.type.startsWith("image/")) ||
    (displayFilename && /\.(png|jpe?g|webp)$/i.test(displayFilename))
  );

  // ==============================================================
  // Attachment Click (Guard for guests)
  // ==============================================================

  const handleAttachmentClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    fileInputRef.current?.click();
  };

  // ==============================================================
  // File Upload
  // ==============================================================

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      event.target.value = "";
      return;
    }

    const fileType = file.type ? file.type.toLowerCase() : "";
    const fileName = file.name.toLowerCase();
    const ext = fileName.split(".").pop() || "";

    const supportedExts = [
      "pdf",
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "svg",
      "bmp",
      "txt",
      "md",
      "markdown",
      "csv",
      "tsv",
      "docx",
      "doc",
      "xlsx",
      "xls",
      "pptx",
      "ppt",
      "json",
      "xml",
      "html",
      "css",
      "js",
      "ts",
      "py",
      "sql",
      "log",
    ];

    const isAllowed =
      fileType.startsWith("image/") ||
      fileType.startsWith("text/") ||
      fileType.includes("pdf") ||
      fileType.includes("document") ||
      fileType.includes("sheet") ||
      fileType.includes("presentation") ||
      fileType.includes("json") ||
      fileType.includes("xml") ||
      supportedExts.includes(ext);

    if (!isAllowed) {
      alert(
        getLocalizedErrorMessage(
          "UNSUPPORTED_MEDIA_TYPE",
          "Please upload a supported document (PDF, TXT, CSV, DOCX, XLSX, JSON) or image file."
        )
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    try {
      await onUpload(file);
    } catch (error) {
      console.error("File selection failed:", error);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      textareaRef.current?.focus();
    }
  };

  // ==============================================================
  // Remove File
  // ==============================================================

  const handleRemoveFile = () => {
    if (isUploading || isStreaming) {
      return;
    }

    setSelectedFile(null);
    onRemoveFile();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    textareaRef.current?.focus();
  };

  // ==============================================================
  // Send Button State
  // ==============================================================

  const canSend =
    !isUploading &&
    !isStreaming &&
    (message.trim().length > 0 || hasAttachment || Boolean(attachedLocation));

  // ==============================================================
  // Submit
  // ==============================================================

  const submitMessage = () => {
    if (!canSend) {
      return;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage && !hasAttachment && !attachedLocation) {
      return;
    }

    if (isUploading || isStreaming) {
      return;
    }

    onSubmit(trimmedMessage, attachedLocation || undefined);

    setMessage("");
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  // ==============================================================
  // Form Submit & Key Handlers
  // ==============================================================

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSend) {
      submitMessage();
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        submitMessage();
      }
    }
  };

  // ==============================================================
  // Render
  // ==============================================================

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        onClick={() => textareaRef.current?.focus()}
        className="
          mx-auto
          w-full
          cursor-text
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-2.5
          shadow-xs
          transition-all
          duration-150
          focus-within:border-zinc-300
          focus-within:shadow-md
        "
      >

        {/* ======================================================
            ATTACHMENT PREVIEW (ChatGPT Style Circular Progress)
        ====================================================== */}

        {hasAttachment && displayFilename && (() => {
          const fileDetails = getFileDetails(
            displayFilename,
            selectedFile?.type || uploadedDocument?.file?.type
          );

          const isProcessing = Boolean(isUploading || uploadedDocument?.isProcessing);
          const chunks = uploadedDocument?.chunks ?? uploadedDocument?.currentChunk;
          const totalChunks = uploadedDocument?.totalChunks;
          const progressPercent = Math.min(
            Math.max(uploadedDocument?.progress ?? (isUploading ? 30 : 100), 10),
            100
          );

          const renderFileTypeIcon = () => {
            switch (fileDetails.category) {
              case "image":
                return <ImageIcon className="h-4.5 w-4.5" />;
              case "code":
                return <FileCode className="h-4.5 w-4.5" />;
              case "excel":
                return <FileSpreadsheet className="h-4.5 w-4.5" />;
              case "archive":
                return <FileArchive className="h-4.5 w-4.5" />;
              case "text":
              case "pdf":
              case "word":
              case "powerpoint":
              default:
                return <FileText className="h-4.5 w-4.5" />;
            }
          };

          // Circle math: r=15, circumference = 2 * PI * 15 ≈ 94.25
          const circumference = 94.25;
          const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

          return (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("pdf:open", {
                      detail: {
                        filename: displayFilename,
                        documentId: uploadedDocument?.documentId || null,
                        file: uploadedDocument?.file || selectedFile || null,
                      },
                    })
                  );
                }
              }}
              className="group relative mb-2.5 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-2 sm:px-3 sm:py-2 transition-all hover:bg-zinc-100/90 shadow-2xs cursor-pointer max-w-full sm:max-w-md"
              title="Click to preview attached document"
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* ChatGPT-style Icon with Radial Progress Ring */}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  {isProcessing ? (
                    <>
                      {/* SVG Circular Progress Track & Fill */}
                      <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          className="stroke-zinc-200 fill-none"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          className="stroke-[#56C5D9] fill-none transition-all duration-300 ease-out"
                          strokeWidth="2.5"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-[#56C5D9]/10 text-[#0e879c]">
                        {renderFileTypeIcon()}
                      </div>
                    </>
                  ) : (
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                        uploadedDocument?.documentId
                          ? "border-emerald-200/80 bg-emerald-50 text-emerald-600"
                          : fileDetails.colorClass
                      }`}
                    >
                      {renderFileTypeIcon()}
                      {uploadedDocument?.documentId && (
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* File Details & Live Status */}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
                    {displayFilename}
                  </p>

                  <p className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">
                    {isProcessing
                      ? uploadedDocument?.statusMessage ||
                        (chunks && totalChunks
                          ? `Chunk ${chunks}/${totalChunks}...`
                          : chunks
                          ? `Chunk ${chunks}...`
                          : `Processing...`)
                      : chunks
                      ? `${fileDetails.label.toUpperCase()} · ${chunks} chunks`
                      : selectedFile?.size
                      ? `${fileDetails.label.toUpperCase()} · ${formatFileSize(selectedFile.size)}`
                      : uploadedDocument?.documentId
                      ? `${fileDetails.label.toUpperCase()} · Ready`
                      : `${fileDetails.label} attached`}
                  </p>
                </div>
              </div>

              {/* Actions: Preview & Remove */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("pdf:open", {
                          detail: {
                            filename: displayFilename,
                            documentId: uploadedDocument?.documentId || null,
                            file:
                              uploadedDocument?.file ||
                              selectedFile ||
                              null,
                          },
                        })
                      );
                    }
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200/80 hover:text-zinc-900 cursor-pointer"
                  title={`Open and preview ${fileDetails.label.toLowerCase()}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  disabled={isUploading && !uploadedDocument?.documentId}
                  aria-label="Remove file"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ======================================================
            INPUT ROW
        ====================================================== */}

        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* ====================================================
              Attachment Button
          ==================================================== */}

          <button
            type="button"
            onClick={handleAttachmentClick}
            disabled={isUploading || isStreaming}
            aria-label={
              isAuthenticated
                ? "Attach document or image"
                : "Sign in to attach files"
            }
            title={
              isAuthenticated
                ? "Attach document or image"
                : "Sign in to attach files"
            }
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-xl
              text-zinc-500
              transition-colors
              hover:bg-zinc-100
              hover:text-zinc-900
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* ====================================================
              Location Button (GPS / Map Pin)
          ==================================================== */}

          {onOpenLocationPicker && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLocationPicker();
              }}
              disabled={isUploading || isStreaming || isLocating}
              aria-label={attachedLocation ? "Change location" : "Add location"}
              title={
                attachedLocation
                  ? `Location: ${attachedLocation.address || "Attached"}`
                  : "Access GPS or drop pin on map"
              }
              className={`
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                transition-all
                cursor-pointer
                disabled:cursor-not-allowed
                disabled:opacity-40
                ${
                  attachedLocation
                    ? "bg-[#eef9fb] text-[#0e879c] border border-[#56C5D9]/50 shadow-2xs"
                    : isLocationQuery(message)
                    ? "bg-[#eef9fb] text-[#0e879c] border border-[#56C5D9]/60 shadow-2xs ring-2 ring-[#56C5D9]/20"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                }
              `}
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
              ) : (
                <MapPin className={`h-4 w-4 ${isLocationQuery(message) && !attachedLocation ? "text-[#0e879c]" : ""}`} />
              )}
            </button>
          )}

          {/* ====================================================
              Hidden File Input
          ==================================================== */}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.txt,.csv,.json,.md,.docx,.xlsx,.pptx,.xml,.py,.js,.ts"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* ====================================================
              Message Input
          ==================================================== */}

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              hasAttachment
                ? `Ask something about this ${getFileDetails(displayFilename, selectedFile?.type || uploadedDocument?.file?.type).label.toLowerCase()}...`
                : "Message AI Chat..."
            }
            rows={1}
            className="
              max-h-40
              min-h-[36px]
              flex-1
              resize-none
              bg-transparent
              px-2.5
              py-[7px]
              font-sans
              text-[15px]
              font-normal
              leading-[22px]
              text-zinc-900
              outline-none
              placeholder:font-normal
              placeholder:text-zinc-400
              disabled:opacity-70
            "
          />

          {/* ====================================================
              Send / Arrow Button
          ==================================================== */}

          <button
            type="submit"
            onClick={(e) => {
              e.stopPropagation();
            }}
            disabled={!canSend}
            aria-label={
              isStreaming
                ? "Generating response..."
                : isUploading
                  ? "Uploading document..."
                  : "Send message"
            }
            className={`
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-xl
              transition-all
              duration-150

              ${
                canSend
                  ? "cursor-pointer bg-zinc-900 text-white shadow-xs hover:bg-zinc-700 active:scale-95"
                  : isStreaming || isUploading
                    ? "cursor-wait bg-zinc-100 text-zinc-600"
                    : "cursor-not-allowed bg-zinc-100 text-zinc-300"
              }
            `}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
            ) : isStreaming ? (
              <div className="flex h-3 w-3 items-center justify-center">
                <Square className="h-2.5 w-2.5 fill-zinc-700 text-zinc-700" />
              </div>
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </form>

      {/* ========================================================
          Footer
      ======================================================== */}

      <p className="mt-2 text-center text-[11px] text-zinc-400">
        AI Chat can make mistakes. Please check important information.
      </p>

      {/* ========================================================
          AUTH REQUIRED MODAL (When guest tries to upload document)
      ======================================================== */}

      {authModalOpen && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/40
            px-4
            backdrop-blur-xs
          "
          onClick={() => setAuthModalOpen(false)}
          role="presentation"
        >
          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              border
              border-zinc-200
              bg-white
              p-6
              shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <FileText className="h-5 w-5" />
              </div>

              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-zinc-900">
                Sign in to attach files
              </h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                Guest users can chat freely, but uploading and analyzing PDF documents or images with Vector RAG retrieval requires an account.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Continue as Guest
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}