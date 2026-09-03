import { DocumentItem } from "@/types/documents";
import { normalizeDocumentItem } from "./folderStorage";

const KB_TRASH_STORAGE_KEY = "kb_trashed_documents";

export interface TrashedDocumentItem extends DocumentItem {
  deleted_at: string;
  original_parent_id?: string | null;
}

// ================================================================
// GET TRASHED ITEMS
// ================================================================
export function getTrashedItems(): TrashedDocumentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KB_TRASH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...normalizeDocumentItem(item),
      deleted_at: item.deleted_at || new Date().toISOString(),
      original_parent_id: item.original_parent_id ?? item.parent_id ?? null,
    }));
  } catch {
    return [];
  }
}

// ================================================================
// MOVE ITEM TO TRASH
// ================================================================
export function moveToTrash(item: DocumentItem): void {
  if (typeof window === "undefined" || !item) return;
  try {
    const current = getTrashedItems();
    const trashedItem: TrashedDocumentItem = {
      ...normalizeDocumentItem(item),
      deleted_at: new Date().toISOString(),
      original_parent_id: item.parent_id ?? null,
    };
    const filtered = current.filter((t) => t.id !== item.id);
    filtered.unshift(trashedItem);
    localStorage.setItem(KB_TRASH_STORAGE_KEY, JSON.stringify(filtered));

    window.dispatchEvent(new CustomEvent("kb_trash_updated"));
  } catch (err) {
    console.error("Failed to move item to trash:", err);
  }
}

// ================================================================
// RESTORE ITEM FROM TRASH
// ================================================================
export function restoreFromTrash(itemId: string): TrashedDocumentItem | null {
  if (typeof window === "undefined" || !itemId) return null;
  try {
    const current = getTrashedItems();
    const target = current.find((t) => t.id === itemId);
    if (!target) return null;

    const filtered = current.filter((t) => t.id !== itemId);
    localStorage.setItem(KB_TRASH_STORAGE_KEY, JSON.stringify(filtered));

    window.dispatchEvent(new CustomEvent("kb_trash_updated"));
    return target;
  } catch (err) {
    console.error("Failed to restore item from trash:", err);
    return null;
  }
}

// ================================================================
// DELETE PERMANENTLY FROM TRASH
// ================================================================
export function deletePermanentlyFromTrash(itemId: string): void {
  if (typeof window === "undefined" || !itemId) return;
  try {
    const current = getTrashedItems();
    const filtered = current.filter((t) => t.id !== itemId);
    localStorage.setItem(KB_TRASH_STORAGE_KEY, JSON.stringify(filtered));

    window.dispatchEvent(new CustomEvent("kb_trash_updated"));
  } catch (err) {
    console.error("Failed to delete permanently from trash:", err);
  }
}

// ================================================================
// EMPTY TRASH
// ================================================================
export function emptyTrash(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KB_TRASH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("kb_trash_updated"));
  } catch (err) {
    console.error("Failed to empty trash:", err);
  }
}
