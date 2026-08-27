"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowUp,
  Eye,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Paperclip,
  Square,
  X,
} from "lucide-react";

import { getLocalizedErrorMessage } from "@/i18n";
import { getFileDetails, cleanDisplayName } from "@/lib/fileTypes";

// ================================================================
// Types
// ================================================================

export interface UploadedDocument {
  file: File | null;
  documentId?: string;
  filename: string;
  source?: "knowledge_base" | "conversation";
}

interface ChatInputProps {
  hasStarted: boolean;
  uploadedDocument: UploadedDocument | null;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemoveFile: () => void;
  onSubmit: (message: string) => void;
  isStreaming?: boolean;
  isAuthenticated?: boolean;
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
    (message.trim().length > 0 || hasAttachment);

  // ==============================================================
  // Submit
  // ==============================================================

  const submitMessage = () => {
    if (!canSend) {
      return;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage && !hasAttachment) {
      return;
    }

    if (isUploading || isStreaming) {
      return;
    }

    onSubmit(trimmedMessage);

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
            ATTACHMENT PREVIEW (Authenticated only)
        ====================================================== */}

        {hasAttachment && displayFilename && (() => {
          const fileDetails = getFileDetails(
            displayFilename,
            selectedFile?.type || uploadedDocument?.file?.type
          );

          const renderAttachmentIcon = () => {
            if (isUploading) {
              return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
            }
            switch (fileDetails.category) {
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

          return (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    isUploading
                      ? "border-amber-100 bg-amber-50 text-amber-600"
                      : fileDetails.colorClass
                  }`}
                >
                  {renderAttachmentIcon()}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">
                    {displayFilename}
                  </p>

                  <p className="text-[11px] text-zinc-500">
                    {isUploading
                      ? `Uploading ${fileDetails.label.toLowerCase()}...`
                      : isStreaming
                        ? "Processing..."
                        : uploadedDocument?.documentId
                          ? `Stored in Knowledge Base • Ready to chat`
                          : `${fileDetails.label} attached • Ready to send`}
                  </p>
                </div>
              </div>

              {/* Actions: Preview & Remove */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
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
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900"
                  title={`Open and preview ${fileDetails.label.toLowerCase()}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isUploading || isStreaming}
                  aria-label="Remove file"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
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