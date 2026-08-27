/**
 * Utilities for generating, resolving, and formatting instant conversation titles.
 */

import { Conversation, ChatMessage } from "@/types/chat";

/**
 * Generates a clean, human-readable title from user prompt text or attached filename.
 */
export function generateChatTitle(
  prompt?: string | null,
  filename?: string | null
): string {
  if (prompt && typeof prompt === "string" && prompt.trim()) {
    // Strip markdown formatting, code block markers, quotes, and excessive whitespace
    let clean = prompt
      .replace(/```[\s\S]*?```/g, (match) => {
        // Extract first line of code snippet or text
        const lines = match.replace(/```[a-z]*/i, "").replace(/```$/, "").trim().split("\n");
        return lines[0] || "";
      })
      .replace(/^#+\s+/gm, "") // Strip heading hashes
      .replace(/[*_`~>#[\]()]/g, "") // Strip markdown symbols
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (clean.length > 0) {
      // Capitalize first character
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);

      // Max title length: ~42 characters, truncate neatly at word boundary
      if (clean.length > 42) {
        const truncated = clean.slice(0, 42);
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > 18) {
          return truncated.slice(0, lastSpace).trim() + "…";
        }
        return truncated.trim() + "…";
      }

      return clean;
    }
  }

  if (filename && typeof filename === "string" && filename.trim()) {
    // Remove extension and replace dashes/underscores with spaces
    const base = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .trim();

    if (base.length > 0) {
      const cap = base.charAt(0).toUpperCase() + base.slice(1);
      if (cap.length > 38) {
        return cap.slice(0, 38).trim() + "…";
      }
      return cap;
    }

    return filename.trim();
  }

  return "New Chat";
}

/**
 * Resolves the best title for a conversation by checking:
 * 1. An explicit non-default title
 * 2. The first user message content or attachment
 * 3. The associated document name
 * 4. Fallback to "New Chat"
 */
export function resolveConversationTitle(conversation: {
  title?: string | null;
  messages?: ChatMessage[] | any[];
  document_name?: string | null;
  filename?: string | null;
  file_name?: string | null;
}): string {
  const currentTitle = conversation.title?.trim();
  if (
    currentTitle &&
    currentTitle !== "New Chat" &&
    currentTitle !== "Chat" &&
    currentTitle !== "Untitled Chat"
  ) {
    return currentTitle;
  }

  if (conversation.messages && conversation.messages.length > 0) {
    const firstUserMsg = conversation.messages.find(
      (m: any) =>
        m.role === "user" ||
        m.role === "human" ||
        String(m.role || "").toLowerCase() === "user"
    );

    if (firstUserMsg) {
      const derived = generateChatTitle(
        firstUserMsg.content,
        firstUserMsg.attachment?.filename ||
          conversation.document_name ||
          conversation.filename ||
          conversation.file_name
      );
      if (derived && derived !== "New Chat") {
        return derived;
      }
    }
  }

  const docName =
    conversation.document_name ||
    conversation.filename ||
    conversation.file_name;
  if (docName) {
    const derivedFromDoc = generateChatTitle(null, docName);
    if (derivedFromDoc && derivedFromDoc !== "New Chat") {
      return derivedFromDoc;
    }
  }

  return currentTitle || "New Chat";
}
