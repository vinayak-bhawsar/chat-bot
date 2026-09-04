"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Eye,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Sparkles,
  User,
  HelpCircle,
  RefreshCw,
  Compass,
} from "lucide-react";

import { getFileDetails, cleanDisplayName } from "@/lib/fileTypes";
import BrandLogo from "@/components/common/BrandLogo";
import PdfViewerModal from "@/components/common/PdfViewerModal";
import LocationPickerModal from "@/components/common/LocationPickerModal";
import LocationPermissionGuideModal from "@/components/common/LocationPermissionGuideModal";
import MapSidePanel from "@/components/common/MapSidePanel";
import {
  getCurrentBrowserLocation,
  getGeolocationPermissionStatus,
  reverseGeocode,
  isLocationQuery,
  isLocationPromptRequired,
  saveStoredUserLocation,
  getStoredUserLocation,
  clearStoredUserLocation,
  GeolocationCoordinates,
} from "@/lib/maps";
import MarkdownMessage from "./MarkdownMessage";
import ReasoningAccordion from "./ReasoningAccordion";

import WelcomeScreen from "./WelcomeScreen";
import ChatInput, {
  UploadedDocument,
  AttachedLocation,
} from "./ChatInput";

import {
  ChatAttachment,
  ChatMessage,
  ChatSource,
  Conversation,
} from "@/types/chat";

import {
  streamChat,
} from "@/lib/chat";

import {
  apiRequest,
  getAccessToken,
  uploadDocument,
  getDocuments,
  extractDocumentId,
  extractConversationId,
} from "@/lib/api";

import {
  saveAttachmentMetadata,
  migrateAttachmentMetadata,
  recordChatAttachmentDocId,
} from "@/lib/attachmentStorage";
import { generateChatTitle, resolveConversationTitle } from "@/lib/chatTitle";

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
      ) => Conversation["messages"]),
    newTitle?: string
  ) => void;

  onReplaceConversationId?: (
    temporaryId: string,
    backendId: string,
    backendTitle?: string
  ) => void;

  onUpdateConversationTitle?: (
    conversationId: string,
    title: string
  ) => void;

  isLoadingHistory?: boolean;
}

export default function MainContent({
  activeConversationId,
  conversations,
  isLoadingHistory = false,
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
  // LOCATION STATE (Phase 1)
  // ==============================================================

  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isPermissionGuideOpen, setIsPermissionGuideOpen] = useState(false);
  const [isMapSidePanelOpen, setIsMapSidePanelOpen] = useState(false);
  const [sidePanelLocation, setSidePanelLocation] = useState<GeolocationCoordinates | null>(null);
  const [pendingLocationPrompt, setPendingLocationPrompt] = useState<string>("");
  const [pendingLocationMsgId, setPendingLocationMsgId] = useState<string | null>(null);
  const [inputLocation, setInputLocation] = useState<GeolocationCoordinates | null>(null);

  const handleOpenSideMap = (loc?: GeolocationCoordinates | null) => {
    const targetLoc = loc || sidePanelLocation || null;
    setSidePanelLocation(targetLoc || null);
    setIsMapSidePanelOpen(true);
  };

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
      progress: 15,
      statusMessage: "Uploading document...",
      isProcessing: true,
    });

    try {
      const convId =
        activeConversation &&
          !activeConversation.id.startsWith("temp-") &&
          !activeConversation.id.startsWith("local-") &&
          !activeConversation.id.startsWith("guest-")
          ? activeConversation.id
          : undefined;

      const handleProgress = (p: any) => {
        setUploadedDocument((prev) => {
          if (!prev) return null;
          const chunks = p.chunks ?? p.current_chunk;
          const totalChunks = p.total_chunks;
          const progressPercent =
            p.progress ??
            (chunks && totalChunks
              ? Math.min(Math.round((chunks / totalChunks) * 100), 98)
              : prev.progress ?? 45);

          return {
            ...prev,
            documentId: p.document_id || prev.documentId,
            chunks: typeof chunks === "number" ? chunks : prev.chunks,
            totalChunks: typeof totalChunks === "number" ? totalChunks : prev.totalChunks,
            currentChunk: typeof chunks === "number" ? chunks : prev.currentChunk,
            progress: progressPercent,
            statusMessage:
              p.message ||
              (chunks && totalChunks
                ? `Processing chunk ${chunks} of ${totalChunks}...`
                : chunks
                  ? `Processing chunk ${chunks}...`
                  : "Processing chunks..."),
            isProcessing: p.status !== "completed" && p.status !== "ready",
          };
        });
      };

      const isNewChat = !convId;

      let response: any;
      try {
        response = await uploadDocument({
          file,
          conversation_id: convId,
          is_conversation_new: isNewChat,
          is_chat: true,
          onProgress: handleProgress,
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
          is_conversation_new: isNewChat,
          is_chat: true,
          onProgress: handleProgress,
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
      recordChatAttachmentDocId(cleanDocId);
      const uploadConvId = extractConversationId(response) || convId;
      const totalChunks = response?.chunks ?? response?.total_chunks ?? response?.data?.chunks;

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
        chunks: typeof totalChunks === "number" ? totalChunks : undefined,
        totalChunks: typeof totalChunks === "number" ? totalChunks : undefined,
        progress: 100,
        statusMessage: typeof totalChunks === "number" ? `${totalChunks} chunks processed • Ready to chat` : "Indexed • Ready to chat",
        isProcessing: false,
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
  // ==============================================================
  // LOCATION HANDLERS (Browser Geolocation & Google Maps Picker)
  // ==============================================================

  const handleCurrentLocation = async (userPrompt?: string) => {
    if (isStreaming || isAcquiringLocation) return;
    setLocationError(null);

    const effectivePrompt = userPrompt || pendingLocationPrompt || "Nearby search";
    setPendingLocationPrompt(effectivePrompt);

    setIsAcquiringLocation(true);

    try {
      // Always invoke browser geolocation to trigger prompt or capture coordinates
      const pos = await getCurrentBrowserLocation({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 0,
      });

      let address = "";
      try {
        address = await reverseGeocode(pos.latitude, pos.longitude);
      } catch (geoErr) {
        console.warn("Reverse geocode failed, falling back to coordinates:", geoErr);
      }

      const locationPayload = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
        address: address || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`,
        full_address: address || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`,
      };

      setIsAcquiringLocation(false);
      setPendingLocationMsgId(null);
      setPendingLocationPrompt("");
      setInputLocation(null);

      // Submit as a new turn with location coordinates - preserves complete chat history
      await handleSubmit(effectivePrompt, locationPayload);
    } catch (err: any) {
      console.warn("Location request failed or was cancelled:", err);
      setIsAcquiringLocation(false);
      clearStoredUserLocation();
      setInputLocation(null);

      const isDenied =
        err?.message?.toLowerCase().includes("denied") ||
        err?.message?.toLowerCase().includes("permission") ||
        err?.code === 1;

      if (isDenied) {
        setLocationError(
          "Location permission is blocked in your browser. You can enable it using the steps below, or simply drop a pin on the map."
        );
      } else {
        setLocationError(err?.message || "Could not retrieve your location.");
      }
      setIsPermissionGuideOpen(true);
    }
  };

  const handleDropLocationClick = (userPrompt?: string) => {
    if (isStreaming || isAcquiringLocation) return;
    setLocationError(null);
    setPendingLocationPrompt(userPrompt || "");
    setIsLocationPickerOpen(true);
  };

  const handleSelectLocationCoordinates = async (coords: GeolocationCoordinates) => {
    setIsLocationPickerOpen(false);
    const locationPayload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? null,
      address: coords.address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
      full_address: coords.address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
    };

    let targetPrompt = pendingLocationPrompt;

    if (!targetPrompt && activeConversation?.messages && activeConversation.messages.length > 0) {
      const precedingUser = [...activeConversation.messages].reverse().find(
        (m: any) => m.role === "user" || m.role === "human"
      );
      targetPrompt = precedingUser?.content || "Nearby search";
    }

    setPendingLocationMsgId(null);
    setPendingLocationPrompt("");
    setInputLocation(null);

    // Submit as a new turn with location coordinates - preserves complete chat history
    await handleSubmit(targetPrompt || "Nearby search", locationPayload);
  };

  // ==============================================================
  // SUBMIT MESSAGE
  // ==============================================================

  const handleSubmit = async (
    message: string,
    coordinates?: AttachedLocation | GeolocationCoordinates | null
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
    // LOCATION RESOLUTION - ONLY send coordinates if explicitly provided by user action
    // (Never automatically send cached/stored coordinates behind the user's back)
    // ------------------------------------------------------------
    const effectiveCoordinates = coordinates || undefined;

    // Clear any lingering input location
    setInputLocation(null);

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
    // INSTANT CONVERSATION TITLE
    // ============================================================

    const instantTitle = generateChatTitle(
      question && question.trim() ? question.trim() : null,
      filename || uploadedDocument?.filename || documentFile?.name || null
    );

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
          instantTitle,

        messages:
          [],
      };
    } else if (
      !conversation.title ||
      conversation.title === "New Chat" ||
      conversation.title === "Chat"
    ) {
      conversation.title = instantTitle;
      onUpdateConversationTitle?.(conversation.id, instantTitle);
    }

    const originalTempId = conversation.id;

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
          conversation.id &&
            !conversation.id.startsWith("temp-") &&
            !conversation.id.startsWith("local-") &&
            !conversation.id.startsWith("guest-")
            ? conversation.id
            : undefined;

        const handleProgress = (p: any) => {
          setUploadedDocument((prev) => {
            if (!prev) return null;
            const chunks = p.chunks ?? p.current_chunk;
            const totalChunks = p.total_chunks;
            const progressPercent =
              p.progress ??
              (chunks && totalChunks
                ? Math.min(Math.round((chunks / totalChunks) * 100), 98)
                : prev.progress ?? 45);

            return {
              ...prev,
              documentId: p.document_id || prev.documentId,
              chunks: typeof chunks === "number" ? chunks : prev.chunks,
              totalChunks: typeof totalChunks === "number" ? totalChunks : prev.totalChunks,
              currentChunk: typeof chunks === "number" ? chunks : prev.currentChunk,
              progress: progressPercent,
              statusMessage:
                p.message ||
                (chunks && totalChunks
                  ? `Processing chunk ${chunks} of ${totalChunks}...`
                  : chunks
                    ? `Processing chunk ${chunks}...`
                    : "Processing chunks..."),
              isProcessing: p.status !== "completed" && p.status !== "ready",
            };
          });
        };

        let response: any;
        try {
          response = await uploadDocument({
            file: documentFile,
            conversation_id: convId,
            onProgress: handleProgress,
          });
        } catch (initialUploadErr: any) {
          // Auto-retry once after 1.5s if 502/503/504 or network error (e.g. Render server cold-start)
          console.warn("Upload failed on first attempt, retrying in 1.5s (server waking up)...", initialUploadErr);
          await new Promise((res) => setTimeout(res, 1500));
          response = await uploadDocument({
            file: documentFile,
            conversation_id: convId,
            onProgress: handleProgress,
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
        recordChatAttachmentDocId(documentId);
        uploadConvId = extractConversationId(response) || convId || null;
        const totalChunks = response?.chunks ?? response?.total_chunks ?? response?.data?.chunks;

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

          chunks: typeof totalChunks === "number" ? totalChunks : undefined,
          totalChunks: typeof totalChunks === "number" ? totalChunks : undefined,
          progress: 100,
          statusMessage: typeof totalChunks === "number" ? `${totalChunks} chunks processed • Ready to chat` : "Indexed • Ready to chat",
          isProcessing: false,
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

        onUpdateConversation(
          conversation.id,
          [
            ...conversation.messages,
            failedUserMessage,
            failedAssistantMessage,
          ],
          conversation.title || instantTitle
        );

        return;
      } finally {
        setIsUploading(
          false
        );
      }
    }

    // ============================================================
    // DOCUMENT RESOLUTION
    // ============================================================

    const isCurrentAttachment = Boolean(
      uploadedDocument?.file ||
      (uploadedDocument?.documentId &&
        uploadedDocument.documentId.trim()) ||
      documentId ||
      documentFile
    );

    const currentAttachmentSource =
      uploadedDocument?.source ||
      (uploadedDocument?.file
        ? "conversation"
        : uploadedDocument?.documentId
          ? "knowledge_base"
          : undefined);

    let selectedDocumentId: string | null = null;
    let selectedDocumentName: string | null = null;
    let documentScope: "knowledge_base" | "conversation" | "none" = "none";

    if (isCurrentAttachment && (documentId || uploadedDocument?.documentId)) {
      selectedDocumentId = (documentId || uploadedDocument?.documentId || "").trim();
      selectedDocumentName = (filename || uploadedDocument?.filename || documentFile?.name || "").trim() || null;
      documentScope = currentAttachmentSource === "knowledge_base" ? "knowledge_base" : "conversation";
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
      (conversation.id &&
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
      coordinates: effectiveCoordinates,
    });

    const targetAssistantId = crypto.randomUUID();

    // ============================================================
    // USER MESSAGE - Only show attachment card if attached to THIS message
    // ============================================================

    const userMessage: any = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: question && question.trim() ? question.trim() : "",
      locationCoordinates: effectiveCoordinates || undefined,
      attachment:
        isCurrentAttachment &&
          (documentId || documentFile || selectedDocumentId)
          ? {
            type: isImage ? "image" : "pdf",
            documentId:
              selectedDocumentId ||
              documentId ||
              "",
            filename:
              selectedDocumentName ||
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
          (m.role as string) === "human" ||
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

    const assistantMessage: any = {
      id: targetAssistantId,
      role: "assistant" as const,
      content: "",
      reasoning: "",
      sources: undefined,
      locationCoordinates: undefined,
    };

    // ============================================================
    // UPDATE UI WITH INSTANT TITLE
    // ============================================================

    if (instantTitle && instantTitle !== "New Chat") {
      onUpdateConversationTitle?.(conversation.id, instantTitle);
    }

    onUpdateConversation(
      conversation.id,
      [
        ...conversation.messages,
        userMessage,
        assistantMessage,
      ],
      conversation.title || instantTitle
    );

    // ============================================================
    // START STREAM
    // ============================================================

    setIsStreaming(
      true
    );

    try {
      await streamChat(
        effectiveQuestion,

        backendConversationId,

        {
          // ======================================================
          // START
          // ======================================================

          onConversation: (
            conversationId,
            serverTitle
          ) => {
            console.log(
              "BACKEND CONVERSATION ID:",
              conversationId,
              "SERVER TITLE:",
              serverTitle
            );

            if (
              serverTitle &&
              serverTitle !== "New Chat" &&
              serverTitle !== "Chat"
            ) {
              onUpdateConversationTitle?.(
                conversationId,
                serverTitle
              );
            }

            if (isAuthenticated) {
              backendConversationId =
                conversationId;
              conversation.id =
                conversationId;

              onReplaceConversationId?.(
                originalTempId,
                conversationId,
                serverTitle || conversation.title || instantTitle
              );
              migrateAttachmentMetadata(
                originalTempId,
                conversationId
              );
            }
          },

          // ======================================================
          // TITLE UPDATE FROM SSE
          // ======================================================

          onTitle: (
            serverTitle
          ) => {
            if (
              serverTitle &&
              serverTitle !== "New Chat" &&
              serverTitle !== "Chat"
            ) {
              const targetId =
                backendConversationId ??
                conversation.id;

              onUpdateConversationTitle?.(
                targetId,
                serverTitle
              );
            }
          },

          // ======================================================
          // SOURCES (ACTUAL RAG RETRIEVAL SOURCES)
          // ======================================================

          onSources: (newSources) => {
            if (!newSources || newSources.length === 0) {
              return;
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  if (msg.id !== targetAssistantId) {
                    return msg;
                  }

                  const existing = msg.sources || [];
                  return {
                    ...msg,
                    sources: [...existing, ...newSources],
                  };
                })
            );
          },

          // ======================================================
          // ACTIVITY / STEP
          // ======================================================

          onActivity: (activityStep) => {
            if (!activityStep) {
              return;
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  if (msg.id !== targetAssistantId) {
                    return msg;
                  }

                  const existing = msg.reasoningSteps || [];
                  if (existing.includes(activityStep)) {
                    return msg;
                  }

                  return {
                    ...msg,
                    reasoningSteps: [...existing, activityStep].slice(0, 4),
                  };
                })
            );
          },

          // ======================================================
          // REASONING / THOUGHT
          // ======================================================

          onReasoning: (
            reasoningContent
          ) => {
            if (!reasoningContent) {
              return;
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  if (msg.id !== targetAssistantId) {
                    return msg;
                  }

                  return {
                    ...msg,
                    reasoning: (msg.reasoning || "") + reasoningContent,
                  };
                })
            );
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
                      targetAssistantId
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
          // SUGGESTIONS
          // ======================================================

          onSuggestions: (
            suggestionsList,
            messageId
          ) => {
            if (!suggestionsList || suggestionsList.length === 0) {
              return;
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  const isTarget = messageId
                    ? msg.id === messageId || msg.id === targetAssistantId
                    : msg.id === targetAssistantId;

                  if (!isTarget) {
                    return msg;
                  }

                  return {
                    ...msg,
                    suggestions: suggestionsList,
                  };
                })
            );
          },

          // ======================================================
          // LOCATION REQUIRED / LOCATION REQUEST
          // ======================================================

          onLocationRequired: (messageId, methods, locationText) => {
            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  const isTarget = messageId
                    ? msg.id === messageId || msg.id === targetAssistantId
                    : msg.id === targetAssistantId;

                  if (!isTarget) {
                    return msg;
                  }

                  return {
                    ...msg,
                    content: msg.content || locationText || msg.content,
                    locationRequired: true,
                    locationMethods: methods,
                  };
                })
            );
          },

          // ======================================================
          // LOCATION COORDINATES FROM BACKEND
          // ======================================================

          onLocationCoordinates: (coords) => {
            const targetId =
              backendConversationId ??
              conversation.id;

            onUpdateConversation(
              targetId,
              (messages) =>
                messages.map((msg) => {
                  if (msg.id !== targetAssistantId) {
                    return msg;
                  }
                  return {
                    ...msg,
                    locationCoordinates: coords,
                  };
                })
            );
          },

          // ======================================================
          // DONE
          // ======================================================

          onDone: (
            answer,
            conversationId,
            serverTitle,
            finalReasoning,
            finalSources
          ) => {
            if (
              conversationId
            ) {
              backendConversationId =
                conversationId;
              conversation.id =
                conversationId;

              if (isAuthenticated) {
                onReplaceConversationId?.(
                  originalTempId,
                  conversationId,
                  serverTitle || conversation.title || instantTitle
                );
                migrateAttachmentMetadata(
                  originalTempId,
                  conversationId
                );
              }
            }

            const targetId =
              backendConversationId ??
              conversation.id;

            if (
              serverTitle &&
              serverTitle !== "New Chat" &&
              serverTitle !== "Chat"
            ) {
              onUpdateConversationTitle?.(
                targetId,
                serverTitle
              );
            }

            // Automatic background title sync from server (no refresh needed)
            if (
              isAuthenticated &&
              targetId &&
              !targetId.startsWith("temp-") &&
              !targetId.startsWith("guest-")
            ) {
              const syncTargetId = targetId;
              setTimeout(async () => {
                try {
                  const res = await apiRequest<any>(
                    `/conversation/${encodeURIComponent(syncTargetId)}`,
                    { method: "GET" }
                  );
                  const d = res?.data || res;
                  const sTitle = d?.title?.trim();
                  if (
                    sTitle &&
                    sTitle !== "New Chat" &&
                    sTitle !== "Chat"
                  ) {
                    onUpdateConversationTitle?.(syncTargetId, sTitle);
                  }
                } catch {
                  // Non-blocking
                }
              }, 1200);
            }

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
                      targetAssistantId
                    ) {
                      return msg;
                    }

                    const effectiveSources =
                      finalSources && finalSources.length > 0
                        ? finalSources
                        : msg.sources && msg.sources.length > 0
                          ? msg.sources
                          : undefined;

                    return {
                      ...msg,

                      content:
                        answer || msg.content,

                      reasoning:
                        finalReasoning || msg.reasoning,

                      sources: effectiveSources,
                    };
                  }
                )
            );

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
                      targetAssistantId
                    ) {
                      return msg;
                    }

                    return {
                      ...msg,
                      isError: true,
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
        // ========================================================

        selectedDocumentId,

        // ========================================================
        // FILE NAME
        // ========================================================

        selectedDocumentName,

        // ========================================================
        // COORDINATES & LOCATION
        // ========================================================

        effectiveCoordinates?.latitude,
        effectiveCoordinates?.longitude,
        effectiveCoordinates?.altitude,
        effectiveCoordinates?.address
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
                targetAssistantId
              ) {
                return msg;
              }

              return {
                ...msg,
                isError: true,
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

      onSubmit={(msg, coords) => handleSubmit(msg, coords)}

      isStreaming={
        isStreaming
      }

      isAuthenticated={
        isAuthenticated
      }

      attachedLocation={inputLocation}

      onOpenLocationPicker={() => {
        setPendingLocationMsgId(null);
        setPendingLocationPrompt("");
        setIsLocationPickerOpen(true);
      }}

      onRemoveLocation={() => {
        clearStoredUserLocation();
        setInputLocation(null);
      }}

      isLocating={isAcquiringLocation}
    />
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-row overflow-hidden bg-[#f7f7f8] text-zinc-900">
      {/* ==========================================================
          LEFT / CENTER: MAIN CHAT COLUMN
          ========================================================== */}
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f7f8] text-zinc-900">
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
                {isLoadingHistory ? (
                  /* ======================================================
                     SKELETON LOADING STATE (Smooth Transition)
                     ====================================================== */
                  <div className="space-y-6 animate-pulse py-4">
                    {/* User Skeleton Bubble */}
                    <div className="flex justify-end items-end gap-2.5">
                      <div className="space-y-2 max-w-[65%] w-full flex flex-col items-end">
                        <div className="h-10 w-44 rounded-2xl rounded-br-xs bg-[#56C5D9]/20" />
                      </div>
                      <div className="h-7.5 w-7.5 shrink-0 rounded-xl bg-gradient-to-tr from-[#56C5D9]/40 to-[#2ba8be]/40" />
                    </div>

                    {/* AI Skeleton Bubble */}
                    <div className="flex justify-start items-start gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-zinc-200" />
                      <div className="space-y-2.5 flex-1 max-w-[85%] pt-1">
                        <div className="h-4 w-11/12 rounded-md bg-zinc-200/90" />
                        <div className="h-4 w-4/5 rounded-md bg-zinc-200/80" />
                        <div className="h-4 w-3/5 rounded-md bg-zinc-200/60" />
                      </div>
                    </div>

                    {/* Second User Skeleton Bubble */}
                    <div className="flex justify-end items-end gap-2.5 pt-2">
                      <div className="space-y-2 max-w-[65%] w-full flex flex-col items-end">
                        <div className="h-9 w-60 rounded-2xl rounded-br-xs bg-[#56C5D9]/20" />
                      </div>
                      <div className="h-7.5 w-7.5 shrink-0 rounded-xl bg-gradient-to-tr from-[#56C5D9]/40 to-[#2ba8be]/40" />
                    </div>

                    {/* Second AI Skeleton Bubble */}
                    <div className="flex justify-start items-start gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-zinc-200" />
                      <div className="space-y-2.5 flex-1 max-w-[85%] pt-1">
                        <div className="h-4 w-full rounded-md bg-zinc-200/90" />
                        <div className="h-4 w-5/6 rounded-md bg-zinc-200/70" />
                      </div>
                    </div>
                  </div>
                ) : (
                  activeConversation.messages.map((message: any, msgIdx: number) => {
                    const isUserMessage =
                      message.role === "user" ||
                      message.role === "human" ||
                      String(message.role || "").toLowerCase() === "user" ||
                      Boolean(message.attachment && !message.isAssistant);

                    const msgKey = message.id ? `${message.id}-${msgIdx}` : `msg-${msgIdx}`;

                    const prevUserMsg = activeConversation.messages
                      .slice(0, msgIdx)
                      .reverse()
                      .find((m: any) => m.role === "user" || m.role === "human");
                    const userPrompt = prevUserMsg?.content;

                    return isUserMessage ? (
                      /* ====================================================
                         USER MESSAGE (Right Aligned, Dark Bubble + Avatar)
                         ==================================================== */
                      <div
                        key={msgKey}
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
                                {message.locationCoordinates && (message.locationCoordinates.address || message.locationCoordinates.latitude) && (
                                  <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-[#0e879c] border-t border-[#56C5D9]/20 pt-1.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2ba8be]" />
                                    <span className="truncate max-w-[240px] sm:max-w-[320px]">
                                      {message.locationCoordinates.address ||
                                        `${message.locationCoordinates.latitude.toFixed(4)}, ${message.locationCoordinates.longitude.toFixed(4)}`}
                                    </span>
                                  </div>
                                )}
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
                        key={msgKey}
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
                            <ReasoningAccordion
                              reasoning={message.reasoning}
                              sources={message.sources || []}
                              reasoningSteps={message.reasoningSteps}
                              isStreaming={Boolean(isStreaming && msgIdx === activeConversation.messages.length - 1)}
                              hasAnswer={Boolean(message.content && message.content.trim().length > 0)}
                              durationSeconds={message.reasoningDurationSeconds}
                              onSourceClick={(source) => {
                                setPreviewPdf({
                                  isOpen: true,
                                  filename: cleanDisplayName(
                                    source.filename || "document.pdf",
                                    "document.pdf"
                                  ),
                                  documentId: source.documentId || null,
                                  file: null,
                                  url: source.url || null,
                                });
                              }}
                            />
                            <MarkdownMessage
                              content={message.content}
                              isStreaming={Boolean(
                                isStreaming &&
                                msgIdx === activeConversation.messages.length - 1 &&
                                !message.content
                              )}
                            />

                            {/* ====================================================
                            LOCATION ACTIONS (Get current location & Drop your location)
                            ==================================================== */}
                            {(() => {
                              // 1. DO NOT show while still streaming or if answer has not yet been generated by the agent
                              if (isStreaming && msgIdx === activeConversation.messages.length - 1) {
                                return null;
                              }
                              if (!message.content || !message.content.trim()) {
                                return null;
                              }

                              // 2. Only show on the latest/current assistant message in the conversation (hide on previous turns)
                              const lastAssistantIdx = activeConversation.messages
                                .map((m: any) => m.role)
                                .lastIndexOf("assistant");
                              const isCurrentAssistant =
                                msgIdx === lastAssistantIdx ||
                                msgIdx === activeConversation.messages.length - 1;

                              if (!isCurrentAssistant) return null;

                              const precedingUserMsg = activeConversation.messages
                                .slice(0, msgIdx)
                                .reverse()
                                .find(
                                  (m: any) =>
                                    m.role === "user" ||
                                    (m.role as string) === "human" ||
                                    String(m.role || "").toLowerCase() === "user"
                                );
                              const userPrompt = precedingUserMsg?.content || "Nearby search";

                              const isLocationPrompt = isLocationPromptRequired(
                                message,
                                precedingUserMsg?.content
                              );

                              if (!isLocationPrompt) return null;

                              return (
                                <div className="mt-4 flex flex-col gap-2.5 pt-1">
                                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-600">
                                    <MapPin className="h-3.5 w-3.5 text-[#2ba8be]" />
                                    <span>Please share or select your location for nearby results</span>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                                    {/* 1. Get current location from browser */}
                                    <button
                                      type="button"
                                      disabled={isStreaming || isAcquiringLocation}
                                      onClick={() =>
                                        handleCurrentLocation(
                                          userPrompt || "Nearby search"
                                        )
                                      }
                                      className="group flex items-center justify-between gap-2.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 transition-all duration-150 hover:border-[#56C5D9]/70 hover:bg-[#eef9fb]/80 hover:text-zinc-900 hover:shadow-2xs active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                    >
                                      <span className="flex items-center gap-2">
                                        {isAcquiringLocation ? (
                                          <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
                                        ) : (
                                          <LocateFixed className="h-4 w-4 text-[#2ba8be]" />
                                        )}
                                        <span className="font-medium">
                                          {isAcquiringLocation
                                            ? "Accessing browser location..."
                                            : "Get my current location"}
                                        </span>
                                      </span>
                                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-[#2ba8be]" />
                                    </button>

                                    {/* 2. Drop your location (Map Pin Picker) */}
                                    <button
                                      type="button"
                                      disabled={isStreaming || isAcquiringLocation}
                                      onClick={() =>
                                        handleDropLocationClick(
                                          userPrompt || "Nearby search"
                                        )
                                      }
                                      className="group flex items-center justify-between gap-2.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 transition-all duration-150 hover:border-[#56C5D9]/70 hover:bg-[#eef9fb]/80 hover:text-zinc-900 hover:shadow-2xs active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                    >
                                      <span className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-[#2ba8be]" />
                                        <span className="font-medium">Drop your location</span>
                                      </span>
                                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-[#2ba8be]" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ====================================================
                            OPEN THE MAP OPTION (When location query & coordinates are available AND answer has been generated)
                            ==================================================== */}
                            {(() => {
                              // 1. DO NOT show while still streaming or if answer has not yet been generated by the agent
                              if (isStreaming && msgIdx === activeConversation.messages.length - 1) {
                                return null;
                              }
                              if (!message.content || !message.content.trim()) {
                                return null;
                              }

                              const precedingUserMsg = activeConversation.messages
                                .slice(0, msgIdx)
                                .reverse()
                                .find(
                                  (m: any) =>
                                    m.role === "user" ||
                                    (m.role as string) === "human" ||
                                    String(m.role || "").toLowerCase() === "user"
                                );
                              const isLocationPrompt = isLocationPromptRequired(
                                message,
                                precedingUserMsg?.content
                              );

                              // 2. If the message is currently asking for location, do not show Open the map yet
                              if (isLocationPrompt) return null;

                              // 3. Strictly require destination/location coordinates returned from the backend on the assistant message
                              const loc = message.locationCoordinates;

                              if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
                                return null;
                              }

                              return (
                                <div className="mt-3 flex items-center gap-2 pt-0.5 animate-in fade-in duration-200">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSideMap(loc)}
                                    className="group inline-flex items-center gap-2 rounded-xl border border-[#56C5D9]/45 bg-[#eef9fb]/80 px-3.5 py-2 text-xs font-semibold text-[#0e879c] transition-all duration-150 hover:bg-[#56C5D9]/20 hover:border-[#56C5D9] hover:shadow-2xs active:scale-[0.98] cursor-pointer"
                                  >
                                    <Compass className="h-4 w-4 text-[#2ba8be]" />
                                    <span>Open the map</span>
                                    {loc.address && (
                                      <span className="max-w-[150px] sm:max-w-[210px] truncate text-[11px] font-normal text-zinc-500 border-l border-[#56C5D9]/30 pl-2">
                                        {loc.address}
                                      </span>
                                    )}
                                    <ArrowRight className="h-3.5 w-3.5 text-[#0e879c] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                                  </button>
                                </div>
                              );
                            })()}

                            {/* ====================================================
                            FOLLOW-UP SUGGESTIONS (Only shown on current/latest assistant message)
                            ==================================================== */}
                            {message.suggestions && message.suggestions.length > 0 && (() => {
                              const lastAssistantIdx = activeConversation.messages
                                .map((m: any) => m.role)
                                .lastIndexOf("assistant");
                              const isCurrentAssistant = msgIdx === lastAssistantIdx || msgIdx === activeConversation.messages.length - 1;

                              // Default hide old suggestions when user sends a new query
                              if (!isCurrentAssistant) return null;

                              return (
                                <div className="mt-4 flex flex-col gap-2 pt-1 animate-in fade-in duration-200">
                                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-500">
                                    <Sparkles className="h-3.5 w-3.5 text-[#2ba8be]" />
                                    <span>Suggested follow-ups</span>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                                    {(message.suggestions as string[]).slice(0, 3).map((suggestion: string, sIdx: number) => {
                                      if (!suggestion || typeof suggestion !== "string" || !suggestion.trim()) {
                                        return null;
                                      }

                                      const cleanSuggestion = suggestion.trim();

                                      return (
                                        <button
                                          key={`sug-${message.id}-${sIdx}`}
                                          type="button"
                                          disabled={isStreaming}
                                          onClick={() => {
                                            if (isStreaming) return;
                                            handleSubmit(cleanSuggestion);
                                          }}
                                          className="group flex items-center justify-between gap-2.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2 text-left text-xs font-medium text-zinc-700 transition-all duration-150 hover:border-[#56C5D9]/70 hover:bg-[#eef9fb]/80 hover:text-zinc-900 hover:shadow-2xs active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                        >
                                          <span className="leading-snug break-words">{cleanSuggestion}</span>
                                          <ArrowRight className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-[#2ba8be]" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  }))}
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
      </main>

      {/* ==========================================================
          RIGHT-SIDE MAP PANEL (Desktop Docked Split View - No Overlap)
          ========================================================== */}
      {isMapSidePanelOpen && (
        <aside className="hidden md:flex w-[380px] lg:w-[440px] xl:w-[490px] shrink-0 h-full border-l border-zinc-200/90 bg-white flex-col transition-all duration-200 animate-in slide-in-from-right">
          <MapSidePanel
            isOpen={isMapSidePanelOpen}
            onClose={() => setIsMapSidePanelOpen(false)}
            location={sidePanelLocation || inputLocation || getStoredUserLocation()}
            onUpdateLocation={(coords) => {
              setInputLocation(coords);
              saveStoredUserLocation(coords);
            }}
          />
        </aside>
      )}

      {/* ==========================================================
          MOBILE MAP DRAWER (Slide-up modal for small screens)
          ========================================================== */}
      {isMapSidePanelOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/50 backdrop-blur-2xs animate-in fade-in duration-200"
          onClick={() => setIsMapSidePanelOpen(false)}
        >
          <div
            className="relative w-full h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            <MapSidePanel
              isOpen={isMapSidePanelOpen}
              onClose={() => setIsMapSidePanelOpen(false)}
              location={sidePanelLocation || inputLocation || getStoredUserLocation()}
              onUpdateLocation={(coords) => {
                setInputLocation(coords);
                saveStoredUserLocation(coords);
              }}
            />
          </div>
        </div>
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

      {/* ==========================================================
          LOCATION PICKER MODAL (GOOGLE PLACES)
          ========================================================== */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSelectLocation={handleSelectLocationCoordinates}
      />

      {/* ==========================================================
          LOCATION PERMISSION GUIDE MODAL
          ========================================================== */}
      <LocationPermissionGuideModal
        isOpen={isPermissionGuideOpen}
        onClose={() => setIsPermissionGuideOpen(false)}
        errorMessage={locationError}
        onSelectLocation={(coords) => {
          setIsPermissionGuideOpen(false);
          const locationPayload = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            altitude: coords.altitude ?? null,
            address:
              coords.address ||
              `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
            full_address:
              coords.address ||
              `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          };

          let targetPrompt = pendingLocationPrompt;

          if (!targetPrompt && activeConversation?.messages && activeConversation.messages.length > 0) {
            const precedingUser = [...activeConversation.messages].reverse().find(
              (m: any) => m.role === "user" || m.role === "human"
            );
            targetPrompt = precedingUser?.content || "Nearby search";
          }

          setPendingLocationMsgId(null);
          setPendingLocationPrompt("");
          setInputLocation(null);

          handleSubmit(
            targetPrompt || "Nearby search",
            locationPayload
          );
        }}
        onOpenMapPicker={() => {
          setIsPermissionGuideOpen(false);
          setIsLocationPickerOpen(true);
        }}
      />
    </div>
  );
}