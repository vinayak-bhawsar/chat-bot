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
  Loader2,
  Paperclip,
  Square,
  X,
} from "lucide-react";

import { getLocalizedErrorMessage } from "@/i18n";

// ================================================================
// Types
// ================================================================

export interface UploadedDocument {
  file: File | null;
  documentId?: string;
  filename: string;
}

interface ChatInputProps {
  hasStarted: boolean;
  uploadedDocument: UploadedDocument | null;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemoveFile: () => void;
  onSubmit: (message: string) => void;
  isStreaming?: boolean;
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
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  /*
   * Local file state.
   * This is used to show the PDF immediately
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
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 24), 160)}px`;
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

  const displayFilename =
    uploadedDocument?.filename ||
    uploadedDocument?.file?.name ||
    selectedFile?.name;

  const hasAttachment = Boolean(
    uploadedDocument || selectedFile
  );

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

    const isPDF =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      alert(
        getLocalizedErrorMessage(
          "UNSUPPORTED_MEDIA_TYPE",
          "Please upload a PDF file."
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
  // Submit
  // ==============================================================

  const submitMessage = () => {
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
    submitMessage();
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
  // Send Button State
  // ==============================================================

  const canSend =
    !isUploading &&
    !isStreaming &&
    (message.trim().length > 0 || hasAttachment);

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
            PDF PREVIEW
        ====================================================== */}

        {hasAttachment && displayFilename && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="
              mb-2
              flex
              items-center
              justify-between
              rounded-xl
              border
              border-zinc-200
              bg-zinc-50
              px-3
              py-2
            "
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-red-100
                  bg-red-50
                  text-red-600
                "
              >
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">
                  {displayFilename}
                </p>

                <p className="text-[11px] text-zinc-500">
                  {isUploading
                    ? "Uploading document..."
                    : isStreaming
                      ? "Processing..."
                      : uploadedDocument?.documentId
                        ? "Stored document attached • Ready to chat"
                        : "PDF attached • Ready to send"}
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
                className="
                  flex
                  items-center
                  gap-1
                  rounded-md
                  px-2
                  py-1
                  text-xs
                  font-medium
                  text-zinc-600
                  transition
                  hover:bg-zinc-200
                  hover:text-zinc-900
                "
                title="Open and preview PDF"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isUploading || isStreaming}
                aria-label="Remove file"
                className="
                  flex
                  h-7
                  w-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-md
                  text-zinc-500
                  transition
                  hover:bg-zinc-200
                  hover:text-zinc-900
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================
            INPUT ROW
        ====================================================== */}

        <div className="flex min-h-[38px] items-end gap-1.5 sm:gap-2">
          {/* ====================================================
              Attachment Button
          ==================================================== */}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isUploading || isStreaming}
            aria-label="Attach PDF"
            className="
              mb-0.5
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
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
            accept="application/pdf,.pdf"
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
                ? "Ask something about this PDF..."
                : "Message AI Chat..."
            }
            rows={1}
            className="
              max-h-40
              min-h-[26px]
              flex-1
              resize-none
              bg-transparent
              px-2
              py-1
              font-sans
              text-[15px]
              font-normal
              leading-6
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
              mb-0.5
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
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
    </div>
  );
}