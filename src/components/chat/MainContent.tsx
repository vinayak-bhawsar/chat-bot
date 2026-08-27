"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ExternalLink,
  Eye,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";

import { getFileDetails, cleanDisplayName } from "@/lib/fileTypes";
import BrandLogo from "@/components/common/BrandLogo";
import PdfViewerModal from "@/components/common/PdfViewerModal";
import MarkdownMessage from "./MarkdownMessage";

import WelcomeScreen from "./WelcomeScreen";
import ChatInput, {
  UploadedDocument,
} from "./ChatInput";

import {
  ChatAttachment,
  Conversation,
} from "@/types/chat";

import {
  streamChat,
} from "@/lib/chat";

import {
  getAccessToken,
  uploadDocument,
  getDocuments,
  extractDocumentId,
  extractConversationId,
} from "@/lib/api";

import {
  saveAttachmentMetadata,
  migrateAttachmentMetadata,
} from "@/lib/attachmentStorage";

import {
  getLocalizedErrorMessage,
} from "@/i18n";

import { useAuth } from "@/context/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://rag-chatbot-v2hu.onrender.com";

// ================================================================
// Image Attachment Preview Component
// ================================================================

function ImageAttachmentPreview({
  attachment,
  onClick,
}: {
  attachment: ChatAttachment;
  onClick: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let localBlobUrl: string | null = null;

    if (attachment.file) {
      try {
        const url = URL.createObjectURL(attachment.file);
        localBlobUrl = url;
        setImageSrc(url);
      } catch {
        // ignore
      }
      return () => {
        if (localBlobUrl) {
          URL.revokeObjectURL(localBlobUrl);
        }
      };
    }

    if (attachment.url) {
      setImageSrc(attachment.url);
      return;
    }

    if (attachment.documentId) {
      setLoading(true);
      const accessToken = getAccessToken();
      const headers: Record<string, string> = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {};

      const candidateEndpoints = [
        `${API_URL}/documents/${encodeURIComponent(attachment.documentId)}/download`,
        `${API_URL}/documents/${encodeURIComponent(attachment.documentId)}/file`,
        `${API_URL}/documents/${encodeURIComponent(attachment.documentId)}`,
      ];

      (async () => {
        for (const ep of candidateEndpoints) {
          try {
            const res = await fetch(ep, { headers });
            if (!res.ok) continue;
            const cType = res.headers.get("content-type") || "";
            if (cType.includes("image/") || cType.includes("octet-stream") || cType.includes("binary")) {
              const blob = await res.blob();
              const bUrl = URL.createObjectURL(new Blob([blob], { type: cType || "image/png" }));
              localBlobUrl = bUrl;
              if (!isCancelled) {
                setImageSrc(bUrl);
                setLoading(false);
              }
              return;
            }
            if (cType.includes("application/json")) {
              const json = await res.json();
              const d = json?.data || json;
              const fUrl = d?.url || d?.download_url || d?.file_url;
              if (fUrl && typeof fUrl === "string") {
                if (!isCancelled) {
                  setImageSrc(fUrl);
                  setLoading(false);
                }
                return;
              }
              const b64 = d?.base64 || d?.file_content || d?.content_base64;
              if (b64 && typeof b64 === "string") {
                const cleanB64 = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
                if (!isCancelled) {
                  setImageSrc(cleanB64);
                  setLoading(false);
                }
                return;
              }
            }
          } catch {
            // try next endpoint
          }
        }
        if (!isCancelled) {
          setLoading(false);
        }
      })();

      return () => {
        isCancelled = true;
        if (localBlobUrl) {
          URL.revokeObjectURL(localBlobUrl);
        }
      };
    }
  }, [attachment.file, attachment.url, attachment.documentId]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl bg-white border border-zinc-200/90 overflow-hidden text-left shadow-2xs hover:border-zinc-300 hover:shadow-xs transition cursor-pointer max-w-[280px] sm:max-w-[320px]"
      title="Click to view full image"
    >
      {imageSrc ? (
        <div className="relative w-full h-44 bg-zinc-950 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={attachment.filename || "Image attachment"}
            className="max-h-full max-w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </span>
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-28 w-full items-center justify-center bg-zinc-50 text-zinc-400 gap-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          <span>Loading image...</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2.5 p-2.5 w-full bg-white">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
            {cleanDisplayName(attachment.filename, "Attached Image")}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Eye className="h-3 w-3 text-zinc-400" />
            <span>Image • Click to view</span>
          </span>
        </div>
      </div>
    </button>
  );
}

// ================================================================
// File / Document Attachment Card Component
// ================================================================

function FileAttachmentCard({
  attachment,
  onClick,
}: {
  attachment: ChatAttachment;
  onClick: () => void;
}) {
  const details = getFileDetails(attachment.filename, attachment.file?.type);
  const { category, label, colorClass, borderHover } = details;

  const renderIcon = () => {
    switch (category) {
      case "code":
        return <FileCode className="h-5 w-5" />;
      case "excel":
        return <FileSpreadsheet className="h-5 w-5" />;
      case "archive":
        return <FileArchive className="h-5 w-5" />;
      case "text":
      case "pdf":
      case "word":
      case "powerpoint":
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl bg-white border border-zinc-200/90 px-4 py-3 text-left shadow-2xs ${borderHover} hover:bg-zinc-50 transition cursor-pointer max-w-[280px] sm:max-w-[340px]`}
      title={`Click to view ${label}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${colorClass}`}
      >
        {renderIcon()}
      </div>
      <div className="min-w-0 flex-1 pr-1">
        <span className="block truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
          {cleanDisplayName(attachment.filename, "Attached Document")}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
          <Eye className="h-3 w-3 text-zinc-400 group-hover:text-zinc-600" />
          <span>{`${label} • Open`}</span>
        </span>
      </div>
    </button>
  );
}

interface MainContentProps {
  activeConversationId: string | null;

  conversations: Conversation[];

  onNewChat: () => string;

  onUpdateConversation: (
    conversationId: string,
    messages:
      | Conversation["messages"]
      | ((
        messages: Conversation["messages"]
      ) => Conversation["messages"])
  ) => void;

  onReplaceConversationId?: (
    temporaryId: string,
    backendId: string
  ) => void;

  onUpdateConversationTitle?: (
    conversationId: string,
    title: string
  ) => void;
}

export default function MainContent({
  activeConversationId,
  conversations,
  onNewChat,
  onUpdateConversation,
  onReplaceConversationId,
  onUpdateConversationTitle,
}: MainContentProps) {
  const {
    isAuthenticated,
  } = useAuth();

  const [
    isStreaming,
    setIsStreaming,
  ] = useState(false);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  // ==============================================================
  // SELECTED DOCUMENT
  // ==============================================================

  const [
    uploadedDocument,
    setUploadedDocument,
  ] =
    useState<UploadedDocument | null>(
      null
    );

  // ==============================================================
  // PDF VIEWER MODAL STATE (OPEN FORMAT)
  // ==============================================================

  const [previewPdf, setPreviewPdf] =
    useState<{
      isOpen: boolean;
      filename: string;
      documentId?: string | null;
      file?: File | null;
      url?: string | null;
    }>({
      isOpen: false,
      filename: "",
      documentId: null,
      file: null,
      url: null,
    });

  // ==============================================================
  // ACTIVE CONVERSATION
  // ==============================================================

  const activeConversation =
    useMemo(() => {
      if (
        !activeConversationId
      ) {
        return null;
      }

      return (
        conversations.find(
          (conversation) =>
            conversation.id ===
            activeConversationId
        ) ?? {
          id: activeConversationId,
          title: "Chat",
          messages: [],
        }
      );
    }, [
      activeConversationId,
      conversations,
    ]);

  // ==============================================================
  // DOCUMENT SELECT EVENT
  // ==============================================================

  useEffect(() => {
    const handleDocumentSelect =
      (event: Event) => {
        const customEvent =
          event as CustomEvent;

        const doc =
          customEvent.detail;

        console.log(
          "DOCUMENT SELECT EVENT:",
          doc
        );

        // --------------------------------------------------------
        // Document was cleared
        // --------------------------------------------------------

        if (!doc) {
          setUploadedDocument(
            null
          );

          return;
        }

        // --------------------------------------------------------
        // Don't select folder
        // --------------------------------------------------------

        if (
          doc.is_folder === true
        ) {
          return;
        }

        // --------------------------------------------------------
        // IMPORTANT:
        // The backend document ID MUST come from doc.id
        // --------------------------------------------------------

        const documentId = extractDocumentId(doc);

        if (!documentId) {
          console.error(
            "Document selected from Knowledge Base but ID is missing:",
            doc
          );
          return;
        }

        const filename =
          typeof doc.file_name === "string" && doc.file_name
            ? doc.file_name
            : typeof doc.filename === "string" && doc.filename
              ? doc.filename
              : "Document";

        // --------------------------------------------------------
        // Store document for current input (Global Knowledge Base)
        // --------------------------------------------------------

        setUploadedDocument({
          file: null,
          documentId,
          filename,
          source: "knowledge_base",
        });

        // --------------------------------------------------------
        // IMPORTANT DEBUG
        // --------------------------------------------------------

        console.log(
          "DOCUMENT STORED FOR CHAT (KNOWLEDGE BASE):",
          {
            documentId,
            filename,
            source: "knowledge_base",
          }
        );
      };

    window.addEventListener(
      "document:select",
      handleDocumentSelect
    );

    return () => {
      window.removeEventListener(
        "document:select",
        handleDocumentSelect
      );
    };
  }, []);

  // ==============================================================
  // GLOBAL LISTENER TO OPEN PDF IN OPEN FORMAT
  // ==============================================================

  useEffect(() => {
    const handlePdfOpen = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent;
      const detail =
        customEvent.detail;

      if (!detail) return;

      setPreviewPdf({
        isOpen: true,
        filename:
          detail.filename ||
          detail.file_name ||
          detail.name ||
          detail.file?.name ||
          "document.pdf",
        documentId:
          detail.documentId ||
          detail.id ||
          null,
        file: detail.file || null,
        url: detail.url || null,
      });
    };

    window.addEventListener(
      "pdf:open",
      handlePdfOpen
    );

    return () => {
      window.removeEventListener(
        "pdf:open",
        handlePdfOpen
      );
    };
  }, []);

  // ==============================================================
  // LOCAL FILE UPLOAD
  // ==============================================================

  const handleUpload = async (
    file: File
  ) => {
    if (
      !isAuthenticated
    ) {
      console.warn("Guest users cannot upload files.");
      return;
    }

    setIsUploading(true);
    setUploadedDocument({
      file,
      documentId: "",
      filename: file.name,
    });

    try {
      const convId =
        activeConversation &&
        !activeConversation.id.startsWith("temp-") &&
        !activeConversation.id.startsWith("local-") &&
        !activeConversation.id.startsWith("guest-")
          ? activeConversation.id
          : undefined;

      let response: any;
      try {
        response = await uploadDocument({
          file,
          conversation_id: convId,
        });
      } catch (firstErr) {
        console.warn(
          "Upload initial attempt failed, retrying in 1.5s...",
          firstErr
        );
        await new Promise((res) => setTimeout(res, 1500));
        response = await uploadDocument({
          file,
          conversation_id: convId,
        });
      }

      console.log("FULL DOCUMENT UPLOAD RESPONSE:", response);

      const docId = extractDocumentId(response);

      console.log("EXTRACTED DOCUMENT ID:", docId);

      if (!docId) {
        console.error("FULL DOCUMENT UPLOAD RESPONSE (MISSING ID):", response);
        throw new Error(
          "Document uploaded, but backend did not return document ID."
        );
      }

      const cleanDocId = String(docId).trim();
      const uploadConvId = extractConversationId(response);

      if (
        uploadConvId &&
        isAuthenticated &&
        activeConversation &&
        uploadConvId !== activeConversation.id
      ) {
        onReplaceConversationId?.(
          activeConversation.id,
          uploadConvId
        );
        migrateAttachmentMetadata(
          activeConversation.id,
          uploadConvId
        );
      }

      setUploadedDocument({
        file,
        documentId: cleanDocId,
        filename: file.name,
        source: "conversation",
      });
    } catch (err: any) {
      console.error("Document upload failed:", err);
      alert(
        getLocalizedErrorMessage(
          err,
          "Failed to upload document. Please try again."
        )
      );
      setUploadedDocument(null);
    } finally {
      setIsUploading(false);
    }
  };

  // ==============================================================
  // REMOVE DOCUMENT
  // ==============================================================

  const handleRemoveDocument =
    () => {
      if (
        isStreaming ||
        isUploading
      ) {
        return;
      }

      setUploadedDocument(
        null
      );

      console.log(
        "SELECTED DOCUMENT CLEARED"
      );
    };

  // ==============================================================
  // SUBMIT MESSAGE
  // ==============================================================

  const handleSubmit = async (
    message: string
  ) => {
    // ------------------------------------------------------------
    // Prevent duplicate request
    // ------------------------------------------------------------

    if (
      isStreaming ||
      isUploading
    ) {
      return;
    }

    const question =
      message.trim();

    // ------------------------------------------------------------
    // DOCUMENT INFORMATION
    // ------------------------------------------------------------

    let documentId =
      uploadedDocument?.documentId?.trim() ||
      null;

    const documentFile =
      uploadedDocument?.file ||
      null;

    const filename =
      uploadedDocument?.filename ||
      documentFile?.name ||
      null;

    // ------------------------------------------------------------
    // DEBUG
    // ------------------------------------------------------------

    console.log(
      "DOCUMENT BEFORE CHAT:",
      {
        documentId,
        filename,
        hasFile:
          Boolean(
            documentFile
          ),
      }
    );

    // ------------------------------------------------------------
    // Nothing to send
    // ------------------------------------------------------------

    if (
      !question &&
      !uploadedDocument
    ) {
      return;
    }

    // ============================================================
    // GET / CREATE CONVERSATION
    // ============================================================

    let conversation =
      activeConversation;

    if (!conversation) {
      const newConversationId =
        "temp-" + crypto.randomUUID();

      conversation = {
        id:
          newConversationId,

        title:
          "New Chat",

        messages:
          [],
      };
    }

    // ============================================================
    // UPLOAD LOCAL FILE FIRST
    // ============================================================

    let uploadConvId: string | null = null;

    if (
      documentFile &&
      !documentId
    ) {
      setIsUploading(
        true
      );

      try {
        console.log(
          "Uploading local file:",
          documentFile.name
        );

        const convId =
          conversation.messages.length > 0 &&
          !conversation.id.startsWith("temp-") &&
          !conversation.id.startsWith("local-") &&
          !conversation.id.startsWith("guest-")
            ? conversation.id
            : undefined;

        let response: any;
        try {
          response = await uploadDocument({
            file: documentFile,
            conversation_id: convId,
          });
        } catch (initialUploadErr: any) {
          // Auto-retry once after 1.5s if 502/503/504 or network error (e.g. Render server cold-start)
          console.warn("Upload failed on first attempt, retrying in 1.5s (server waking up)...", initialUploadErr);
          await new Promise((res) => setTimeout(res, 1500));
          response = await uploadDocument({
            file: documentFile,
            conversation_id: convId,
          });
        }

        // --------------------------------------------------------
        // Extract backend document ID
        // --------------------------------------------------------

        console.log("FULL DOCUMENT UPLOAD RESPONSE:", response);

        const extractedDocId = extractDocumentId(response);

        console.log("EXTRACTED DOCUMENT ID:", extractedDocId);

        if (!extractedDocId) {
          console.error("FULL DOCUMENT UPLOAD RESPONSE (MISSING ID):", response);
          throw new Error(
            "Document uploaded, but backend did not return document ID."
          );
        }

        documentId = String(extractedDocId).trim();
        uploadConvId = extractConversationId(response) || convId || null;

        if (
          uploadConvId &&
          isAuthenticated &&
          conversation.id !== uploadConvId
        ) {
          onReplaceConversationId?.(
            conversation.id,
            uploadConvId
          );
          migrateAttachmentMetadata(
            conversation.id,
            uploadConvId
          );
        }

        console.log(
          "UPLOADED DOCUMENT ID:",
          documentId,
          "CONVERSATION ID:",
          uploadConvId
        );

        // --------------------------------------------------------
        // Update state
        // --------------------------------------------------------

        setUploadedDocument({
          file:
            documentFile,

          documentId,

          filename:
            documentFile.name,

          source: "conversation",
        });
      } catch (
      error: any
      ) {
        console.error(
          "Document upload failed after retry:",
          error
        );

        setIsUploading(
          false
        );

        const isImageDoc = Boolean(
          documentFile?.type?.startsWith("image/") ||
          (filename && /\.(png|jpe?g|webp)$/i.test(filename)) ||
          (documentFile?.name && /\.(png|jpe?g|webp)$/i.test(documentFile.name))
        );

        const errMsg = error?.message || "Failed to upload document. Please check your connection and try again.";
        const failedUserMessage: any = {
          id: crypto.randomUUID(),
          role: "user" as const,
          content: question && question.trim() ? question.trim() : `[Attached ${isImageDoc ? "image" : "document"}: ${documentFile.name}]`,
          attachment: {
            type: isImageDoc ? "image" : "pdf",
            filename: documentFile.name,
            file: documentFile,
          },
        };

        const failedAssistantMessage: any = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `⚠️ **Upload Failed**: ${errMsg}\n\nThe backend server on Render may be waking up from sleep. Please wait a few seconds and try sending your document again.`,
        };

        onUpdateConversation(conversation.id, [
          ...conversation.messages,
          failedUserMessage,
          failedAssistantMessage,
        ]);

        return;
      } finally {
        setIsUploading(
          false
        );
      }
    }

    // ============================================================
    // DOCUMENT RESOLUTION HIERARCHY
    //
    // Order:
    // 1. Current uploaded/attached document (ChatInput)
    // 2. Conversation's document_id
    // 3. Last document attached in this conversation
    // 4. Persisted conversation document ID
    // 5. No document (null)
    // ============================================================

    const isCurrentAttachment = Boolean(
      uploadedDocument?.file ||
        (uploadedDocument?.documentId &&
          uploadedDocument.documentId.trim())
    );

    const currentAttachmentSource =
      uploadedDocument?.source ||
      (uploadedDocument?.file
        ? "conversation"
        : uploadedDocument?.documentId
          ? "knowledge_base"
          : undefined);

    const lastAttachedDoc = [
      ...conversation.messages,
    ]
      .reverse()
      .find(
        (m) =>
          m.attachment?.documentId
      )?.attachment;

    const storedConvDocId =
      (isAuthenticated &&
      typeof window !== "undefined" &&
      conversation.id &&
      !conversation.id.startsWith("temp-")
        ? localStorage.getItem(`conversation_doc_${conversation.id}`)
        : null) || null;

    const storedConvDocName =
      (isAuthenticated &&
      typeof window !== "undefined" &&
      conversation.id &&
      !conversation.id.startsWith("temp-")
        ? localStorage.getItem(`conversation_doc_name_${conversation.id}`)
        : null) || null;

    let selectedDocumentId: string | null = null;
    let selectedDocumentName: string | null = null;
    let documentScope: "knowledge_base" | "conversation" | "none" = "none";

    if (isCurrentAttachment && (documentId || uploadedDocument?.documentId)) {
      selectedDocumentId = (documentId || uploadedDocument?.documentId || "").trim();
      selectedDocumentName = (filename || uploadedDocument?.filename || "").trim() || null;
      documentScope = currentAttachmentSource === "knowledge_base" ? "knowledge_base" : "conversation";
    } else if (conversation.document_id?.trim()) {
      selectedDocumentId = conversation.document_id.trim();
      selectedDocumentName = conversation.document_name?.trim() || null;
      documentScope = "conversation";
    } else if (lastAttachedDoc?.documentId?.trim()) {
      selectedDocumentId = lastAttachedDoc.documentId.trim();
      selectedDocumentName = lastAttachedDoc.filename?.trim() || null;
      documentScope = "conversation";
    } else if (storedConvDocId) {
      selectedDocumentId = storedConvDocId.trim();
      selectedDocumentName = storedConvDocName ? storedConvDocName.trim() : null;
      documentScope = "conversation";
    }

    if (
      isAuthenticated &&
      selectedDocumentId &&
      documentScope === "conversation" &&
      typeof window !== "undefined"
    ) {
      localStorage.setItem(
        `conversation_doc_${conversation.id}`,
        selectedDocumentId
      );
      if (selectedDocumentName) {
        localStorage.setItem(
          `conversation_doc_name_${conversation.id}`,
          selectedDocumentName
        );
      }
    }

    // Reset current input's uploaded document so next message is clean
    setUploadedDocument(null);

    // ============================================================
    // EFFECTIVE QUESTION & CONVERSATION ID
    // ============================================================

    const isImage = Boolean(
      documentFile?.type?.startsWith("image/") ||
      (filename && /\.(png|jpe?g|webp)$/i.test(filename)) ||
      (documentFile?.name && /\.(png|jpe?g|webp)$/i.test(documentFile.name))
    );

    const effectiveQuestion =
      question && question.trim()
        ? question.trim()
        : isImage
          ? "Please analyze this image."
          : "Please summarize this document.";

    let backendConversationId: string | null =
      uploadConvId ||
      (conversation.messages.length > 0 &&
      !conversation.id.startsWith("temp-") &&
      !conversation.id.startsWith("local-") &&
      !conversation.id.startsWith("guest-")
        ? conversation.id
        : null);

    // ============================================================
    // IMPORTANT FRONTEND DEBUG LOGS
    // ============================================================

    console.log("CURRENT CONVERSATION ID:", conversation.id);
    console.log("SELECTED DOCUMENT ID:", selectedDocumentId);
    console.log("SELECTED DOCUMENT NAME:", selectedDocumentName);
    console.log("DOCUMENT SCOPE:", documentScope);
    console.log("FINAL CHAT REQUEST:", {
      question: effectiveQuestion,
      conversationId: backendConversationId,
      documentId: selectedDocumentId,
      scope: documentScope,
    });

    // ============================================================
    // USER MESSAGE - Only show attachment card if attached to THIS message
    // ============================================================

    const userMessage: any = {
      id:
        crypto.randomUUID(),

      role:
        "user" as const,

      content:
        question && question.trim() ? question.trim() : "",

      attachment:
        isCurrentAttachment &&
        (documentId || documentFile)
          ? {
              type: isImage ? "image" : "pdf",

              documentId:
                documentId || "",

              filename:
                filename ||
                documentFile?.name ||
                (isImage ? "image.png" : "document.pdf"),

              file:
                documentFile ||
                undefined,
            }
          : undefined,
    };

    if (userMessage.attachment && isAuthenticated) {
      const userIndexInConv = conversation.messages.filter(
        (m: any) =>
          m.role === "user" ||
          m.role === "human" ||
          String(m.role || "").toLowerCase() === "user"
      ).length;

      const meta = {
        messageId: userMessage.id,
        type: userMessage.attachment.type,
        documentId: userMessage.attachment.documentId,
        filename: userMessage.attachment.filename,
        index: userIndexInConv,
      };

      saveAttachmentMetadata(conversation.id, meta);

      if (
        uploadConvId &&
        conversation.id.startsWith("temp-") &&
        uploadConvId !== conversation.id
      ) {
        saveAttachmentMetadata(uploadConvId, meta);
      }
    }

    // ============================================================
    // ASSISTANT MESSAGE
    // ============================================================

    const assistantMessage: any =
    {
      id:
        crypto.randomUUID(),

      role:
        "assistant" as const,

      content:
        "",
    };

    // ============================================================
    // UPDATE UI
    // ============================================================

    onUpdateConversation(
      conversation.id,
      [
        ...conversation.messages,
        userMessage,
        assistantMessage,
      ]
    );

    // ============================================================
    // START STREAM
    // ============================================================

    setIsStreaming(
      true
    );

    try {
      // ==========================================================
      // IMPORTANT:
      //
      // document ID is passed as the
      // 4th argument.
      //
      // filename is the 5th argument.
      // ==========================================================

      await streamChat(
        effectiveQuestion,

        backendConversationId,

        {
          // ======================================================
          // START
          // ======================================================

          onConversation: (
            conversationId
          ) => {
            console.log(
              "BACKEND CONVERSATION ID:",
              conversationId
            );

            if (isAuthenticated) {
              backendConversationId =
                conversationId;

              if (
                conversationId !==
                conversation.id
              ) {
                onReplaceConversationId?.(
                  conversation.id,
                  conversationId
                );
                migrateAttachmentMetadata(
                  conversation.id,
                  conversationId
                );
              }
            }
          },

          // ======================================================
          // DELTA
          // ======================================================

          onMessage: (
            content
          ) => {
            if (!content) {
              return;
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,

              (
                messages
              ) =>
                messages.map(
                  (
                    msg
                  ) => {
                    if (
                      msg.id !==
                      assistantMessage.id
                    ) {
                      return msg;
                    }

                    return {
                      ...msg,

                      content:
                        msg.content +
                        content,
                    };
                  }
                )
            );
          },

          // ======================================================
          // DONE
          // ======================================================

          onDone: (
            answer,
            conversationId
          ) => {
            if (
              conversationId
            ) {
              backendConversationId =
                conversationId;

              if (
                isAuthenticated &&
                conversationId !==
                conversation.id
              ) {
                onReplaceConversationId?.(
                  conversation.id,
                  conversationId
                );
                migrateAttachmentMetadata(
                  conversation.id,
                  conversationId
                );
              }
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            console.log(
              "CHAT COMPLETED:",
              {
                conversationId:
                  targetId,

                documentId:
                  selectedDocumentId,

                filename:
                  selectedDocumentName,
              }
            );

            if (answer) {
              onUpdateConversation(
                targetId,

                (
                  messages
                ) =>
                  messages.map(
                    (
                      msg
                    ) => {
                      if (
                        msg.id !==
                        assistantMessage.id
                      ) {
                        return msg;
                      }

                      return {
                        ...msg,

                        content:
                          answer,
                      };
                    }
                  )
              );
            }

            // ----------------------------------------------------
            // Update title
            // ----------------------------------------------------

            if (
              onUpdateConversationTitle &&
              targetId
            ) {
              const title =
                question.length >
                  50
                  ? `${question.slice(
                    0,
                    50
                  )}...`
                  : question;

              onUpdateConversationTitle(
                targetId,
                title
              );
            }

            // ----------------------------------------------------
            // Clear selected document
            // ----------------------------------------------------

            setUploadedDocument(
              null
            );
          },

          // ======================================================
          // ERROR
          // ======================================================

          onError: (
            message,
            conversationId
          ) => {
            console.error(
              "CHAT STREAM ERROR:",
              message
            );

            const targetId =
              conversationId ??
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,

              (
                messages
              ) =>
                messages.map(
                  (
                    msg
                  ) => {
                    if (
                      msg.id !==
                      assistantMessage.id
                    ) {
                      return msg;
                    }

                    return {
                      ...msg,

                      content:
                        getLocalizedErrorMessage(
                          message,
                          "Failed to generate response."
                        ),
                    };
                  }
                )
            );
          },
        },

        // ========================================================
        // DOCUMENT ID
        //
        // THIS IS THE VALUE THAT MUST
        // APPEAR IN NETWORK PAYLOAD.
        // ========================================================

        selectedDocumentId,

        // ========================================================
        // FILE NAME
        // ========================================================

        selectedDocumentName
      );
    } catch (
    error
    ) {
      console.error(
        "Chat request failed:",
        error
      );

      const targetId =
        backendConversationId ??
        conversation.id;

      onUpdateConversation(
        targetId,

        (
          messages
        ) =>
          messages.map(
            (
              msg
            ) => {
              if (
                msg.id !==
                assistantMessage.id
              ) {
                return msg;
              }

              return {
                ...msg,

                content:
                  getLocalizedErrorMessage(
                    error,
                    "Failed to generate response."
                  ),
              };
            }
          )
      );
    } finally {
      setIsStreaming(
        false
      );
    }
  };

  // ==============================================================
  // CHAT INPUT
  // ==============================================================

  const chatInput = (
    <ChatInput
      hasStarted={
        Boolean(
          activeConversation
        )
      }

      uploadedDocument={
        uploadedDocument
      }

      isUploading={
        isUploading
      }

      onUpload={
        handleUpload
      }

      onRemoveFile={
        handleRemoveDocument
      }

      onSubmit={
        handleSubmit
      }

      isStreaming={
        isStreaming
      }

      isAuthenticated={
        isAuthenticated
      }
    />
  );

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[#f7f7f8] text-zinc-900">
      {/* ==========================================================
          WELCOME SCREEN OR ACTIVE CHAT
          ========================================================== */}
      {!activeConversation ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
          <WelcomeScreen />

          <div className="mt-6 w-full max-w-3xl">
            {chatInput}
          </div>
        </div>
      ) : (
        <>
          {/* ==========================================================
              MESSAGES
              ========================================================== */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-4">
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {activeConversation.messages.map((message: any) => {
                const isUserMessage =
                  message.role === "user" ||
                  message.role === "human" ||
                  String(message.role || "").toLowerCase() === "user" ||
                  Boolean(message.attachment && !message.isAssistant);

                return isUserMessage ? (
                  /* ====================================================
                     USER MESSAGE (Right Aligned, Dark Bubble + Avatar)
                     ==================================================== */
                  <div
                    key={message.id}
                    className="flex justify-end items-end gap-2.5 my-3"
                  >
                    <div className="flex flex-col items-end gap-1.5 max-w-[85%] sm:max-w-[75%]">
                      {/* Attached File Card (Image or Document) */}
                      {message.attachment && (() => {
                        const fileDetails = getFileDetails(
                          message.attachment.filename,
                          message.attachment.file?.type
                        );
                        const isImageMsg =
                          message.attachment.type === "image" ||
                          fileDetails.category === "image";

                        const handleOpenPreview = () => {
                          setPreviewPdf({
                            isOpen: true,
                            filename: cleanDisplayName(
                              message.attachment.filename,
                              isImageMsg ? "image.png" : "document.pdf"
                            ),
                            documentId:
                              message.attachment.documentId || null,
                            file: message.attachment.file || null,
                            url: message.attachment.url || null,
                          });
                        };

                        if (isImageMsg) {
                          return (
                            <ImageAttachmentPreview
                              attachment={message.attachment}
                              onClick={handleOpenPreview}
                            />
                          );
                        }

                        return (
                          <FileAttachmentCard
                            attachment={message.attachment}
                            onClick={handleOpenPreview}
                          />
                        );
                      })()}

                      {(() => {
                        const isAutoSummaryPrompt =
                          Boolean(message.attachment) &&
                          Boolean(
                            message.content &&
                              (message.content === "Please summarize this document." ||
                                message.content === "Please analyze this image." ||
                                message.content.trim() === "")
                          );

                        if (!message.content || isAutoSummaryPrompt) {
                          return null;
                        }

                        return (
                          <div className="rounded-2xl rounded-br-xs bg-[#eef9fb] border border-[#56C5D9]/35 text-zinc-900 px-4 py-2.5 shadow-2xs">
                            <div className="whitespace-pre-wrap leading-relaxed text-zinc-900 text-[14.5px]">
                              {message.content}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div
                      className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#56C5D9] to-[#2ba8be] text-white shadow-2xs mb-0.5"
                      title="You"
                    >
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  /* ====================================================
                     AGENT MESSAGE (Left Aligned, AI Badge + Avatar)
                     ==================================================== */
                  <div
                    key={message.id}
                    className="flex justify-start items-start gap-3 my-4 w-full"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-zinc-200/90 shadow-2xs mt-0.5"
                      title="AI Assistant"
                    >
                      <BrandLogo className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[13px] font-semibold text-zinc-900">
                          AI Assistant
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#56C5D9]/10 text-[#2ba8be] border border-[#56C5D9]/25">
                          Agent
                        </span>
                      </div>

                      <div className="text-[15px] leading-relaxed text-zinc-900">
                        <MarkdownMessage
                          content={message.content}
                          isStreaming={isStreaming && !message.content}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==========================================================
              INPUT
              ========================================================== */}
          <div className="w-full px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="mx-auto w-full max-w-3xl">
              {chatInput}
            </div>
          </div>
        </>
      )}

      {/* ==========================================================
          PDF PREVIEW MODAL (OPEN FORMAT - ALWAYS MOUNTED)
          ========================================================== */}
      <PdfViewerModal
        isOpen={previewPdf.isOpen}
        onClose={() =>
          setPreviewPdf((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        filename={previewPdf.filename}
        documentId={previewPdf.documentId}
        file={previewPdf.file}
        url={previewPdf.url}
      />
    </main>
  );
}