"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  List,
  Loader2,
  LogIn,
  PanelLeft,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import {
  createFolder,
  deleteDocument,
  getDocuments,
  uploadDocument,
} from "@/lib/documents";

import { ApiError } from "@/lib/api";
import { cleanDisplayName, getFileDetails } from "@/lib/fileTypes";
import { DocumentItem } from "@/types/documents";
import { useAuth } from "@/context/AuthContext";
import PdfViewerModal from "@/components/common/PdfViewerModal";
import {
  getChatAttachmentDocIds,
  recordKnowledgeBaseDocId,
} from "@/lib/attachmentStorage";
import {
  normalizeDocumentItem,
  mergeWithStoredFolders,
  saveStoredFolder,
  removeStoredFolder,
  getAllRootFolders,
  getStoredFolders,
} from "@/lib/folderStorage";
import {
  getTrashedItems,
  moveToTrash,
  restoreFromTrash,
  deletePermanentlyFromTrash,
  emptyTrash,
  TrashedDocumentItem,
} from "@/lib/trashStorage";

interface FolderPath {
  id: string | null;
  name: string;
}

interface UploadingItem {
  id: string;
  filename: string;
  size: number;
  progress: number;
  chunks?: number;
  totalChunks?: number;
  statusMessage?: string;
  status: "uploading" | "chunking" | "completed" | "error";
  documentId?: string;
  mimeType?: string;
  file?: File | null;
}

interface ActivityItem {
  id: string;
  action: string;
  targetName: string;
  time: string;
  type: "upload" | "folder" | "delete" | "index";
}

type DriveTab = "my_drive" | "trash";
type FileTypeFilter = "all" | "pdf" | "docs" | "sheets" | "images" | "code";
type SortOption = "name" | "date" | "size";

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Recent";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

interface KnowledgeBaseContentProps {
  conversationId?: string | null;
}

export default function KnowledgeBaseContent({
  conversationId = null,
}: KnowledgeBaseContentProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Documents state - strictly global Knowledge Base items (conversation_id === null)
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drive Navigation & Tabs
  const [activeTab, setActiveTab] = useState<DriveTab>("my_drive");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([
    { id: null, name: "My Drive" },
  ]);
  const [isDriveSidebarOpen, setIsDriveSidebarOpen] = useState(false);
  const [isSidebarSqueezed, setIsSidebarSqueezed] = useState(false);

  // New Dropdown Menu
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  // Recent Activity Log
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([
    {
      id: "act-1",
      action: "Knowledge Base RAG Vector Store connected",
      targetName: "System",
      time: "Just now",
      type: "index",
    },
  ]);

  const addActivity = useCallback(
    (action: string, targetName: string, type: ActivityItem["type"]) => {
      setActivityLog((prev) => [
        {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action,
          targetName,
          time: "Just now",
          type,
        },
        ...prev.slice(0, 30),
      ]);
    },
    []
  );

  // View & Inspector
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DocumentItem | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"details" | "activity">("details");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Drag & Drop
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  // Upload Queue
  const [uploading, setUploading] = useState(false);
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Trash state
  const [trashedItems, setTrashedItems] = useState<TrashedDocumentItem[]>([]);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<DocumentItem | null>(null);

  useEffect(() => {
    const updateTrash = () => {
      setTrashedItems(getTrashedItems());
    };
    updateTrash();
    window.addEventListener("kb_trash_updated", updateTrash);
    window.addEventListener("storage", updateTrash);
    return () => {
      window.removeEventListener("kb_trash_updated", updateTrash);
      window.removeEventListener("storage", updateTrash);
    };
  }, []);

  // Stored folders state for real-time reactivity
  const [storedFolders, setStoredFolders] = useState<DocumentItem[]>(() => getStoredFolders());

  useEffect(() => {
    const handleFoldersUpdated = () => {
      setStoredFolders(getStoredFolders());
    };
    handleFoldersUpdated();
    window.addEventListener("kb_folders_updated", handleFoldersUpdated);
    window.addEventListener("storage", handleFoldersUpdated);
    return () => {
      window.removeEventListener("kb_folders_updated", handleFoldersUpdated);
      window.removeEventListener("storage", handleFoldersUpdated);
    };
  }, []);

  // PDF / Document Viewer
  const [previewPdf, setPreviewPdf] = useState<{
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

  // Chat-attached doc IDs state for robust cross-view isolation
  const [chatDocIds, setChatDocIds] = useState<Set<string>>(() => getChatAttachmentDocIds());

  useEffect(() => {
    const syncChatIds = () => {
      setChatDocIds(getChatAttachmentDocIds());
    };
    window.addEventListener("storage", syncChatIds);
    window.addEventListener("focus", syncChatIds);
    return () => {
      window.removeEventListener("storage", syncChatIds);
      window.removeEventListener("focus", syncChatIds);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        newDropdownRef.current &&
        !newDropdownRef.current.contains(e.target as Node)
      ) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Helper for error message
  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
  };

  // ==============================================================
  // FETCH DOCUMENTS (Strictly global items where conversation_id is null)
  // ==============================================================
  const isKnowledgeBaseDocument = useCallback(
    (doc: DocumentItem): boolean => {
      if (doc.is_folder) return true;
      if (chatDocIds.has(doc.id)) return false;
      const conv = doc.conversation_id;
      return (
        !conv ||
        conv === "null" ||
        conv === "undefined" ||
        conv === "" ||
        String(conv).trim().length === 0
      );
    },
    [chatDocIds]
  );

  const loadDocuments = useCallback(
    async (parentId: string | null = null) => {
      if (!isAuthenticated) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch documents from backend with safe pageSize 100
        const response = await getDocuments(parentId, 1, 100, null);
        const resAny = response as any;
        const allItems: any[] =
          (Array.isArray(resAny?.data?.items) && resAny.data.items) ||
          (Array.isArray(resAny?.items) && resAny.items) ||
          (Array.isArray(resAny?.data) && resAny.data) ||
          (Array.isArray(resAny) && resAny) ||
          [];

        // Merge backend items with stored custom folders
        const merged = mergeWithStoredFolders(allItems, parentId);

        // Only store and display global knowledge base documents (conversation_id === null) and folders
        const kbItems = merged.filter((d) => isKnowledgeBaseDocument(d));
        setDocuments(kbItems);
      } catch (err) {
        console.error("Failed to load documents:", err);
        const fallbackStored = mergeWithStoredFolders([], parentId);
        setDocuments(fallbackStored);
        setError(getErrorMessage(err, "Failed to load documents."));
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, isKnowledgeBaseDocument]
  );

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      if (!isAuthenticated) setDocuments([]);
      return;
    }
    void loadDocuments(currentFolderId);

    const handleFoldersUpdated = () => {
      void loadDocuments(currentFolderId);
    };

    window.addEventListener("kb_folders_updated", handleFoldersUpdated);
    return () => {
      window.removeEventListener("kb_folders_updated", handleFoldersUpdated);
    };
  }, [isAuthenticated, authLoading, currentFolderId, loadDocuments]);

  // ==============================================================
  // DRAG AND DROP
  // ==============================================================
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void processUploadFiles(Array.from(files));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processUploadFiles(Array.from(files));
      e.target.value = "";
    }
  };

  // ==============================================================
  // PROCESS UPLOADS & CHUNKING (Knowledge Base global documents)
  // ==============================================================
  const processUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setShowNewDropdown(false);

    try {
      setUploading(true);
      setError(null);

      for (const file of files) {
        const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        setUploadingItems((prev) => [
          ...prev,
          {
            id: tempId,
            filename: file.name,
            size: file.size,
            progress: 15,
            statusMessage: "Uploading...",
            status: "uploading",
            mimeType: file.type,
            file: file,
          },
        ]);

        try {
          const uploadedDoc = await uploadDocument({
            file,
            parent_id: currentFolderId,
            conversation_id: null,
            onProgress: (p) => {
              setUploadingItems((prev) =>
                prev.map((item) => {
                  if (item.id !== tempId) return item;
                  const chunks = p.chunks ?? p.current_chunk;
                  const totalChunks = p.total_chunks;
                  const percent =
                    p.progress ??
                    (chunks && totalChunks
                      ? Math.min(Math.round((chunks / totalChunks) * 100), 98)
                      : item.progress ?? 45);

                  return {
                    ...item,
                    progress: percent,
                    chunks: typeof chunks === "number" ? chunks : item.chunks,
                    totalChunks:
                      typeof totalChunks === "number" ? totalChunks : item.totalChunks,
                    statusMessage:
                      p.message ||
                      (chunks && totalChunks
                        ? `Chunk ${chunks}/${totalChunks}...`
                        : chunks
                        ? `Chunk ${chunks}...`
                        : "Processing chunks..."),
                    status: p.status === "completed" ? "completed" : "chunking",
                    documentId: p.document_id || item.documentId,
                  };
                })
              );
            },
          });

          const totalChunks =
            (uploadedDoc as any)?.chunks ??
            (uploadedDoc as any)?.total_chunks ??
            (uploadedDoc as any)?.data?.chunks;

          setUploadingItems((prev) =>
            prev.map((item) => {
              if (item.id !== tempId) return item;
              return {
                ...item,
                progress: 100,
                status: "completed",
                chunks: typeof totalChunks === "number" ? totalChunks : item.chunks,
                statusMessage:
                  typeof totalChunks === "number"
                    ? `${totalChunks} chunks indexed • Ready`
                    : "Vector Indexed • Ready",
                documentId:
                  (uploadedDoc as any)?.id || (uploadedDoc as any)?.document_id,
              };
            })
          );

          if (uploadedDoc && (uploadedDoc.id || (uploadedDoc as any).document_id)) {
            const docId = uploadedDoc.id || (uploadedDoc as any).document_id;
            recordKnowledgeBaseDocId(docId);
            setDocuments((prev) => {
              const exists = prev.some((d) => d.id === docId);
              if (exists) return prev;
              return [
                {
                  id: docId,
                  file_name: uploadedDoc.file_name || file.name,
                  user_id: uploadedDoc.user_id || "",
                  parent_id: currentFolderId,
                  is_folder: false,
                  mime_type:
                    uploadedDoc.mime_type || file.type || "application/octet-stream",
                  size_bytes: uploadedDoc.size_bytes || file.size,
                  status: uploadedDoc.status || "ready",
                  conversation_id: null,
                  created_at: uploadedDoc.created_at || new Date().toISOString(),
                  updated_at: uploadedDoc.updated_at || new Date().toISOString(),
                },
                ...prev,
              ];
            });

            addActivity("Uploaded document", file.name, "upload");
          }

          setTimeout(() => {
            setUploadingItems((prev) => prev.filter((item) => item.id !== tempId));
          }, 3000);
        } catch (fileErr) {
          console.error(`Failed to upload ${file.name}:`, fileErr);
          setUploadingItems((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    progress: 0,
                    status: "error",
                    statusMessage: getErrorMessage(fileErr, "Upload failed."),
                  }
                : item
            )
          );
        }
      }

      await loadDocuments(currentFolderId);
    } catch (err) {
      console.error("Upload error:", err);
      setError(getErrorMessage(err, "Failed to upload file(s)."));
    } finally {
      setUploading(false);
    }
  };

  // ==============================================================
  // NAVIGATION & FOLDER JUMPING
  // ==============================================================
  const openFolder = (folder: DocumentItem) => {
    setActiveTab("my_drive");
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => {
      const base =
        prev.length > 0 && prev[0].id === null && prev[0].name === "My Drive"
          ? prev
          : [{ id: null, name: "My Drive" }];
      return [...base, { id: folder.id, name: folder.file_name }];
    });
    setSelectedItem(folder);
    setSearchQuery("");
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index >= folderPath.length) return;
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
    setSelectedItem(null);
  };

  const handleGoBack = () => {
    if (folderPath.length <= 1) return;
    const newPath = folderPath.slice(0, -1);
    const parentTarget = newPath[newPath.length - 1];
    setCurrentFolderId(parentTarget.id);
    setFolderPath(newPath);
    setSelectedItem(null);
  };

  // ==============================================================
  // CREATE FOLDER
  // ==============================================================
  const handleCreateFolder = async () => {
    const trimmed = folderName.trim();
    if (!trimmed || creatingFolder) return;

    try {
      setCreatingFolder(true);
      setError(null);

      let created: any = null;
      try {
        created = await createFolder({
          file_name: trimmed,
          parent_id: currentFolderId,
        });
      } catch (createErr) {
        console.warn("Backend createFolder error, saving locally:", createErr);
      }

      const folderId =
        (created && (created.id || created.document_id || created.folder_id)) ||
        crypto.randomUUID();

      const newFolderItem = normalizeDocumentItem({
        id: folderId,
        file_name: trimmed,
        user_id: created?.user_id || "",
        parent_id: currentFolderId,
        is_folder: true,
        mime_type: "application/folder",
        size_bytes: 0,
        status: "ready",
        conversation_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      saveStoredFolder(newFolderItem);
      setDocuments((prev) => [
        newFolderItem,
        ...prev.filter((d) => d.id !== folderId),
      ]);
      addActivity("Created folder", trimmed, "folder");

      setFolderName("");
      setShowFolderModal(false);
      await loadDocuments(currentFolderId);
    } catch (err) {
      console.error("Failed to create folder:", err);
      setError(getErrorMessage(err, "Failed to create folder."));
    } finally {
      setCreatingFolder(false);
    }
  };

  // ==============================================================
  // MOVE TO TRASH
  // ==============================================================
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    const target = deleteTarget;
    try {
      setDeletingId(target.id);
      setError(null);

      // 1. Move item to trash storage
      moveToTrash(target);

      // 2. If it was a custom folder, remove from active folders
      if (target.is_folder) {
        removeStoredFolder(target.id);
      }

      // 3. Immediately update active document state
      setDocuments((prev) => prev.filter((d) => d.id !== target.id));
      setTrashedItems(getTrashedItems());
      if (selectedItem?.id === target.id) {
        setSelectedItem(null);
      }

      addActivity("Moved to trash", target.file_name, "delete");
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to move item to trash:", err);
      setError(getErrorMessage(err, "Failed to move item to trash."));
    } finally {
      setDeletingId(null);
    }
  };

  // ==============================================================
  // RESTORE FROM TRASH
  // ==============================================================
  const handleRestore = (item: DocumentItem) => {
    try {
      const restored = restoreFromTrash(item.id);
      if (restored) {
        if (restored.is_folder) {
          saveStoredFolder(restored);
        }
        setTrashedItems((prev) => prev.filter((d) => d.id !== item.id));
        setDocuments((prev) => [
          restored,
          ...prev.filter((d) => d.id !== restored.id),
        ]);
        if (selectedItem?.id === item.id) {
          setSelectedItem(null);
        }
        addActivity("Restored", item.file_name, item.is_folder ? "folder" : "upload");
      }
    } catch (err) {
      console.error("Failed to restore item:", err);
      setError(getErrorMessage(err, "Failed to restore item."));
    }
  };

  // ==============================================================
  // PERMANENT DELETE (FROM TRASH) - INSTANT
  // ==============================================================
  const handlePermanentDeleteConfirm = () => {
    if (!permanentDeleteTarget) return;

    const targetId = permanentDeleteTarget.id;
    const targetName = permanentDeleteTarget.file_name;

    try {
      setError(null);

      // 1. Immediately purge from local storage & memory state
      deletePermanentlyFromTrash(targetId);
      setTrashedItems((prev) => prev.filter((d) => d.id !== targetId));
      if (selectedItem?.id === targetId) {
        setSelectedItem(null);
      }
      setPermanentDeleteTarget(null);
      setDeletingId(null);
      addActivity("Permanently deleted", targetName, "delete");

      // 2. Fire backend deletion in background (non-blocking)
      void deleteDocument(targetId).catch(() => {});
    } catch (err) {
      console.error("Failed to permanently delete item:", err);
      setError(getErrorMessage(err, "Failed to permanently delete item."));
    }
  };

  // ==============================================================
  // EMPTY TRASH - INSTANT
  // ==============================================================
  const handleEmptyTrashConfirm = () => {
    try {
      setError(null);

      const itemsToDelete = [...trashedItems];

      // 1. Immediately wipe local storage & memory state
      emptyTrash();
      setTrashedItems([]);
      setSelectedItem(null);
      setShowEmptyTrashModal(false);
      setDeletingId(null);
      addActivity("Emptied trash", "All items cleared", "delete");

      // 2. Fire backend deletions in parallel in background (non-blocking)
      void Promise.allSettled(
        itemsToDelete.map((item) =>
          deleteDocument(item.id).catch(() => {})
        )
      );
    } catch (err) {
      console.error("Failed to empty trash:", err);
      setError(getErrorMessage(err, "Failed to empty trash."));
    }
  };

  // ==============================================================
  // PREVIEW
  // ==============================================================
  const handlePreview = (item: DocumentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewPdf({
      isOpen: true,
      filename: item.file_name,
      documentId: item.id,
      file: null,
      url: null,
    });
  };

  // ==============================================================
  // FILTERING & SORTING (Google Drive Pipeline - strictly Knowledge Base)
  // ==============================================================
  const filteredAndSortedDocuments = useMemo(() => {
    let items: DocumentItem[] = [];

    // Tab filter
    if (activeTab === "trash") {
      items = [...trashedItems];
    } else {
      items = documents.filter((d) => isKnowledgeBaseDocument(d));
      // My Drive: strictly knowledge base items (conversation_id === null)
      if (currentFolderId) {
        items = items.filter((d) => d.parent_id === currentFolderId);
      } else {
        // Root: knowledge base items where parent_id is null/undefined
        items = items.filter((d) => !d.parent_id);
      }
    }

    // Type filter
    if (typeFilter !== "all") {
      items = items.filter((d) => {
        if (d.is_folder) return false;
        const details = getFileDetails(d.file_name, d.mime_type);
        if (typeFilter === "pdf") return details.category === "pdf";
        if (typeFilter === "docs")
          return (
            details.category === "word" ||
            details.category === "text" ||
            details.category === "powerpoint"
          );
        if (typeFilter === "sheets") return details.category === "excel";
        if (typeFilter === "images") return details.category === "image";
        if (typeFilter === "code") return details.category === "code";
        return true;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((d) => d.file_name.toLowerCase().includes(q));
    }

    // Sort
    return items.sort((a, b) => {
      // Keep folders on top in My Drive view
      if (activeTab === "my_drive") {
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;
      }

      let res = 0;
      if (sortBy === "name") {
        res = a.file_name.localeCompare(b.file_name);
      } else if (sortBy === "date") {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        res = dateB - dateA; // latest first
      } else if (sortBy === "size") {
        res = (b.size_bytes || 0) - (a.size_bytes || 0);
      }

      return sortDirection === "asc" ? res : -res;
    });
  }, [
    documents,
    trashedItems,
    activeTab,
    currentFolderId,
    typeFilter,
    searchQuery,
    sortBy,
    sortDirection,
    isKnowledgeBaseDocument,
  ]);

  // Separate folders and files for Drive layout
  const folderItems = useMemo(
    () => filteredAndSortedDocuments.filter((d) => d.is_folder),
    [filteredAndSortedDocuments]
  );

  const fileItems = useMemo(
    () => filteredAndSortedDocuments.filter((d) => !d.is_folder),
    [filteredAndSortedDocuments]
  );

  // Total unique folders across all levels
  const totalFoldersCount = useMemo(() => {
    const map = new Map<string, DocumentItem>();
    storedFolders
      .filter((f) => f.is_folder)
      .forEach((f) => map.set(f.id, f));
    documents
      .filter((d) => d.is_folder)
      .forEach((d) => map.set(d.id, d));
    return map.size;
  }, [storedFolders, documents]);

  // Subfolders for My Drive sidebar tree (ALWAYS shows all root folders)
  const rootFolders = useMemo(() => {
    const map = new Map<string, DocumentItem>();
    storedFolders
      .filter((f) => f.is_folder && !f.parent_id)
      .forEach((f) => map.set(f.id, f));
    documents
      .filter((d) => d.is_folder && !d.parent_id)
      .forEach((d) => map.set(d.id, d));
    return Array.from(map.values()).sort((a, b) =>
      a.file_name.localeCompare(b.file_name)
    );
  }, [storedFolders, documents]);

  // Stats calculation: Knowledge Base files only
  const stats = useMemo(() => {
    const kbFiles = documents.filter((d) => !d.is_folder && isKnowledgeBaseDocument(d));
    const totalFiles = kbFiles.length;
    const totalBytes = kbFiles.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
    return {
      totalFiles,
      totalFolders: totalFoldersCount,
      totalBytes,
    };
  }, [documents, totalFoldersCount, isKnowledgeBaseDocument]);

  // Type counts calculation for category filter chips
  const typeCounts = useMemo(() => {
    let baseItems = documents.filter((d) => isKnowledgeBaseDocument(d) && !d.is_folder);
    if (activeTab === "trash") {
      return { all: 0, pdf: 0, docs: 0, sheets: 0, images: 0, code: 0 };
    }
    if (currentFolderId) {
      baseItems = baseItems.filter((d) => d.parent_id === currentFolderId);
    } else {
      baseItems = baseItems.filter((d) => !d.parent_id);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      baseItems = baseItems.filter((d) => d.file_name.toLowerCase().includes(q));
    }

    const counts = {
      all: baseItems.length,
      pdf: 0,
      docs: 0,
      sheets: 0,
      images: 0,
      code: 0,
    };

    for (const d of baseItems) {
      const details = getFileDetails(d.file_name, d.mime_type);
      if (details.category === "pdf") counts.pdf++;
      else if (
        details.category === "word" ||
        details.category === "text" ||
        details.category === "powerpoint"
      )
        counts.docs++;
      else if (details.category === "excel") counts.sheets++;
      else if (details.category === "image") counts.images++;
      else if (details.category === "code") counts.code++;
    }

    return counts;
  }, [documents, activeTab, currentFolderId, searchQuery, isKnowledgeBaseDocument]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900 select-none"
    >
      {/* ========================================================
          FULL SCREEN GOOGLE DRIVE DRAG & DROP OVERLAY
          ======================================================== */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#56C5D9]/10 backdrop-blur-xs p-6 animate-in fade-in duration-150">
          <div className="flex flex-col items-center justify-center rounded-3xl border-3 border-dashed border-[#2ba8be] bg-white/95 px-12 py-16 text-center shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#56C5D9]/20 text-[#2ba8be] animate-bounce">
              <Upload className="h-8 w-8 stroke-[2.5]" />
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
              Drop files to upload to Knowledge Base
            </h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-sm">
              Files will be automatically uploaded, chunked, and indexed into the AI RAG Vector
              Store.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================
          TOP HEADER & SEARCH BAR (Unified Application Theme)
          ======================================================== */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-[#f7f7f8]/90 backdrop-blur-md px-4 sm:px-6">
        {/* Mobile Sidebar Toggle & Brand Title */}
        <div
          className={`flex items-center gap-2.5 transition-all duration-200 ${
            isSidebarSqueezed ? "md:w-16" : "md:w-56"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsDriveSidebarOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 md:hidden transition-colors"
            title="Toggle Navigation"
          >
            <List className="h-4.5 w-4.5" />
          </button>

          {/* Squeeze / Expand Sidebar Toggle for Desktop */}
          <button
            type="button"
            onClick={() => setIsSidebarSqueezed((prev) => !prev)}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
            title={isSidebarSqueezed ? "Expand sidebar" : "Squeeze / collapse sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          {!isSidebarSqueezed && (
            <div className="flex items-center gap-2 overflow-hidden truncate">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/25 shadow-2xs">
                <Folder className="h-4.5 w-4.5 fill-amber-500/20" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[13px] font-bold tracking-tight text-zinc-900 truncate">
                  Knowledge Base
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  RAG Vector Store
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pill Search Bar matching Application Theme */}
        <div className="flex flex-1 max-w-2xl px-2 sm:px-4">
          <div className="group relative flex w-full items-center rounded-xl bg-white transition-all duration-200 focus-within:ring-2 focus-within:ring-[#56C5D9]/35 focus-within:border-[#56C5D9] border border-zinc-200/90 shadow-2xs">
            <Search className="ml-3.5 h-4 w-4 shrink-0 text-zinc-400 group-focus-within:text-[#2ba8be]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Knowledge Base documents..."
              className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mr-2 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* RAG Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>RAG Vector Ready</span>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => loadDocuments(currentFolderId)}
            disabled={loading}
            title="Refresh Knowledge Base"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 shadow-2xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-zinc-800" : ""}`} />
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-zinc-200/90 bg-zinc-100/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-white text-zinc-900 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white text-zinc-900 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Info Details Inspector Toggle */}
          <button
            type="button"
            onClick={() => setIsInspectorOpen((prev) => !prev)}
            title="View details"
            className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition-all shadow-2xs ${
              isInspectorOpen
                ? "bg-[#56C5D9]/15 text-[#1b7a8b] border-[#56C5D9]/30"
                : "border-zinc-200/90 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ========================================================
          3-COLUMN GOOGLE DRIVE BODY
          ======================================================== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ------------------------------------------------------
            COLUMN 1: LEFT NAVIGATION SIDEBAR (Squeezable)
            ------------------------------------------------------ */}
        <aside
          className={`${
            isDriveSidebarOpen ? "flex fixed inset-y-0 left-0 z-40" : "hidden"
          } md:flex ${
            isSidebarSqueezed ? "w-16 px-2 py-3.5" : "w-56 p-3.5"
          } shrink-0 flex-col justify-between border-r border-zinc-200/80 bg-[#f7f7f8] transition-all duration-200`}
        >
          <div className="flex flex-col gap-3">
            {/* "+ NEW" BUTTON WITH FLOATING DROPDOWN (Theme Styled) */}
            <div className="relative" ref={newDropdownRef}>
              <button
                type="button"
                onClick={() => setShowNewDropdown((prev) => !prev)}
                title={isSidebarSqueezed ? "New" : undefined}
                className={`group relative flex items-center overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] ${
                  isSidebarSqueezed
                    ? "h-10 w-10 mx-auto justify-center"
                    : "w-full gap-2.5 px-3 py-2.5 text-xs font-semibold text-zinc-900"
                }`}
              >
                {/* Colored Plus Icon */}
                <div
                  className={`flex items-center justify-center shrink-0 rounded-lg bg-[#56C5D9]/10 border border-[#56C5D9]/25 text-[#2ba8be] transition-transform duration-200 group-hover:scale-105 ${
                    isSidebarSqueezed ? "h-7 w-7" : "h-6 w-6"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>

                {!isSidebarSqueezed && (
                  <span className="flex-1 text-left text-[13px] font-semibold tracking-tight text-zinc-900 truncate">
                    New
                  </span>
                )}
                {!isSidebarSqueezed && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
                      showNewDropdown ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {/* NEW DROPDOWN MENU */}
              {showNewDropdown && (
                <div
                  className={`absolute z-50 mt-1.5 w-52 rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 ${
                    isSidebarSqueezed ? "left-12 top-0" : "left-0 top-full"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDropdown(false);
                      setShowFolderModal(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex h-5.5 w-5.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                      <FolderPlus className="h-3.5 w-3.5" />
                    </div>
                    <span>New folder</span>
                  </button>

                  <div className="my-1 border-t border-zinc-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDropdown(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex h-5.5 w-5.5 items-center justify-center rounded-lg bg-[#56C5D9]/15 text-[#2ba8be]">
                      <Upload className="h-3.5 w-3.5 stroke-[2.25]" />
                    </div>
                    <span>File upload</span>
                  </button>
                </div>
              )}
            </div>

            {/* NAVIGATION MENU ITEMS */}
            <nav className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              {/* Home */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("my_drive");
                  setCurrentFolderId(null);
                  setFolderPath([{ id: null, name: "My Drive" }]);
                  if (window.innerWidth < 768) setIsDriveSidebarOpen(false);
                }}
                title={isSidebarSqueezed ? "Home" : undefined}
                className={`flex items-center rounded-xl transition-all border ${
                  isSidebarSqueezed
                    ? "h-9 w-9 mx-auto justify-center"
                    : "w-full gap-2.5 px-3 py-2 text-left"
                } ${
                  activeTab === "my_drive" && currentFolderId === null
                    ? "bg-white text-zinc-900 border-zinc-200/90 shadow-2xs font-semibold"
                    : "border-transparent text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                }`}
              >
                <Home className="h-4 w-4 shrink-0 text-zinc-500" />
                {!isSidebarSqueezed && <span className="truncate text-[13px]">Home</span>}
              </button>

              {/* My Drive with Subfolders */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("my_drive");
                    setCurrentFolderId(null);
                    setFolderPath([{ id: null, name: "My Drive" }]);
                    if (window.innerWidth < 768) setIsDriveSidebarOpen(false);
                  }}
                  title={isSidebarSqueezed ? "My Drive" : undefined}
                  className={`flex items-center justify-between rounded-xl transition-all border ${
                    isSidebarSqueezed
                      ? "h-9 w-9 mx-auto justify-center"
                      : "w-full gap-2.5 px-3 py-2 text-left"
                  } ${
                    activeTab === "my_drive"
                      ? "bg-amber-500/10 text-amber-900 border-amber-500/30 shadow-2xs font-semibold"
                      : "border-transparent text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder className="h-4 w-4 shrink-0 fill-amber-500/20 text-amber-600" />
                    {!isSidebarSqueezed && (
                      <span className="truncate text-[13px]">My Drive</span>
                    )}
                  </div>
                  {!isSidebarSqueezed && totalFoldersCount > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                      {totalFoldersCount}
                    </span>
                  )}
                </button>

                {/* Subfolder Tree */}
                {!isSidebarSqueezed && rootFolders.length > 0 && (
                  <div className="ml-5 mt-1 flex flex-col border-l border-zinc-200 pl-2 gap-0.5">
                    {rootFolders.map((f, fIdx) => (
                      <button
                        key={`${f.id}-${fIdx}`}
                        type="button"
                        onClick={() => openFolder(f)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] truncate text-left transition-colors ${
                          currentFolderId === f.id
                            ? "bg-[#56C5D9]/15 text-[#1b7a8b] font-semibold"
                            : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                        }`}
                      >
                        <Folder className="h-3 w-3 shrink-0 text-amber-500" />
                        <span className="truncate">{f.file_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Trash */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("trash");
                  setCurrentFolderId(null);
                  if (window.innerWidth < 768) setIsDriveSidebarOpen(false);
                }}
                title={isSidebarSqueezed ? "Trash" : undefined}
                className={`flex items-center rounded-xl transition-all border ${
                  isSidebarSqueezed
                    ? "h-9 w-9 mx-auto justify-center"
                    : "w-full gap-2.5 px-3 py-2 text-left"
                } ${
                  activeTab === "trash"
                    ? "bg-red-50 text-red-600 border-red-200 shadow-2xs font-semibold"
                    : "border-transparent text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                }`}
              >
                <Trash2 className="h-4 w-4 shrink-0 text-zinc-500" />
                {!isSidebarSqueezed && (
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span className="truncate text-[13px]">Trash</span>
                    {trashedItems.length > 0 && (
                      <span className="rounded-full bg-red-100 text-red-600 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                        {trashedItems.length}
                      </span>
                    )}
                  </div>
                )}
              </button>
            </nav>
          </div>

          {/* STORAGE METER WIDGET (BOTTOM - Theme Styled) */}
          <div
            className={`rounded-2xl border border-zinc-200/90 bg-white transition-all shadow-2xs ${
              isSidebarSqueezed ? "p-2 text-center" : "p-3.5"
            }`}
            title={
              isSidebarSqueezed
                ? `Storage: ${formatFileSize(stats.totalBytes)} (${stats.totalFiles} files)`
                : undefined
            }
          >
            {isSidebarSqueezed ? (
              <div className="flex flex-col items-center justify-center gap-1.5">
                <HardDrive className="h-4 w-4 text-[#2ba8be]" />
                <div className="h-1 w-6 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-[#56C5D9]"
                    style={{
                      width: `${Math.min(
                        Math.max((stats.totalBytes / (50 * 1024 * 1024)) * 100, 10),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-[#56C5D9]/10 text-[#2ba8be]">
                      <HardDrive className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-900">Storage</span>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-500 font-mono">
                    {formatFileSize(stats.totalBytes)}
                  </span>
                </div>

                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#56C5D9] to-emerald-500"
                    style={{
                      width: `${Math.min(
                        Math.max((stats.totalBytes / (50 * 1024 * 1024)) * 100, 8),
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{stats.totalFiles} files</span>
                  <span>{stats.totalFolders} folders</span>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------
            COLUMN 2: CENTER MAIN CONTENT AREA
            ------------------------------------------------------ */}
        <main className="flex flex-1 min-w-0 flex-col overflow-y-auto bg-[#fbfbfc]">
          {/* MAIN CONTENT INNER BODY */}
          <div className="flex-1 p-4 sm:p-6 space-y-6">
            {/* TRASH BANNER (WHEN IN TRASH VIEW) */}
            {activeTab === "trash" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-200/80 bg-red-50/50 p-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 border border-red-200">
                    <Trash2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Trash Bin</h2>
                    <p className="text-xs text-zinc-500">
                      Items in trash can be restored back to your Knowledge Base or permanently deleted.
                    </p>
                  </div>
                </div>

                {trashedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEmptyTrashModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Empty Trash ({trashedItems.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* MAIN CONTENT TOP ACTION BAR (WHEN IN MY DRIVE) */}
            {activeTab === "my_drive" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/80">
                <div className="flex items-center gap-2 text-xs text-zinc-600 min-w-0">
                  {folderPath.length > 1 && (
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-[0.98] mr-1"
                      title="Go back one folder"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 overflow-x-auto">
                    {folderPath.map((item, idx) => {
                      const isLast = idx === folderPath.length - 1;
                      return (
                        <div key={`${item.id ?? "root"}-${idx}`} className="flex items-center">
                          {idx > 0 && (
                            <ChevronRight className="h-3.5 w-3.5 mx-1 text-zinc-400 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={() => navigateToBreadcrumb(idx)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-colors truncate max-w-[180px] ${
                              isLast
                                ? "font-bold text-zinc-900"
                                : "text-zinc-500 hover:text-zinc-900"
                            }`}
                          >
                            <span className="truncate">{item.name}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Action Buttons on Main Content */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(true)}
                    className="group inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span>New Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group inline-flex items-center gap-1.5 rounded-xl border border-[#56C5D9]/40 bg-gradient-to-tr from-[#56C5D9]/15 to-[#56C5D9]/5 px-3 py-1.5 text-xs font-semibold text-[#1b7a8b] shadow-2xs hover:bg-[#56C5D9]/25 hover:border-[#56C5D9]/60 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#2ba8be] group-hover:scale-110 transition-transform stroke-[2.25]" />
                    <span>Upload File</span>
                  </button>
                </div>
              </div>
            )}
            {/* ERROR BANNER */}
            {error && (
              <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-700 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* UPLOAD & INDEXING PROGRESS QUEUE */}
            {uploadingItems.length > 0 && (
              <div className="rounded-2xl border border-[#56C5D9]/30 bg-gradient-to-r from-[#56C5D9]/10 via-[#56C5D9]/5 to-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#2ba8be] animate-pulse" />
                    <span className="text-xs font-bold text-zinc-900">
                      RAG Chunking & Vector Ingestion Queue ({uploadingItems.length})
                    </span>
                  </div>
                  {uploadingItems.every((i) => i.status === "completed" || i.status === "error") && (
                    <button
                      type="button"
                      onClick={() => setUploadingItems([])}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
                    >
                      Dismiss all
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {uploadingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1.5 rounded-xl border border-zinc-200/90 bg-white p-3 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-800 truncate max-w-md">
                          {item.filename}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {item.statusMessage}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === "error"
                              ? "bg-red-500"
                              : item.status === "completed"
                              ? "bg-emerald-500"
                              : "bg-[#56C5D9]"
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && isAuthenticated && filteredAndSortedDocuments.length === 0 && uploadingItems.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 bg-white/60 py-20 text-center shadow-2xs">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#56C5D9]/10 text-[#2ba8be] border border-[#56C5D9]/25 shadow-2xs">
                  {searchQuery ? (
                    <Search className="h-6 w-6" />
                  ) : activeTab === "trash" ? (
                    <Trash2 className="h-6 w-6" />
                  ) : (
                    <Folder className="h-6 w-6" />
                  )}
                </div>
                <h3 className="mt-4 text-base font-bold text-zinc-900">
                  {searchQuery
                    ? "No matching documents"
                    : activeTab === "trash"
                    ? "Trash is empty"
                    : "Knowledge Base is empty"}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-zinc-500 leading-relaxed">
                  {searchQuery
                    ? `No files found for "${searchQuery}". Try searching for another name.`
                    : activeTab === "trash"
                    ? "Items deleted will be shown here."
                    : "Add documents to your Knowledge Base to enable AI retrieval and context-aware responses."}
                </p>

                {activeTab === "my_drive" && (
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowFolderModal(true)}
                      className="group inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-900 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-[0.98]"
                    >
                      <FolderPlus className="h-4 w-4 text-amber-500" />
                      <span>New Folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group inline-flex items-center gap-2 rounded-xl border border-[#56C5D9]/30 bg-gradient-to-tr from-[#56C5D9]/10 to-transparent px-4 py-2.5 text-xs font-semibold text-[#1b7a8b] shadow-2xs hover:bg-[#56C5D9]/20 transition-all active:scale-[0.98]"
                    >
                      <Upload className="h-4 w-4 text-[#2ba8be]" />
                      <span>Upload File</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ====================================================
                SECTION 1: FOLDERS (CARDS)
                ==================================================== */}
            {!loading && isAuthenticated && folderItems.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Folders
                  </h2>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-600">
                    {folderItems.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {folderItems.map((folder, folderIdx) => {
                    const isSelected = selectedItem?.id === folder.id;

                    return (
                      <div
                        key={`${folder.id}-${folderIdx}`}
                        onClick={() => setSelectedItem(folder)}
                        onDoubleClick={() => openFolder(folder)}
                        className={`group relative flex items-center justify-between rounded-2xl border p-3.5 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/40 shadow-xs"
                            : "border-zinc-200/90 bg-white hover:bg-zinc-50/80 hover:border-zinc-300 hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-2xs">
                            <Folder className="h-4.5 w-4.5 fill-amber-500/20" />
                          </div>
                          <span className="truncate text-xs font-semibold text-zinc-800">
                            {folder.file_name}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {activeTab === "trash" ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(folder);
                                }}
                                className="rounded-lg p-1.5 text-zinc-500 hover:bg-[#56C5D9]/20 hover:text-[#1b7a8b] transition-colors"
                                title="Restore folder"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPermanentDeleteTarget(folder);
                                }}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(folder);
                              }}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Move to trash"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ====================================================
                SECTION 2: FILES (GRID & LIST VIEWS)
                ==================================================== */}
            {!loading && isAuthenticated && fileItems.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Files
                  </h2>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-600">
                    {fileItems.length}
                  </span>
                </div>

                {/* --- GRID VIEW --- */}
                {viewMode === "grid" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {fileItems.map((file, fileIdx) => {
                      const isSelected = selectedItem?.id === file.id;
                      const details = getFileDetails(file.file_name, file.mime_type);

                      return (
                        <div
                          key={`${file.id}-${fileIdx}`}
                          onClick={() => setSelectedItem(file)}
                          onDoubleClick={() => handlePreview(file)}
                          className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                            isSelected
                              ? "bg-white ring-2 ring-[#56C5D9] shadow-md border-transparent"
                              : "border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-2xs"
                          }`}
                        >
                          {/* Card Header: Icon + Title */}
                          <div className="flex items-center justify-between p-3.5 border-b border-zinc-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 ${details.colorClass}`}
                              >
                                {details.category === "pdf" && <FileText className="h-3.5 w-3.5" />}
                                {details.category === "word" && <File className="h-3.5 w-3.5" />}
                                {details.category === "excel" && (
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                )}
                                {details.category === "powerpoint" && (
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                )}
                                {details.category === "image" && (
                                  <ImageIcon className="h-3.5 w-3.5" />
                                )}
                                {details.category === "code" && <FileCode className="h-3.5 w-3.5" />}
                                {details.category === "text" && <FileText className="h-3.5 w-3.5" />}
                                {details.category === "archive" && (
                                  <FileArchive className="h-3.5 w-3.5" />
                                )}
                                {details.category === "file" && <File className="h-3.5 w-3.5" />}
                              </div>
                              <span
                                className="truncate text-xs font-semibold text-zinc-900"
                                title={file.file_name}
                              >
                                {cleanDisplayName(file.file_name)}
                              </span>
                            </div>

                            {/* Hover Quick Actions for File Card */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {activeTab === "trash" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestore(file);
                                    }}
                                    className="rounded-lg p-1 text-zinc-500 hover:bg-[#56C5D9]/20 hover:text-[#1b7a8b] transition-colors"
                                    title="Restore file"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPermanentDeleteTarget(file);
                                    }}
                                    className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Delete permanently"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(file);
                                  }}
                                  className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Move to trash"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Middle: Document Preview Thumbnail Canvas */}
                          <div className="flex h-28 items-center justify-center bg-zinc-50/50 p-4 transition-colors group-hover:bg-zinc-50">
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-2xs border border-zinc-200/90 text-zinc-400 group-hover:scale-105 group-hover:text-[#2ba8be] group-hover:border-[#56C5D9]/40 transition-all">
                                <FileText className="h-5 w-5" />
                              </div>
                              <span className="mt-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                                {file.file_name.split(".").pop() || "DOC"}
                              </span>
                            </div>
                          </div>

                          {/* Card Footer: Metadata & RAG badge */}
                          <div className="flex items-center justify-between p-3 bg-white border-t border-zinc-100 text-[11px] text-zinc-500">
                            <div className="flex items-center gap-2">
                              <span>{formatFileSize(file.size_bytes)}</span>
                              <span>•</span>
                              <span>{formatDate(file.updated_at || file.created_at)}</span>
                            </div>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/70">
                              <span className="h-1 w-1 rounded-full bg-emerald-500" />
                              Indexed
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* --- LIST VIEW --- */}
                {viewMode === "list" && (
                  <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs text-zinc-600">
                      <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">AI RAG Status</th>
                          <th className="px-4 py-3">Last Modified</th>
                          <th className="px-4 py-3">File Size</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {fileItems.map((file, fileIdx) => {
                          const isSelected = selectedItem?.id === file.id;
                          const details = getFileDetails(file.file_name, file.mime_type);

                          return (
                            <tr
                              key={`${file.id}-${fileIdx}`}
                              onClick={() => setSelectedItem(file)}
                              onDoubleClick={() => handlePreview(file)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? "bg-[#56C5D9]/10" : "hover:bg-zinc-50/80"
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${details.colorClass}`}
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="font-semibold text-zinc-900 truncate max-w-xs">
                                    {cleanDisplayName(file.file_name)}
                                  </span>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Vector Ready
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono text-zinc-500">
                                {formatDate(file.updated_at || file.created_at)}
                              </td>

                              <td className="px-4 py-3 font-mono text-zinc-500">
                                {formatFileSize(file.size_bytes)}
                              </td>

                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {activeTab === "trash" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRestore(file);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1b7a8b] hover:bg-[#56C5D9]/20 transition-colors"
                                        title="Restore file"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        <span>Restore</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPermanentDeleteTarget(file);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                        title="Delete permanently"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Delete</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => handlePreview(file, e)}
                                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-900"
                                        title="Preview file"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget(file);
                                        }}
                                        className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                        title="Move to trash"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>

        {/* ------------------------------------------------------
            COLUMN 3: RIGHT DETAILS / ACTIVITY INSPECTOR PANEL
            ------------------------------------------------------ */}
        {isInspectorOpen && (
          <aside className="w-80 shrink-0 border-l border-zinc-200/80 bg-white flex flex-col justify-between overflow-y-auto hidden lg:flex">
            <div>
              {/* Header & Tabs */}
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setInspectorTab("details")}
                    className={`text-xs font-semibold pb-1 transition-all ${
                      inspectorTab === "details"
                        ? "text-[#1b7a8b] border-b-2 border-[#56C5D9] font-bold"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("activity")}
                    className={`text-xs font-semibold pb-1 transition-all ${
                      inspectorTab === "activity"
                        ? "text-[#1b7a8b] border-b-2 border-[#56C5D9] font-bold"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Activity
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* DETAILS TAB */}
              {inspectorTab === "details" && (
                <div className="p-4 space-y-5">
                  {selectedItem ? (
                    <>
                      {/* Big Preview Banner */}
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 p-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-2xs border border-zinc-200/80 text-[#2ba8be]">
                          {selectedItem.is_folder ? (
                            <Folder className="h-7 w-7 text-amber-500 fill-amber-500/20" />
                          ) : (
                            <FileText className="h-7 w-7" />
                          )}
                        </div>
                        <h4 className="mt-3 text-xs font-bold text-zinc-900 break-all">
                          {selectedItem.file_name}
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          {selectedItem.is_folder
                            ? "Folder"
                            : formatFileSize(selectedItem.size_bytes)}
                        </p>
                      </div>

                      {/* Who has access */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Who has access
                        </span>
                        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5 text-xs text-zinc-700">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-900">You (Owner)</span>
                            <span className="text-[10px] text-zinc-500">
                              AI Assistant (RAG Enabled)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* System Properties */}
                      <div className="space-y-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          File details
                        </span>

                        <div className="divide-y divide-zinc-100 text-xs text-zinc-700">
                          <div className="flex justify-between py-2">
                            <span className="text-zinc-400">Type</span>
                            <span className="font-medium text-zinc-900">
                              {selectedItem.is_folder ? "Folder" : selectedItem.mime_type || "File"}
                            </span>
                          </div>

                          {!selectedItem.is_folder && (
                            <div className="flex justify-between py-2">
                              <span className="text-zinc-400">Size</span>
                              <span className="font-medium text-zinc-900 font-mono">
                                {formatFileSize(selectedItem.size_bytes)}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between py-2">
                            <span className="text-zinc-400">Location</span>
                            <span className="font-medium text-zinc-900 truncate max-w-[140px]">
                              {folderPath[folderPath.length - 1]?.name || "My Drive"}
                            </span>
                          </div>

                          <div className="flex justify-between py-2">
                            <span className="text-zinc-400">Created</span>
                            <span className="font-medium text-zinc-900">
                              {formatDate(selectedItem.created_at)}
                            </span>
                          </div>

                          <div className="flex justify-between py-2">
                            <span className="text-zinc-400">Modified</span>
                            <span className="font-medium text-zinc-900">
                              {formatDate(selectedItem.updated_at || selectedItem.created_at)}
                            </span>
                          </div>

                          <div className="flex justify-between py-2">
                            <span className="text-zinc-400">Vector Index</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Ready
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-2 flex flex-col gap-2">
                        {activeTab === "trash" ? (
                          <>
                            <div className="rounded-xl border border-red-200 bg-red-50/60 p-2.5 text-center text-xs font-medium text-red-700">
                              This item is in Trash
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRestore(selectedItem)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#56C5D9]/20 py-2.5 text-xs font-semibold text-[#1b7a8b] hover:bg-[#56C5D9]/30 transition-colors"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Restore {selectedItem.is_folder ? "Folder" : "File"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPermanentDeleteTarget(selectedItem)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/60 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Permanently</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {!selectedItem.is_folder && (
                              <button
                                type="button"
                                onClick={() => handlePreview(selectedItem)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Preview Document</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(selectedItem)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/60 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Move to Trash</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center text-zinc-400">
                      <Info className="mx-auto h-8 w-8 text-zinc-300" />
                      <p className="mt-2 text-xs font-semibold text-zinc-600">No item selected</p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        Click any file or folder to view its properties and vector indexing status.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY TAB */}
              {inspectorTab === "activity" && (
                <div className="p-4 space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Recent Activity
                  </span>

                  <div className="space-y-3">
                    {activityLog.map((act, actIdx) => (
                      <div
                        key={`${act.id}-${actIdx}`}
                        className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5 text-xs"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#56C5D9]/20 text-[#2ba8be]">
                          <Activity className="h-3 w-3" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-zinc-900">{act.action}</span>
                          <span className="truncate text-[11px] text-zinc-500">
                            {act.targetName}
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-0.5">{act.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf,image/*,.txt,.csv,.json,.md,.docx,.xlsx,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ========================================================
          CREATE FOLDER MODAL
          ======================================================== */}
      {showFolderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
          onClick={() => {
            if (!creatingFolder) setShowFolderModal(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <FolderPlus className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900">New Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-zinc-700">Folder Name</label>
              <input
                type="text"
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateFolder();
                }}
                placeholder="e.g. Research 2026, Financials..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#56C5D9] focus:outline-none focus:ring-2 focus:ring-[#56C5D9]/20 transition-all"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                disabled={creatingFolder}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder || !folderName.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                {creatingFolder ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MOVE TO TRASH CONFIRMATION MODAL
          ======================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
          onClick={() => {
            if (!deletingId) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-3.5 text-base font-bold text-zinc-900">
              Move {deleteTarget.is_folder ? "Folder" : "Document"} to Trash?
            </h3>

            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
              <span className="font-semibold text-zinc-900">"{deleteTarget.file_name}"</span>{" "}
              will be moved to Trash. You can restore it anytime from the Trash bin.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Moving...</span>
                  </>
                ) : (
                  <span>Move to Trash</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PERMANENT DELETE CONFIRMATION MODAL
          ======================================================== */}
      {permanentDeleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
          onClick={() => {
            if (!deletingId) setPermanentDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600 border border-red-200">
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-3.5 text-base font-bold text-zinc-900">
              Delete Permanently?
            </h3>

            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-zinc-900">"{permanentDeleteTarget.file_name}"</span>?
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPermanentDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePermanentDeleteConfirm()}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Forever</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EMPTY TRASH CONFIRMATION MODAL
          ======================================================== */}
      {showEmptyTrashModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
          onClick={() => {
            if (!deletingId) setShowEmptyTrashModal(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600 border border-red-200">
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-3.5 text-base font-bold text-zinc-900">
              Empty Trash Bin?
            </h3>

            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
              All <span className="font-bold text-zinc-900">{trashedItems.length} item(s)</span> in the trash bin will be permanently deleted and cannot be recovered.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowEmptyTrashModal(false)}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEmptyTrashConfirm()}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Emptying...</span>
                  </>
                ) : (
                  <span>Empty Trash</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DOCUMENT & PDF VIEWER MODAL
          ======================================================== */}
      {previewPdf.isOpen && (
        <PdfViewerModal
          isOpen={previewPdf.isOpen}
          onClose={() =>
            setPreviewPdf({
              isOpen: false,
              filename: "",
              documentId: null,
              file: null,
              url: null,
            })
          }
          filename={previewPdf.filename}
          documentId={previewPdf.documentId}
          file={previewPdf.file}
          url={previewPdf.url}
        />
      )}
    </div>
  );
}
