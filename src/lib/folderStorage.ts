import { DocumentItem } from "@/types/documents";

const KB_FOLDERS_STORAGE_KEY = "kb_persistent_folders";

// ================================================================
// NORMALIZE DOCUMENT OR FOLDER ITEM
// ================================================================
export function normalizeDocumentItem(item: any): DocumentItem {
  if (!item || typeof item !== "object") {
    return {
      id: crypto.randomUUID(),
      file_name: "Untitled",
      user_id: "",
      parent_id: null,
      is_folder: false,
      mime_type: "application/octet-stream",
      size_bytes: 0,
      status: "ready",
      conversation_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const isFolder = Boolean(
    item.is_folder === true ||
      item.is_folder === "true" ||
      item.is_folder === 1 ||
      item.is_directory === true ||
      item.is_directory === "true" ||
      item.isFolder === true ||
      item.type === "folder" ||
      item.type === "directory" ||
      item.mime_type === "application/folder" ||
      item.mime_type === "folder" ||
      item.mime_type === "directory" ||
      item.mime_type === "inode/directory" ||
      (!item.mime_type &&
        !item.file_path &&
        !item.size_bytes &&
        !item.size &&
        item.file_name &&
        !item.file_name.includes("."))
  );

  const id = String(
    item.id || item.document_id || item.folder_id || crypto.randomUUID()
  );
  const fileName = String(
    item.file_name || item.filename || item.name || "Untitled"
  );
  const parentId =
    item.parent_id && String(item.parent_id).trim() !== ""
      ? String(item.parent_id).trim()
      : null;
  const conversationId =
    item.conversation_id &&
    String(item.conversation_id).trim() !== "" &&
    item.conversation_id !== "null" &&
    item.conversation_id !== "undefined"
      ? String(item.conversation_id).trim()
      : null;

  const sizeBytes =
    typeof item.size_bytes === "number"
      ? item.size_bytes
      : typeof item.size === "number"
      ? item.size
      : 0;

  return {
    ...item,
    id,
    file_name: fileName,
    user_id: item.user_id ? String(item.user_id) : "",
    parent_id: parentId,
    is_folder: isFolder,
    mime_type: isFolder
      ? "application/folder"
      : item.mime_type || "application/octet-stream",
    size_bytes: sizeBytes,
    status: item.status || "ready",
    conversation_id: conversationId,
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at:
      item.updated_at ||
      item.updatedAt ||
      item.created_at ||
      new Date().toISOString(),
  };
}

// ================================================================
// LOCAL STORAGE PERSISTENCE FOR FOLDERS
// ================================================================
export function getStoredFolders(): DocumentItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(KB_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeDocumentItem(item));
  } catch {
    return [];
  }
}

export function saveStoredFolder(folder: DocumentItem): void {
  if (typeof window === "undefined") return;

  try {
    const current = getStoredFolders();
    const normalized = normalizeDocumentItem({ ...folder, is_folder: true });
    const filtered = current.filter((f) => f.id !== normalized.id);
    filtered.unshift(normalized);
    localStorage.setItem(KB_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));

    // Notify other components
    window.dispatchEvent(new CustomEvent("kb_folders_updated"));
  } catch (err) {
    console.error("Failed to save folder to localStorage:", err);
  }
}

export function removeStoredFolder(folderId: string): void {
  if (typeof window === "undefined" || !folderId) return;

  try {
    const current = getStoredFolders();
    const filtered = current.filter((f) => f.id !== folderId);
    localStorage.setItem(KB_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));

    // Notify other components
    window.dispatchEvent(new CustomEvent("kb_folders_updated"));
  } catch (err) {
    console.error("Failed to remove folder from localStorage:", err);
  }
}

// ================================================================
// MERGE BACKEND ITEMS WITH STORED FOLDERS
// ================================================================
export function mergeWithStoredFolders(
  backendItems: any[],
  currentParentId: string | null = null
): DocumentItem[] {
  const normalizedBackend = (Array.isArray(backendItems) ? backendItems : []).map(
    (item) => normalizeDocumentItem(item)
  );

  // Cache any folders received from backend
  const backendFolders = normalizedBackend.filter((item) => item.is_folder);
  if (backendFolders.length > 0 && typeof window !== "undefined") {
    try {
      const currentStored = getStoredFolders();
      const map = new Map<string, DocumentItem>();
      currentStored.forEach((f) => map.set(f.id, f));
      backendFolders.forEach((f) => map.set(f.id, f));
      localStorage.setItem(
        KB_FOLDERS_STORAGE_KEY,
        JSON.stringify(Array.from(map.values()))
      );
    } catch {
      // ignore localStorage quota errors
    }
  }

  const storedFolders = getStoredFolders();
  const targetParentId = currentParentId ? String(currentParentId).trim() : null;

  // Filter stored folders for this parent
  const matchingStoredFolders = storedFolders.filter((f) => {
    const fParent = f.parent_id ? String(f.parent_id).trim() : null;
    return fParent === targetParentId;
  });

  // Combine matching stored folders and backend items
  const resultMap = new Map<string, DocumentItem>();

  // Add matching stored folders first
  matchingStoredFolders.forEach((folder) => {
    resultMap.set(folder.id, folder);
  });

  // Add/overwrite with backend items
  normalizedBackend.forEach((item) => {
    resultMap.set(item.id, item);
  });

  return Array.from(resultMap.values());
}

// ================================================================
// GET ALL ROOT FOLDERS (FOR SIDEBAR TREE)
// ================================================================
export function getAllRootFolders(loadedItems: DocumentItem[] = []): DocumentItem[] {
  const storedFolders = getStoredFolders();
  const map = new Map<string, DocumentItem>();

  // Add root folders from stored list
  storedFolders
    .filter((f) => f.is_folder && !f.parent_id)
    .forEach((f) => map.set(f.id, f));

  // Add root folders from currently loaded items
  loadedItems
    .filter((d) => d.is_folder && !d.parent_id)
    .forEach((d) => map.set(d.id, d));

  return Array.from(map.values()).sort((a, b) =>
    a.file_name.localeCompare(b.file_name)
  );
}
