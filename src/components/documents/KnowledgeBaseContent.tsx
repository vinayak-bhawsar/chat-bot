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
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  Grid,
  HardDrive,
  Home,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  createFolder,
  deleteDocument,
  getDocuments,
  uploadDocument,
} from "@/lib/documents";

import { ApiError } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";
import { cleanDisplayName, getFileDetails } from "@/lib/fileTypes";
import { DocumentItem } from "@/types/documents";
import { useAuth } from "@/context/AuthContext";
import PdfViewerModal from "@/components/common/PdfViewerModal";

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

  // Navigation / Folder state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([
    {
      id: null,
      name: "Knowledge Base",
    },
  ]);

  // Documents & UI state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDF / Document preview
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getErrorMessage = (value: unknown, fallback: string) => {
    return getLocalizedErrorMessage(value, fallback);
  };

  // ==============================================================
  // LOAD DOCUMENTS
  // ==============================================================
  const loadDocuments = useCallback(
    async (parentId: string | null) => {
      if (!isAuthenticated) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await getDocuments(parentId, 1, 100, conversationId);
        const resAny = response as any;
        const allItems: DocumentItem[] =
          (Array.isArray(resAny?.data?.items) && resAny.data.items) ||
          (Array.isArray(resAny?.items) && resAny.items) ||
          (Array.isArray(resAny?.data) && resAny.data) ||
          (Array.isArray(resAny) && resAny) ||
          [];

        // Only store/display global documents (conversation_id === null/undefined) and folders in Knowledge Base
        const knowledgeBaseDocs = conversationId
          ? allItems.filter((item) => item.is_folder || item.conversation_id === conversationId)
          : allItems.filter(
              (item) =>
                item.is_folder ||
                !item.conversation_id ||
                item.conversation_id === "null" ||
                item.conversation_id === ""
            );

        setDocuments(knowledgeBaseDocs);
      } catch (err) {
        console.error("Failed to load documents:", err);
        setDocuments([]);
        setError(getErrorMessage(err, "Failed to load documents."));
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, conversationId]
  );

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      if (!isAuthenticated) {
        setDocuments([]);
      }
      return;
    }
    void loadDocuments(currentFolderId);
  }, [isAuthenticated, authLoading, currentFolderId, loadDocuments]);

  // Global documents updated event listener
  useEffect(() => {
    const handleDocumentsUpdated = () => {
      if (isAuthenticated) {
        void loadDocuments(currentFolderId);
      }
    };
    window.addEventListener("documents:updated", handleDocumentsUpdated);
    return () => {
      window.removeEventListener("documents:updated", handleDocumentsUpdated);
    };
  }, [isAuthenticated, currentFolderId, loadDocuments]);

  // ==============================================================
  // UPLOAD
  // ==============================================================
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return;

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
            conversation_id: conversationId,
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
                    totalChunks: typeof totalChunks === "number" ? totalChunks : item.totalChunks,
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
                    ? `${totalChunks} chunks processed • Ready`
                    : "Indexed • Ready",
                documentId: (uploadedDoc as any)?.id || (uploadedDoc as any)?.document_id,
              };
            })
          );

          if (uploadedDoc && (uploadedDoc.id || (uploadedDoc as any).document_id)) {
            const docId = uploadedDoc.id || (uploadedDoc as any).document_id;
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
                  mime_type: uploadedDoc.mime_type || file.type || "application/octet-stream",
                  size_bytes: uploadedDoc.size_bytes || file.size,
                  status: uploadedDoc.status || "ready",
                  conversation_id: uploadedDoc.conversation_id || null,
                  created_at: uploadedDoc.created_at || new Date().toISOString(),
                  updated_at: uploadedDoc.updated_at || new Date().toISOString(),
                },
                ...prev,
              ];
            });
          }

          setTimeout(() => {
            setUploadingItems((prev) => prev.filter((item) => item.id !== tempId));
          }, 2500);
        } catch (fileErr) {
          console.error(`Failed to upload ${file.name}:`, fileErr);
          setUploadingItems((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? { ...item, status: "error", statusMessage: "Upload failed" }
                : item
            )
          );
          setTimeout(() => {
            setUploadingItems((prev) => prev.filter((item) => item.id !== tempId));
          }, 3500);
        }
      }

      await loadDocuments(currentFolderId);
      setTimeout(() => {
        void loadDocuments(currentFolderId);
      }, 1200);

      window.dispatchEvent(new CustomEvent("documents:updated"));
    } catch (err) {
      console.error("Failed to upload document:", err);
      setError(getErrorMessage(err, "Failed to upload document."));
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    void uploadFiles(Array.from(files));
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    void uploadFiles(Array.from(files));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  // ==============================================================
  // FOLDER NAVIGATION
  // ==============================================================
  const openFolder = (folder: DocumentItem) => {
    if (!folder.is_folder) return;
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [
      ...prev,
      {
        id: folder.id,
        name: folder.file_name,
      },
    ]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = folderPath[index];
    if (!target) return;
    setCurrentFolderId(target.id);
    setFolderPath(folderPath.slice(0, index + 1));
  };

  const handleGoBack = () => {
    if (folderPath.length <= 1) return;
    const newPath = folderPath.slice(0, -1);
    const previous = newPath[newPath.length - 1];
    setFolderPath(newPath);
    setCurrentFolderId(previous?.id ?? null);
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

      const created = await createFolder({
        file_name: trimmed,
        parent_id: currentFolderId,
      });

      if (created && (created.id || (created as any).document_id)) {
        const folderId = created.id || (created as any).document_id;
        setDocuments((prev) => [
          {
            id: folderId,
            file_name: trimmed,
            user_id: created.user_id || "",
            parent_id: currentFolderId,
            is_folder: true,
            mime_type: "application/folder",
            size_bytes: 0,
            status: "ready",
            conversation_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

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
  // DELETE DOCUMENT OR FOLDER
  // ==============================================================
  const requestDelete = (item: DocumentItem) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;

    const idToDelete = deleteTarget.id;
    try {
      setDeletingId(idToDelete);
      setError(null);
      await deleteDocument(idToDelete);

      setDocuments((prev) => prev.filter((d) => d.id !== idToDelete));
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent("documents:updated"));
    } catch (err) {
      console.error("Failed to delete document:", err);
      setError(getErrorMessage(err, "Failed to delete item."));
    } finally {
      setDeletingId(null);
    }
  };

  // ==============================================================
  // PREVIEW
  // ==============================================================
  const handlePreview = (item: DocumentItem) => {
    setPreviewPdf({
      isOpen: true,
      filename: item.file_name,
      documentId: item.id,
      file: null,
      url: null,
    });
  };

  // Filter and sort items
  const filteredDocuments = useMemo(() => {
    let items = [...documents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((d) => d.file_name.toLowerCase().includes(q));
    }

    return items.sort((a, b) => {
      if (a.is_folder && !b.is_folder) return -1;
      if (!a.is_folder && b.is_folder) return 1;
      return a.file_name.localeCompare(b.file_name);
    });
  }, [documents, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const foldersCount = documents.filter((d) => d.is_folder).length;
    const filesCount = documents.filter((d) => !d.is_folder).length;
    const totalBytes = documents
      .filter((d) => !d.is_folder)
      .reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
    return {
      foldersCount,
      filesCount,
      totalBytes,
    };
  }, [documents]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-[#fafafa]">
      {/* ========================================================
          TOP ACTION BAR & HEADER
          ======================================================== */}
      <div className="sticky top-0 z-20 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          {/* Top Row: Title, Breadcrumbs & Main Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-2xs">
                  <Folder className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                      Knowledge Base
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      RAG Ready
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Upload and organize documents to index them for AI reasoning, citation, and search.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* NEW FOLDER BUTTON (Themed Clean White Button) */}
              <button
                type="button"
                onClick={() => setShowFolderModal(true)}
                className="group relative inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-2xs transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98]"
              >
                <div className="flex h-5 w-5 items-center justify-center shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 transition-transform duration-200 group-hover:scale-105">
                  <FolderPlus className="h-3.5 w-3.5 stroke-[2.25]" />
                </div>
                <span>New Folder</span>
              </button>

              {/* UPLOAD FILES BUTTON (Themed Clean White Button with Cyan/Turquoise Accent) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="group relative inline-flex items-center gap-2.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-2xs transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-5.5 w-5.5 items-center justify-center shrink-0 rounded-lg bg-[#56C5D9]/15 border border-[#56C5D9]/30 text-[#2ba8be] transition-transform duration-200 group-hover:scale-105">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 stroke-[2.25]" />
                  )}
                </div>
                <span className="font-semibold tracking-tight text-zinc-900">
                  {uploading ? "Uploading..." : "Upload Files"}
                </span>
                <span className="hidden sm:inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500 transition-colors group-hover:bg-zinc-200/60">
                  + File
                </span>
              </button>

              {/* REFRESH BUTTON */}
              <button
                type="button"
                onClick={() => loadDocuments(currentFolderId)}
                disabled={loading}
                title="Refresh Documents"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-500 shadow-2xs transition-all hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin text-zinc-800" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Sub Row: Breadcrumb Path, Search Bar & View Mode Toggle */}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-100">
            {/* Breadcrumb Path */}
            <div className="flex items-center gap-1 text-xs text-zinc-500 overflow-x-auto py-1">
              {folderPath.length > 1 && (
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors mr-1"
                  title="Go back one level"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="font-medium">Back</span>
                </button>
              )}

              {folderPath.map((item, idx) => {
                const isLast = idx === folderPath.length - 1;
                return (
                  <div key={item.id ?? "root"} className="flex items-center">
                    {idx > 0 && <ChevronRight className="h-3 w-3 mx-1 text-zinc-400 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => navigateToBreadcrumb(idx)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors truncate max-w-[160px] ${
                        isLast
                          ? "bg-zinc-100 font-semibold text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      {idx === 0 && <Home className="h-3 w-3 text-zinc-500" />}
                      <span className="truncate">{item.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right: Search + View Mode */}
            <div className="flex items-center gap-2.5">
              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files and folders..."
                  className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/50 pl-8 pr-7 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 transition-all focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Grid / Table Toggle */}
              <div className="flex items-center rounded-xl border border-zinc-200/90 bg-zinc-100/70 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-zinc-900 shadow-2xs font-medium"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  title="List Table View"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    viewMode === "table"
                      ? "bg-white text-zinc-900 shadow-2xs font-medium"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ========================================================
          MAIN SCROLLABLE CONTENT
          ======================================================== */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 space-y-6">
        {/* Error notification banner */}
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs text-red-700 shadow-2xs animate-in fade-in duration-200">
            <p className="flex-1 font-medium leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-red-500 hover:bg-red-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Statistics quick cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Documents</p>
              <p className="text-base font-bold tracking-tight text-zinc-900">
                {stats.filesCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Folder className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Folders</p>
              <p className="text-base font-bold tracking-tight text-zinc-900">
                {stats.foldersCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Storage Used</p>
              <p className="text-base font-bold tracking-tight text-zinc-900">
                {formatFileSize(stats.totalBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500">AI Search</p>
              <p className="text-xs font-semibold text-emerald-700">Indexed & Active</p>
            </div>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            dragging
              ? "border-[#56C5D9] bg-[#56C5D9]/5 scale-[1.005]"
              : "border-zinc-200/90 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-2xs"
          }`}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 transition-transform duration-200 group-hover:scale-105 group-hover:bg-[#56C5D9]/10 group-hover:text-[#2ba8be]">
            <Upload className="h-6 w-6 stroke-[1.75]" />
          </div>

          <div className="mt-3">
            <p className="text-sm font-semibold text-zinc-900">
              {dragging ? "Drop files to upload instantly" : "Click or drag & drop files here"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Supports PDF, DOCX, TXT, CSV, JSON, Markdown, Code, and Images up to 25MB
            </p>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {["PDF", "DOCX", "TXT", "CSV", "JSON", "MD", "Images"].map((badge) => (
              <span
                key={badge}
                className="rounded-md border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Active Uploading / Chunking Queue Cards */}
        {uploadingItems.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
                <span className="text-xs font-bold text-zinc-900">
                  Processing & Indexing ({uploadingItems.length})
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">Real-time embeddings</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {uploadingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-700">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-900">{item.filename}</p>
                        <p className="text-[11px] text-zinc-500">{formatFileSize(item.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </span>
                      ) : item.status === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {item.statusMessage || "Indexing..."}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.status === "completed"
                          ? "bg-emerald-500"
                          : item.status === "error"
                          ? "bg-red-500"
                          : "bg-gradient-to-r from-[#56C5D9] to-indigo-500"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white py-20 text-center shadow-2xs">
            <Loader2 className="h-8 w-8 animate-spin text-[#2ba8be]" />
            <p className="mt-3 text-sm font-semibold text-zinc-900">Loading Knowledge Base...</p>
            <p className="mt-1 text-xs text-zinc-500">Fetching documents, folders, and vector status</p>
          </div>
        )}

        {/* Unauthenticated State */}
        {!isAuthenticated && !authLoading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white p-12 text-center shadow-2xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
              <LogIn className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900">Sign in to access Knowledge Base</h3>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-500">
              You need an active session to upload, organize, and search knowledge documents.
            </p>
            <a
              href="/login"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
            >
              Sign In to Your Account
            </a>
          </div>
        )}

        {/* Empty State (No items in folder) */}
        {!loading && isAuthenticated && filteredDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-16 text-center shadow-2xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              {searchQuery ? <Search className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
            </div>
            <h3 className="mt-3 text-sm font-bold text-zinc-900">
              {searchQuery ? "No matching documents" : "No documents in this folder"}
            </h3>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">
              {searchQuery
                ? `No documents found matching "${searchQuery}". Try a different search term.`
                : "Upload files or create subfolders to start organizing your knowledge base."}
            </p>
            <div className="mt-5 flex items-center gap-2">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Clear Search
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(true)}
                    className="group inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-150 shadow-2xs active:scale-[0.98]"
                  >
                    <div className="flex h-5 w-5 items-center justify-center shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 transition-transform duration-200 group-hover:scale-105">
                      <FolderPlus className="h-3.5 w-3.5 stroke-[2.25]" />
                    </div>
                    <span>New Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group inline-flex items-center gap-2.5 rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-150 shadow-2xs active:scale-[0.98]"
                  >
                    <div className="flex h-5.5 w-5.5 items-center justify-center shrink-0 rounded-lg bg-[#56C5D9]/15 border border-[#56C5D9]/30 text-[#2ba8be] transition-transform duration-200 group-hover:scale-105">
                      <Upload className="h-3.5 w-3.5 stroke-[2.25]" />
                    </div>
                    <span className="font-semibold tracking-tight text-zinc-900">Upload Files</span>
                    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500 transition-colors group-hover:bg-zinc-200/60">
                      + File
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ======================================================
            GRID VIEW
            ====================================================== */}
        {!loading && isAuthenticated && filteredDocuments.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredDocuments.map((item) => {
              if (item.is_folder) {
                return (
                  <div
                    key={item.id}
                    onClick={() => openFolder(item)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 group-hover:scale-105 transition-transform">
                        <Folder className="h-5 w-5" />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(item);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                        title="Delete Folder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4">
                      <h4 className="truncate text-sm font-bold text-zinc-900 group-hover:text-amber-700 transition-colors">
                        {item.file_name}
                      </h4>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Folder</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              const details = getFileDetails(item.file_name, item.mime_type);
              const displayName = cleanDisplayName(item.file_name);

              return (
                <div
                  key={item.id}
                  onClick={() => handlePreview(item)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform ${details.colorClass}`}
                    >
                      {details.category === "pdf" ? (
                        <FileText className="h-5 w-5" />
                      ) : details.category === "code" ? (
                        <FileCode className="h-5 w-5" />
                      ) : details.category === "excel" ? (
                        <FileSpreadsheet className="h-5 w-5" />
                      ) : details.category === "archive" ? (
                        <FileArchive className="h-5 w-5" />
                      ) : details.category === "image" ? (
                        <ImageIcon className="h-5 w-5" />
                      ) : (
                        <File className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(item);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                        title="Preview Document"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(item);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4
                      className="truncate text-sm font-bold text-zinc-900 group-hover:text-[#2ba8be] transition-colors"
                      title={item.file_name}
                    >
                      {displayName}
                    </h4>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="font-mono">{formatFileSize(item.size_bytes)}</span>
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 uppercase">
                        {details.badge}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{formatDate(item.created_at)}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Ready
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======================================================
            TABLE / LIST VIEW
            ====================================================== */}
        {!loading && isAuthenticated && filteredDocuments.length > 0 && viewMode === "table" && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200/80 bg-zinc-50/70 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="hidden sm:table-cell px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="hidden md:table-cell px-4 py-3 font-semibold">Date Added</th>
                    <th className="hidden lg:table-cell px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredDocuments.map((item) => {
                    const isFolder = item.is_folder;
                    const details = isFolder
                      ? null
                      : getFileDetails(item.file_name, item.mime_type);
                    const displayName = cleanDisplayName(item.file_name);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => (isFolder ? openFolder(item) : handlePreview(item))}
                        className="group hover:bg-zinc-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                isFolder
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : details?.colorClass || "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                            >
                              {isFolder ? (
                                <Folder className="h-4 w-4" />
                              ) : details?.category === "pdf" ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <File className="h-4 w-4" />
                              )}
                            </div>
                            <span className="font-semibold text-zinc-900 truncate max-w-[240px] sm:max-w-[320px]">
                              {displayName}
                            </span>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell px-4 py-3 text-zinc-500">
                          {isFolder ? (
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                              Folder
                            </span>
                          ) : (
                            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 uppercase">
                              {details?.badge || "FILE"}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-zinc-600">
                          {isFolder ? "—" : formatFileSize(item.size_bytes)}
                        </td>

                        <td className="hidden md:table-cell px-4 py-3 text-zinc-500">
                          {formatDate(item.created_at)}
                        </td>

                        <td className="hidden lg:table-cell px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Ready
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isFolder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreview(item);
                                }}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete(item);
                              }}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <FolderPlus className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900">Create New Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                disabled={creatingFolder}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-zinc-700">Folder Name</label>
              <input
                type="text"
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleCreateFolder();
                  }
                }}
                placeholder="e.g., Financial Reports, Research 2026..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
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
                  <span>Create Folder</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-3.5 text-base font-bold text-zinc-900">
              Delete {deleteTarget.is_folder ? "Folder" : "Document"}
            </h3>

            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-zinc-900">"{deleteTarget.file_name}"</span>?
              {deleteTarget.is_folder && " All contained files and subfolders will also be removed."}
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
                onClick={() => void confirmDelete()}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors shadow-xs"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DOCUMENT PREVIEW MODAL
          ======================================================== */}
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
    </div>
  );
}
