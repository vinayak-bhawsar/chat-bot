export interface StoredAttachmentMeta {
  messageId?: string;
  type: "pdf" | "image";
  documentId?: string;
  filename: string;
  url?: string;
  mimeType?: string;
  index?: number;
}

/**
 * Save attachment metadata for a conversation.
 * ONLY stores metadata (filename, documentId, url, type).
 * NEVER stores raw binary or base64 files in localStorage.
 */
export function saveAttachmentMetadata(
  conversationId: string,
  meta: StoredAttachmentMeta
): void {
  if (typeof window === "undefined" || !conversationId) return;

  try {
    const key = `conversation_attachments_${conversationId}`;
    const existingRaw = localStorage.getItem(key);
    let list: StoredAttachmentMeta[] = [];

    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      } catch {
        list = [];
      }
    }

    // Replace if same messageId or documentId exists, otherwise append
    const existingIndex = list.findIndex(
      (item) =>
        (meta.messageId && item.messageId === meta.messageId) ||
        (meta.documentId && item.documentId === meta.documentId)
    );

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...meta };
    } else {
      list.push(meta);
    }

    localStorage.setItem(key, JSON.stringify(list));

    // Also persist conversation-level doc references
    if (meta.documentId) {
      localStorage.setItem(`conversation_doc_${conversationId}`, meta.documentId);
    }
    if (meta.filename) {
      localStorage.setItem(`conversation_doc_name_${conversationId}`, meta.filename);
    }
    localStorage.setItem(`conversation_doc_type_${conversationId}`, meta.type);
    if (meta.url) {
      localStorage.setItem(`conversation_doc_url_${conversationId}`, meta.url);
    }
  } catch (err) {
    console.warn("Failed to save attachment metadata:", err);
  }
}

/**
 * Retrieve attachment metadata for a conversation.
 */
export function getStoredAttachmentMetadata(
  conversationId: string
): StoredAttachmentMeta[] {
  if (typeof window === "undefined" || !conversationId) return [];

  try {
    const key = `conversation_attachments_${conversationId}`;
    const existingRaw = localStorage.getItem(key);

    if (existingRaw) {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return [];
}

/**
 * Migrate attachment metadata when a temporary conversation ID is replaced
 * with a backend conversation ID.
 */
export function migrateAttachmentMetadata(
  oldId: string,
  newId: string
): void {
  if (typeof window === "undefined" || !oldId || !newId || oldId === newId) return;

  try {
    const oldKey = `conversation_attachments_${oldId}`;
    const newKey = `conversation_attachments_${newId}`;
    const data = localStorage.getItem(oldKey);

    if (data) {
      localStorage.setItem(newKey, data);
      localStorage.removeItem(oldKey);
    }

    // Migrate conversation doc keys
    const oldDocId = localStorage.getItem(`conversation_doc_${oldId}`);
    if (oldDocId) {
      localStorage.setItem(`conversation_doc_${newId}`, oldDocId);
      localStorage.removeItem(`conversation_doc_${oldId}`);
    }

    const oldDocName = localStorage.getItem(`conversation_doc_name_${oldId}`);
    if (oldDocName) {
      localStorage.setItem(`conversation_doc_name_${newId}`, oldDocName);
      localStorage.removeItem(`conversation_doc_name_${oldId}`);
    }

    const oldDocType = localStorage.getItem(`conversation_doc_type_${oldId}`);
    if (oldDocType) {
      localStorage.setItem(`conversation_doc_type_${newId}`, oldDocType);
      localStorage.removeItem(`conversation_doc_type_${oldId}`);
    }

    const oldDocUrl = localStorage.getItem(`conversation_doc_url_${oldId}`);
    if (oldDocUrl) {
      localStorage.setItem(`conversation_doc_url_${newId}`, oldDocUrl);
      localStorage.removeItem(`conversation_doc_url_${oldId}`);
    }
  } catch (err) {
    console.warn("Failed to migrate attachment metadata:", err);
  }
}

/**
 * Clear attachment metadata when a conversation is deleted.
 */
export function clearAttachmentMetadata(conversationId: string): void {
  if (typeof window === "undefined" || !conversationId) return;

  try {
    localStorage.removeItem(`conversation_attachments_${conversationId}`);
    localStorage.removeItem(`conversation_doc_${conversationId}`);
    localStorage.removeItem(`conversation_doc_name_${conversationId}`);
    localStorage.removeItem(`conversation_doc_type_${conversationId}`);
    localStorage.removeItem(`conversation_doc_url_${conversationId}`);
  } catch {
    // ignore
  }
}
