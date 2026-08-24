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
  Sparkles,
  User,
} from "lucide-react";

import PdfViewerModal from "@/components/common/PdfViewerModal";
import MarkdownMessage from "./MarkdownMessage";

import WelcomeScreen from "./WelcomeScreen";
import ChatInput, {
  UploadedDocument,
} from "./ChatInput";

import {
  Conversation,
} from "@/types/chat";

import {
  streamChat,
} from "@/lib/chat";

import {
  uploadDocument,
} from "@/lib/api";

import {
  getLocalizedErrorMessage,
} from "@/i18n";

import { useAuth } from "@/context/AuthContext";

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
        ) ?? null
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

        if (
          typeof doc.id !==
          "string" ||
          !doc.id.trim()
        ) {
          console.error(
            "Document selected but ID is missing:",
            doc
          );

          return;
        }

        const documentId =
          doc.id.trim();

        const filename =
          typeof doc.file_name ===
            "string"
            ? doc.file_name
            : "";

        // --------------------------------------------------------
        // Store document for current input
        // --------------------------------------------------------

        setUploadedDocument({
          file: null as any,

          documentId,

          filename,
        });

        // --------------------------------------------------------
        // IMPORTANT DEBUG
        // --------------------------------------------------------

        console.log(
          "DOCUMENT STORED FOR CHAT:",
          {
            documentId,
            filename,
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
      window.location.href =
        "/login";

      return;
    }

    setUploadedDocument({
      file,

      /*
       * Empty initially because the
       * backend has not created the
       * document yet.
       */
      documentId: "",

      filename:
        file.name,
    });

    console.log(
      "LOCAL FILE SELECTED:",
      {
        filename:
          file.name,
      }
    );
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
    // Authentication
    // ------------------------------------------------------------

    if (
      !isAuthenticated
    ) {
      window.location.href =
        "/login";

      return;
    }

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
        onNewChat();

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

        const conversationId =
          conversation.messages
            .length > 0
            ? conversation.id
            : undefined;

        const response: any =
          await uploadDocument({
            file:
              documentFile,

            conversation_id:
              conversationId,
          });

        // --------------------------------------------------------
        // Extract backend document ID
        // --------------------------------------------------------

        documentId =
          response?.data?.id ||
          response?.data?.document_id ||
          response?.document_id ||
          response?.id ||
          null;

        if (!documentId) {
          throw new Error(
            "Document uploaded, but backend did not return document ID."
          );
        }

        documentId =
          String(
            documentId
          ).trim();

        uploadConvId =
          response?.data?.conversation_id ||
          response?.conversation_id ||
          null;

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
        });

        // --------------------------------------------------------
        // Refresh document sidebar
        // --------------------------------------------------------

        window.dispatchEvent(
          new CustomEvent(
            "documents:updated"
          )
        );
      } catch (
      error
      ) {
        console.error(
          "Document upload failed:",
          error
        );

        setIsUploading(
          false
        );

        throw error;
      } finally {
        setIsUploading(
          false
        );
      }
    }

    // ============================================================
    // DOCUMENT RESOLUTION HIERARCHY
    //
    // Ensures document_id is ALWAYS sent in the chat payload
    // for all follow-up questions in a document conversation.
    // ============================================================

    const isCurrentAttachment = Boolean(
      uploadedDocument?.file ||
        (uploadedDocument?.documentId &&
          uploadedDocument.documentId.trim())
    );

    const lastAttachedDoc = [
      ...conversation.messages,
    ]
      .reverse()
      .find(
        (m) =>
          m.attachment?.documentId
      )?.attachment;

    const storedConvDocId =
      (typeof window !== "undefined"
        ? localStorage.getItem(`conversation_doc_${conversation.id}`) ||
          localStorage.getItem("active_document_id") ||
          localStorage.getItem("selected_document_id")
        : null) || null;

    const storedConvDocName =
      (typeof window !== "undefined"
        ? localStorage.getItem(`conversation_doc_name_${conversation.id}`) ||
          localStorage.getItem("active_document_name")
        : null) || null;

    const selectedDocumentId =
      (documentId && documentId.trim()) ||
      conversation.document_id?.trim() ||
      lastAttachedDoc?.documentId?.trim() ||
      storedConvDocId ||
      null;

    const selectedDocumentName =
      (filename && filename.trim()) ||
      conversation.document_name?.trim() ||
      lastAttachedDoc?.filename?.trim() ||
      storedConvDocName ||
      null;

    if (selectedDocumentId && typeof window !== "undefined") {
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
    // DEBUG
    // ============================================================

    console.log(
      "===================================="
    );

    console.log(
      "FINAL DOCUMENT FOR CHAT:"
    );

    console.log(
      "Document ID:",
      selectedDocumentId
    );

    console.log(
      "Document Name:",
      selectedDocumentName
    );

    console.log(
      "Is Direct Attachment:",
      isCurrentAttachment
    );

    console.log(
      "Question:",
      question
    );

    console.log(
      "Conversation ID:",
      conversation.id
    );

    console.log(
      "===================================="
    );

    // ============================================================
    // USER MESSAGE - Only show PDF card if attached to THIS message
    // ============================================================

    const userMessage: any = {
      id:
        crypto.randomUUID(),

      role:
        "user" as const,

      content:
        question,

      attachment:
        isCurrentAttachment &&
        (documentId || documentFile)
          ? {
              type: "pdf",

              documentId:
                documentId || "",

              filename:
                filename ||
                documentFile?.name ||
                "document.pdf",

              file:
                documentFile ||
                undefined,
            }
          : undefined,
    };

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
    // BACKEND CONVERSATION ID
    // ============================================================

    let backendConversationId:
      | string
      | null =
      uploadConvId ||
      (conversation.messages
        .length > 0 &&
      !conversation.id.startsWith("temp-") &&
      !conversation.id.startsWith("local-")
        ? conversation.id
        : null);

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
        question,

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
              {activeConversation.messages.map((message: any) =>
                message.role === "user" ? (
                  /* ====================================================
                     USER MESSAGE (Right Aligned, Dark Bubble + Avatar)
                     ==================================================== */
                  <div
                    key={message.id}
                    className="flex justify-end items-end gap-2.5 my-3"
                  >
                    <div className="flex flex-col items-end gap-1.5 max-w-[85%] sm:max-w-[75%]">
                      {/* Attached PDF Card */}
                      {message.attachment && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPdf({
                              isOpen: true,
                              filename:
                                message.attachment.filename || "document.pdf",
                              documentId:
                                message.attachment.documentId || null,
                              file: message.attachment.file || null,
                              url: message.attachment.url || null,
                            });
                          }}
                          className="group flex items-center gap-2.5 rounded-xl bg-white border border-zinc-200/90 px-3.5 py-2.5 text-left shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 transition cursor-pointer"
                          title="Click to preview PDF"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-100">
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 pr-1">
                            <span className="block truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
                              {message.attachment.filename || "Attached Document"}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <Eye className="h-3 w-3 text-zinc-400 group-hover:text-zinc-600" />
                              <span>PDF • Click to open</span>
                            </span>
                          </div>
                        </button>
                      )}

                      {message.content && (
                        <div className="rounded-2xl rounded-br-xs bg-zinc-900 text-zinc-50 px-4.5 py-3 shadow-xs">
                          <div className="whitespace-pre-wrap leading-relaxed text-zinc-100 text-[14.5px]">
                            {message.content}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 shadow-2xs mb-0.5"
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
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 text-white shadow-2xs mt-0.5"
                      title="AI Assistant"
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[13px] font-semibold text-zinc-900">
                          AI Assistant
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/80">
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
                )
              )}
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