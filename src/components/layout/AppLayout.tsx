"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Menu,
  Plus,
  X,
  Trash2,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import MainContent from "@/components/chat/MainContent";

import { Conversation } from "@/types/chat";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ================================================================
// Backend Types
// ================================================================

interface BackendConversation {
  id?: string;
  conversation_id?: string;
  title?: string | null;
  document_id?: string | null;
  document_ids?: string[] | null;
  filename?: string | null;
  file_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ConversationsResponse {
  success?: boolean;
  status_code?: number;
  message?: string;
  conversations?: BackendConversation[];
  data?: unknown;
  error_code?: string | null;
}

interface BackendMessage {
  id?: string;
  message_id?: string;

  role:
    | "user"
    | "assistant";

  content?: string;
  text_content?: string;
  document_id?: string | null;
  documentId?: string | null;
  filename?: string | null;
  file_name?: string | null;
  attachment?: any;
  metadata?: any;
  created_at?: string;
}

interface ConversationDetailResponse {
  success?: boolean;
  status_code?: number;
  message?: string;
  conversation_id?: string;
  messages?: BackendMessage[];
  data?: unknown;
  error_code?: string | null;
}

// ================================================================
// Helpers
// ================================================================

function extractConversations(
  response: ConversationsResponse
): BackendConversation[] {
  if (
    Array.isArray(
      response?.conversations
    )
  ) {
    return response.conversations;
  }

  const data =
    response?.data;

  if (Array.isArray(data)) {
    return data as BackendConversation[];
  }

  if (
    data &&
    typeof data === "object"
  ) {
    const objectData =
      data as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        objectData.conversations
      )
    ) {
      return objectData.conversations as BackendConversation[];
    }

    if (
      Array.isArray(
        objectData.items
      )
    ) {
      return objectData.items as BackendConversation[];
    }

    if (
      Array.isArray(
        objectData.data
      )
    ) {
      return objectData.data as BackendConversation[];
    }
  }

  return [];
}

// ================================================================
// Conversation ID
// ================================================================

function getConversationId(
  conversation: BackendConversation
): string | null {
  const id =
    conversation.id ??
    conversation.conversation_id;

  if (
    typeof id !== "string"
  ) {
    return null;
  }

  const cleanId =
    id.trim();

  if (!cleanId) {
    return null;
  }

  return cleanId;
}

// ================================================================
// Extract Messages
// ================================================================

function extractMessages(
  response: ConversationDetailResponse
): BackendMessage[] {
  if (
    Array.isArray(
      response?.messages
    )
  ) {
    return response.messages;
  }

  const data =
    response?.data;

  if (Array.isArray(data)) {
    return data as BackendMessage[];
  }

  if (
    data &&
    typeof data === "object"
  ) {
    const objectData =
      data as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        objectData.messages
      )
    ) {
      return objectData.messages as BackendMessage[];
    }

    if (
      Array.isArray(
        objectData.items
      )
    ) {
      return objectData.items as BackendMessage[];
    }

    if (
      objectData.data &&
      typeof objectData.data ===
        "object"
    ) {
      const nestedData =
        objectData.data as Record<
          string,
          unknown
        >;

      if (
        Array.isArray(
          nestedData.messages
        )
      ) {
        return nestedData.messages as BackendMessage[];
      }
    }
  }

  return [];
}

// ================================================================
// Message ID
// ================================================================

function getMessageId(
  message: BackendMessage
): string {
  return (
    message.id ??
    message.message_id ??
    crypto.randomUUID()
  );
}

// ================================================================
// Message Content
// ================================================================

function getMessageContent(
  message: BackendMessage
): string {
  return (
    message.content ??
    message.text_content ??
    ""
  );
}

// ================================================================
// API Error Status
// ================================================================

function getErrorStatus(
  error: unknown
): number | undefined {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return undefined;
  }

  const value =
    error as Record<
      string,
      unknown
    >;

  if (
    typeof value.statusCode ===
    "number"
  ) {
    return value.statusCode;
  }

  if (
    typeof value.status ===
    "number"
  ) {
    return value.status;
  }

  return undefined;
}

// ================================================================
// Props
// ================================================================

interface AppLayoutProps {
  children?: React.ReactNode;
}

// ================================================================
// Authentication Loading
// ================================================================

function AuthLoadingScreen() {
  return (
    <div
      className="
        flex
        h-screen
        w-full
        items-center
        justify-center
        bg-[#f7f7f8]
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
          text-sm
          font-medium
          text-zinc-500
        "
      >
        <div
          className="
            h-4
            w-4
            animate-spin
            rounded-full
            border-2
            border-zinc-300
            border-t-zinc-900
          "
        />

        <span>
          Loading...
        </span>
      </div>
    </div>
  );
}

// ================================================================
// Delete Confirmation Modal
// ================================================================

interface DeleteConversationModalProps {
  open: boolean;

  conversationTitle: string;

  deleting: boolean;

  onCancel: () => void;

  onConfirm: () => void;
}

function DeleteConversationModal({
  open,
  conversationTitle,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConversationModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        bg-black/30
        px-4
        backdrop-blur-sm
      "
      onClick={() => {
        if (!deleting) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <div
        className="
          w-full
          max-w-sm
          rounded-2xl
          border
          border-zinc-200
          bg-white
          p-6
          shadow-2xl
        "
        onClick={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-conversation-title"
      >
        {/* ======================================================
            Header
            ====================================================== */}

        <div
          className="
            flex
            items-start
            justify-between
            gap-4
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-red-50
              text-red-600
            "
          >
            <Trash2
              className="
                h-5
                w-5
              "
            />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              text-zinc-400
              transition
              hover:bg-zinc-100
              hover:text-zinc-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <X
              className="
                h-4
                w-4
              "
            />
          </button>
        </div>

        {/* ======================================================
            Content
            ====================================================== */}

        <div className="mt-4">
          <h2
            id="delete-conversation-title"
            className="
              text-lg
              font-semibold
              text-zinc-900
            "
          >
            Delete conversation?
          </h2>

          <p
            className="
              mt-2
              text-sm
              leading-6
              text-zinc-500
            "
          >
            Are you sure you want to
            delete{" "}
            <span
              className="
                font-medium
                text-zinc-700
              "
            >
              "{conversationTitle}"
            </span>
            ?
          </p>

          <p
            className="
              mt-1
              text-sm
              leading-6
              text-zinc-500
            "
          >
            This conversation will be
            permanently deleted.
          </p>
        </div>

        {/* ======================================================
            Actions
            ====================================================== */}

        <div
          className="
            mt-6
            flex
            justify-end
            gap-3
          "
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="
              rounded-lg
              border
              border-zinc-200
              px-4
              py-2
              text-sm
              font-medium
              text-zinc-700
              transition
              hover:bg-zinc-50
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="
              flex
              min-w-[90px]
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-red-600
              px-4
              py-2
              text-sm
              font-medium
              text-white
              transition
              hover:bg-red-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {deleting ? (
              <>
                <span
                  className="
                    h-4
                    w-4
                    animate-spin
                    rounded-full
                    border-2
                    border-white/40
                    border-t-white
                  "
                />

                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Authenticated Application
// ================================================================

function AppLayoutContent({
  children,
}: AppLayoutProps) {
  const {
    isAuthenticated,
  } = useAuth();

  // ==============================================================
  // State
  // ==============================================================

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>(
    []
  );

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(
    null
  );

  /*
   * Conversation selected for
   * delete confirmation.
   */

  const [
    deleteTargetId,
    setDeleteTargetId,
  ] = useState<string | null>(
    null
  );

  /*
   * Conversation currently being
   * deleted through API.
   */

  const [
    deletingConversationId,
    setDeletingConversationId,
  ] = useState<string | null>(
    null
  );

  // ==============================================================
  // LOAD CONVERSATIONS
  // ==============================================================

  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      setActiveConversationId(
        null
      );

      return;
    }

    let cancelled = false;

    const loadConversations =
      async () => {
        try {
          const response =
            await apiRequest<ConversationsResponse>(
              "/conversation",
              {
                method: "GET",
              }
            );

          if (cancelled) {
            return;
          }

          const backendConversations =
            extractConversations(
              response
            );

          const validConversations:
            Conversation[] = [];

          const usedIds =
            new Set<string>();

          for (
            const backendConversation of backendConversations
          ) {
            const id =
              getConversationId(
                backendConversation
              );

            if (!id) {
              console.warn(
                "Skipping conversation without ID:",
                backendConversation
              );

              continue;
            }

            if (
              usedIds.has(id)
            ) {
              continue;
            }

            usedIds.add(id);

            const docId =
              backendConversation.document_id ||
              (Array.isArray(backendConversation.document_ids)
                ? backendConversation.document_ids[0]
                : null) ||
              null;

            const docName =
              backendConversation.filename ||
              backendConversation.file_name ||
              null;

            validConversations.push(
              {
                id,

                title:
                  backendConversation.title?.trim() ||
                  "New Chat",

                document_id:
                  docId,

                document_name:
                  docName,

                messages: [],
              }
            );
          }

          setConversations(
            validConversations
          );

          setActiveConversationId(
            null
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          const status =
            getErrorStatus(
              error
            );

          if (
            status === 404
          ) {
            setConversations([]);
            setActiveConversationId(
              null
            );

            return;
          }

          console.error(
            "Failed to load conversations:",
            error
          );

          setConversations([]);
        }
      };

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
  ]);

  // ==============================================================
  // CREATE NEW CHAT
  // ==============================================================

  const createNewChat =
    (): string => {
      if (
        activeConversationId
      ) {
        const activeConversation =
          conversations.find(
            (
              conversation
            ) =>
              conversation.id ===
              activeConversationId
          );

        if (
          activeConversation &&
          activeConversation.messages
            .length === 0 &&
          activeConversation.title ===
            "New Chat"
        ) {
          setMobileSidebarOpen(
            false
          );

          return activeConversation.id;
        }
      }

      const newConversation:
        Conversation = {
        id:
          crypto.randomUUID(),

        title:
          "New Chat",

        messages: [],
      };

      setConversations(
        (previous) => [
          newConversation,
          ...previous,
        ]
      );

      setActiveConversationId(
        newConversation.id
      );

      setMobileSidebarOpen(
        false
      );

      return newConversation.id;
    };

  // ==============================================================
  // UPDATE CONVERSATION
  // ==============================================================

  const updateConversation = (
    conversationId: string,
    updater:
      | Conversation["messages"]
      | ((
          messages:
            Conversation["messages"]
        ) =>
          Conversation["messages"])
  ) => {
    if (
      typeof conversationId !==
        "string" ||
      !conversationId.trim()
    ) {
      return;
    }

    setConversations(
      (previous) =>
        previous.map(
          (
            conversation
          ) => {
            if (
              conversation.id !==
              conversationId
            ) {
              return conversation;
            }

            const messages =
              typeof updater ===
              "function"
                ? updater(
                    conversation.messages
                  )
                : updater;

            return {
              ...conversation,
              messages,
            };
          }
        )
    );
  };

  // ==============================================================
  // LOAD CONVERSATION HISTORY
  // ==============================================================

  const loadConversationHistory =
    async (
      conversationId:
        | string
        | null
        | undefined
    ) => {
      if (
        typeof conversationId !==
          "string" ||
        !conversationId.trim()
      ) {
        console.warn(
          "Invalid conversation ID:",
          conversationId
        );

        return;
      }

      const cleanConversationId =
        conversationId.trim();

      if (!isAuthenticated) {
        return;
      }

      const conversation =
        conversations.find(
          (
            item
          ) =>
            item.id ===
            cleanConversationId
        );

      if (!conversation) {
        console.warn(
          "Conversation not found:",
          cleanConversationId
        );

        return;
      }

      if (
        conversation.messages
          .length > 0
      ) {
        return;
      }

      if (
        conversation.title ===
        "New Chat"
      ) {
        return;
      }

      try {
        const response =
          await apiRequest<ConversationDetailResponse>(
            `/conversation/${encodeURIComponent(
              cleanConversationId
            )}`,
            {
              method: "GET",
            }
          );

        const backendMessages =
          extractMessages(
            response
          );

        const responseData =
          (response as any)?.data ||
          response;

        const convDocId =
          responseData?.document_id ||
          responseData?.documentId ||
          (Array.isArray(responseData?.document_ids)
            ? responseData.document_ids[0]
            : null) ||
          conversation.document_id ||
          null;

        const convDocName =
          responseData?.filename ||
          responseData?.file_name ||
          responseData?.document_name ||
          conversation.document_name ||
          null;

        const messages:
          Conversation["messages"] =
          backendMessages.map(
            (
              message: any
            ) => {
              const docId =
                message.document_id ||
                message.documentId ||
                message.metadata?.document_id ||
                message.attachment?.documentId ||
                convDocId ||
                null;

              const docName =
                message.filename ||
                message.file_name ||
                message.metadata?.filename ||
                message.metadata?.file_name ||
                message.attachment?.filename ||
                convDocName ||
                (docId ? "document.pdf" : null);

              return {
                id:
                  getMessageId(
                    message
                  ),

                role:
                  message.role,

                content:
                  getMessageContent(
                    message
                  ),

                attachment: docId
                  ? {
                      type: "pdf",
                      documentId:
                        String(docId).trim(),
                      filename:
                        String(
                          docName ||
                            "document.pdf"
                        ).trim(),
                    }
                  : undefined,
              };
            }
          );

        setConversations(
          (previous) =>
            previous.map(
              (item) => {
                if (
                  item.id !==
                  cleanConversationId
                ) {
                  return item;
                }

                return {
                  ...item,
                  document_id:
                    convDocId,
                  document_name:
                    convDocName,
                  messages,
                };
              }
            )
        );
      } catch (error) {
        const status =
          getErrorStatus(
            error
          );

        if (
          status === 404
        ) {
          setConversations(
            (previous) =>
              previous.filter(
                (
                  item
                ) =>
                  item.id !==
                  cleanConversationId
              )
          );

          setActiveConversationId(
            (currentId) =>
              currentId ===
              cleanConversationId
                ? null
                : currentId
          );

          return;
        }

        console.error(
          "Failed to load conversation history:",
          error
        );
      }
    };

  // ==============================================================
  // SELECT CONVERSATION
  // ==============================================================

  const selectConversation =
    async (
      conversationId:
        | string
        | null
        | undefined
    ) => {
      if (
        typeof conversationId !==
          "string" ||
        !conversationId.trim()
      ) {
        console.warn(
          "Invalid conversation selected:",
          conversationId
        );

        return;
      }

      const cleanConversationId =
        conversationId.trim();

      setActiveConversationId(
        cleanConversationId
      );

      setMobileSidebarOpen(
        false
      );

      await loadConversationHistory(
        cleanConversationId
      );
    };

  // ==============================================================
  // REQUEST DELETE
  //
  // This DOES NOT call the API.
  //
  // It only opens our custom modal.
  // ==============================================================

  const requestDeleteConversation =
    (
      conversationId:
        | string
        | null
        | undefined
    ) => {
      if (
        typeof conversationId !==
          "string" ||
        !conversationId.trim()
      ) {
        console.warn(
          "Invalid conversation ID for deletion:",
          conversationId
        );

        return;
      }

      const cleanConversationId =
        conversationId.trim();

      /*
       * Don't open another delete
       * modal while one is being
       * processed.
       */

      if (
        deletingConversationId
      ) {
        return;
      }

      setDeleteTargetId(
        cleanConversationId
      );
    };

  // ==============================================================
  // CANCEL DELETE
  // ==============================================================

  const cancelDeleteConversation =
    () => {
      /*
       * Don't close the modal while
       * DELETE API is running.
       */

      if (
        deletingConversationId
      ) {
        return;
      }

      setDeleteTargetId(null);
    };

  // ==============================================================
  // CONFIRM DELETE
  //
  // This is where DELETE API is called.
  // ==============================================================

  const confirmDeleteConversation =
    async () => {
      if (!deleteTargetId) {
        return;
      }

      const conversationId =
        deleteTargetId;

      /*
       * Prevent duplicate requests.
       */

      if (
        deletingConversationId
      ) {
        return;
      }

      // ------------------------------------------------------------
      // New / unpersisted conversation
      // ------------------------------------------------------------

      const targetConv =
        conversations.find(
          (c) =>
            c.id ===
            conversationId
        );

      if (
        conversationId.startsWith(
          "temp-"
        ) ||
        (targetConv &&
          targetConv.title ===
            "New Chat" &&
          targetConv.messages
            .length === 0)
      ) {
        setConversations(
          (previous) =>
            previous.filter(
              (
                conversation
              ) =>
                conversation.id !==
                conversationId
            )
        );

        if (
          activeConversationId ===
          conversationId
        ) {
          setActiveConversationId(
            null
          );
        }

        setDeleteTargetId(null);

        return;
      }

      // ------------------------------------------------------------
      // Start API deletion
      // ------------------------------------------------------------

      setDeletingConversationId(
        conversationId
      );

      try {
        /*
         * Backend API:
         *
         * DELETE
         * /conversation/{conversation_id}
         */

        await apiRequest(
          `/conversation/${encodeURIComponent(
            conversationId
          )}`,
          {
            method: "DELETE",
          }
        );

        // ----------------------------------------------------------
        // Backend success
        // ----------------------------------------------------------

        setConversations(
          (previous) =>
            previous.filter(
              (
                conversation
              ) =>
                conversation.id !==
                conversationId
            )
        );

        // ----------------------------------------------------------
        // Clear active conversation
        // ----------------------------------------------------------

        if (
          activeConversationId ===
          conversationId
        ) {
          setActiveConversationId(
            null
          );
        }

        // ----------------------------------------------------------
        // Close modal
        // ----------------------------------------------------------

        setDeleteTargetId(null);

        setMobileSidebarOpen(
          false
        );

        console.log(
          "Conversation deleted successfully:",
          conversationId
        );
      } catch (error) {
        const status =
          getErrorStatus(
            error
          );

        /*
         * If backend says 404, the conversation
         * is already gone.
         *
         * Remove it locally.
         */

        if (
          status === 404
        ) {
          setConversations(
            (previous) =>
              previous.filter(
                (
                  conversation
                ) =>
                  conversation.id !==
                  conversationId
              )
          );

          if (
            activeConversationId ===
            conversationId
          ) {
            setActiveConversationId(
              null
            );
          }

          setDeleteTargetId(null);

          return;
        }

        /*
         * Other errors:
         *
         * Keep conversation in UI.
         *
         * Keep modal open so user knows
         * deletion was not completed.
         */

        console.error(
          "Failed to delete conversation:",
          error
        );
      } finally {
        setDeletingConversationId(
          null
        );
      }
    };

  // ==============================================================
  // GET DELETE TARGET TITLE
  // ==============================================================

  const deleteTargetConversation =
    deleteTargetId
      ? conversations.find(
          (
            conversation
          ) =>
            conversation.id ===
            deleteTargetId
        )
      : null;

  const deleteTargetTitle =
    deleteTargetConversation
      ?.title?.trim() ||
    "New Chat";

  // ==============================================================
  // REPLACE TEMPORARY ID
  // ==============================================================

  const replaceConversationId = (
    temporaryId: string,
    backendId: string
  ) => {
    if (
      !temporaryId ||
      !backendId
    ) {
      return;
    }

    setConversations(
      (previous) =>
        previous.map(
          (
            conversation
          ) =>
            conversation.id ===
            temporaryId
              ? {
                  ...conversation,
                  id: backendId,
                }
              : conversation
        )
    );

    setActiveConversationId(
      (currentId) =>
        currentId ===
        temporaryId
          ? backendId
          : currentId
    );
  };

  // ==============================================================
  // UPDATE TITLE
  // ==============================================================

  const updateConversationTitle = (
    conversationId: string,
    title: string
  ) => {
    if (
      typeof conversationId !==
        "string" ||
      !conversationId.trim()
    ) {
      return;
    }

    const cleanTitle =
      title.trim();

    if (!cleanTitle) {
      return;
    }

    setConversations(
      (previous) =>
        previous.map(
          (
            conversation
          ) =>
            conversation.id ===
            conversationId
              ? {
                  ...conversation,
                  title:
                    cleanTitle,
                }
              : conversation
        )
    );
  };

  // ==============================================================
  // RENDER
  // ==============================================================

  return (
    <div
      className="
        relative
        flex
        h-screen
        overflow-hidden
        bg-[#f7f7f8]
        text-zinc-900
      "
    >
      {/* ========================================================
          SIDEBAR
          ======================================================== */}

      <Sidebar
        mobileOpen={
          mobileSidebarOpen
        }
        onMobileClose={() =>
          setMobileSidebarOpen(
            false
          )
        }
        conversations={
          conversations
        }
        activeConversationId={
          activeConversationId
        }
        onNewChat={
          createNewChat
        }
        onSelectChat={
          selectConversation
        }
        onDeleteChat={
          requestDeleteConversation
        }
        deletingConversationId={
          deletingConversationId
        }
      />

      {/* ========================================================
          MAIN AREA
          ======================================================== */}

      <div
        className="
          flex
          h-full
          min-w-0
          flex-1
          flex-col
          overflow-hidden
        "
      >
        {/* ======================================================
            MOBILE HEADER
            ====================================================== */}

        <header
          className="
            flex
            h-14
            shrink-0
            items-center
            justify-between
            border-b
            border-zinc-200
            bg-[#f7f7f8]
            px-4
            lg:hidden
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <button
              type="button"
              onClick={() =>
                setMobileSidebarOpen(
                  true
                )
              }
              aria-label="Open menu"
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                text-zinc-600
                hover:bg-zinc-200/60
                hover:text-zinc-900
              "
            >
              <Menu
                className="
                  h-5
                  w-5
                "
              />
            </button>

            <span
              className="
                text-base
                font-semibold
              "
            >
              AI Chat
            </span>
          </div>

          <button
            type="button"
            onClick={
              createNewChat
            }
            aria-label="New Chat"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              text-zinc-600
              hover:bg-zinc-200/60
              hover:text-zinc-900
            "
          >
            <Plus
              className="
                h-5
                w-5
              "
            />
          </button>
        </header>

        {/* ======================================================
            MAIN CONTENT
            ====================================================== */}

        <main
          className="
            flex
            min-h-0
            flex-1
            overflow-hidden
          "
        >
          <MainContent
            activeConversationId={
              activeConversationId
            }
            conversations={
              conversations
            }
            onNewChat={
              createNewChat
            }
            onUpdateConversation={
              updateConversation
            }
            onReplaceConversationId={
              replaceConversationId
            }
            onUpdateConversationTitle={
              updateConversationTitle
            }
          />
        </main>
      </div>

      {/* ========================================================
          CUSTOM DELETE MODAL
          ======================================================== */}

      <DeleteConversationModal
        open={
          deleteTargetId !== null
        }
        conversationTitle={
          deleteTargetTitle
        }
        deleting={
          deletingConversationId !==
          null
        }
        onCancel={
          cancelDeleteConversation
        }
        onConfirm={
          confirmDeleteConversation
        }
      />

      {children}
    </div>
  );
}

// ================================================================
// APP LAYOUT
// ================================================================

export default function AppLayout({
  children,
}: AppLayoutProps) {
  const {
    isLoading:
      authLoading,
  } = useAuth();

  if (authLoading) {
    return (
      <AuthLoadingScreen />
    );
  }

  return (
    <AppLayoutContent>
      {children}
    </AppLayoutContent>
  );
}