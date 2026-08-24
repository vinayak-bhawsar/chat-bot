"use client";

import {
  Loader2,
  MessageSquare,
  Trash2,
} from "lucide-react";

import { Conversation } from "@/types/chat";

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
          {validConversations.length > 0 && (
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
            EMPTY STATE
            ====================================================== */}

        {validConversations.length === 0 && (
          <div
            className={`px-3 py-6 text-center text-xs text-zinc-400 ${
              collapsed ? "hidden" : ""
            }`}
          >
            <MessageSquare className="h-6 w-6 mx-auto text-zinc-300 mb-1.5 opacity-60" />
            No conversations yet
          </div>
        )}

        {/* ======================================================
            CONVERSATIONS
            ====================================================== */}

        {validConversations.map((conversation) => {
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
                    ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200/90 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                } ${collapsed ? "justify-center px-2" : "gap-2.5"} ${
                  isDeleting ? "cursor-wait opacity-60" : ""
                }`}
              >
                {/* ICON */}
                <MessageSquare
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive
                      ? "text-indigo-600"
                      : "text-zinc-400 group-hover:text-zinc-600"
                  }`}
                />

                {/* TITLE */}
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                )}

                {/* DELETE ACTION */}
                {!collapsed && (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!conversationId || isDeleting) {
                        return;
                      }
                      onDeleteChat(conversationId);
                    }}
                    role="button"
                    tabIndex={isDeleting ? -1 : 0}
                    aria-label={isDeleting ? `Deleting ${title}` : `Delete ${title}`}
                    aria-disabled={isDeleting}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      if (!conversationId || isDeleting) {
                        return;
                      }
                      onDeleteChat(conversationId);
                    }}
                    className={`h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors ${
                      isDeleting
                        ? "flex cursor-wait"
                        : "hidden group-hover:flex hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}