"use client";

import {
  Loader2,
  LogIn,
  MessageSquare,
  Trash2,
} from "lucide-react";

import { Conversation } from "@/types/chat";
import { useAuth } from "@/context/AuthContext";

interface RecentChatsProps {
  collapsed: boolean;

  showText: boolean;

  conversations:
    Conversation[];

  activeConversationId:
    | string
    | null;

  onSelectChat: (
    conversationId: string
  ) => void;

  onDeleteChat: (
    conversationId: string
  ) => void;

  deletingConversationId:
    | string
    | null;
}

export default function RecentChats({
  collapsed,
  showText,
  conversations,
  activeConversationId,
  onSelectChat,
  onDeleteChat,
  deletingConversationId,
}: RecentChatsProps) {
  const { isAuthenticated } = useAuth();

  // ==============================================================
  // Don't show text while collapsed
  // ==============================================================

  if (
    collapsed &&
    !showText
  ) {
    return (
      <div className="h-full" />
    );
  }

  // ==============================================================
  // Clean conversations
  // ==============================================================

  const validConversations:
    Conversation[] = [];

  const usedIds =
    new Set<string>();

  for (
    const conversation of conversations
  ) {
    // ------------------------------------------------------------
    // Invalid conversation
    // ------------------------------------------------------------

    if (
      !conversation ||
      typeof conversation.id !==
        "string" ||
      !conversation.id.trim()
    ) {
      continue;
    }

    const id =
      conversation.id.trim();

    // ------------------------------------------------------------
    // Prevent duplicate IDs
    // ------------------------------------------------------------

    if (
      usedIds.has(id)
    ) {
      continue;
    }

    usedIds.add(id);

    validConversations.push(
      {
        ...conversation,
        id,
      }
    );
  }

  // ==============================================================
  // Render
  // ==============================================================

  return (
    <section
      className="
        flex
        h-full
        min-h-0
        flex-col
      "
    >
      {/* ========================================================
          RECENT HEADER
          ======================================================== */}

      {!collapsed && showText && (
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Recent Chats
          </p>
          {isAuthenticated && validConversations.length > 0 && (
            <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-200/70 px-1.5 py-0.2 rounded-full">
              {validConversations.length}
            </span>
          )}
        </div>
      )}

      {/* ========================================================
          CONVERSATION LIST
          ======================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {/* ======================================================
            GUEST MODE PROMPT (When unauthenticated)
            ====================================================== */}

        {!isAuthenticated ? (
          <div
            className={`mx-1 my-2 rounded-xl border border-dashed border-zinc-200 bg-white/60 p-3 text-center shadow-2xs ${
              collapsed ? "hidden" : ""
            }`}
          >
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <MessageSquare className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-800">
              Guest Mode
            </p>
            <p className="mt-1 text-[11px] text-zinc-500 leading-snug">
              Conversations are temporary and not saved. Sign in to save and access chat history.
            </p>
          </div>
        ) : validConversations.length === 0 ? (
          /* ======================================================
              AUTHENTICATED EMPTY STATE
              ====================================================== */
          <div
            className={`px-3 py-6 text-center text-xs text-zinc-400 ${
              collapsed ? "hidden" : ""
            }`}
          >
            <MessageSquare className="h-6 w-6 mx-auto text-zinc-300 mb-1.5 opacity-60" />
            No conversations yet
          </div>
        ) : (
          /* ======================================================
              CONVERSATIONS
              ====================================================== */
          validConversations.map((conversation) => {
            const conversationId = conversation.id;
            const title = conversation.title?.trim() || "New Chat";
            const isActive = activeConversationId === conversationId;
            const isDeleting = deletingConversationId === conversationId;

            return (
              <div key={conversationId} className="group relative">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (!conversationId || isDeleting) {
                      return;
                    }
                    onSelectChat(conversationId);
                  }}
                  title={collapsed ? title : undefined}
                  className={`flex w-full items-center rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-200/70 text-zinc-900 font-semibold shadow-2xs"
                      : "text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900"
                  } ${
                    isDeleting ? "opacity-40" : ""
                  }`}
                >
                  <MessageSquare
                    className={`h-4 w-4 shrink-0 mr-2.5 ${
                      isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
                    }`}
                  />

                  <span className="truncate flex-1">
                    {title}
                  </span>
                </button>

                {/* Delete Trigger */}
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(conversationId);
                  }}
                  aria-label="Delete chat"
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-300/60 hover:text-red-600 transition-all ${
                    isActive ? "opacity-80" : ""
                  }`}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}