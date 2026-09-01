"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  File,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  LogIn,
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
import { getFileDetails, cleanDisplayName } from "@/lib/fileTypes";

import { DocumentItem } from "@/types/documents";

import { useAuth } from "@/context/AuthContext";
import SidebarFooter from "./SidebarFooter";

interface DocumentsPanelProps {
  open: boolean;
  onClose: () => void;
}

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
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPanel({
  open,
  onClose,
}: DocumentsPanelProps) {
  const {
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ==============================================================
  // CURRENT FOLDER
  // ==============================================================

  const [
    currentFolderId,
    setCurrentFolderId,
  ] = useState<string | null>(
    null
  );

  // ==============================================================
  // FOLDER PATH
  // ==============================================================

  const [
    folderPath,
    setFolderPath,
  ] = useState<FolderPath[]>([
    {
      id: null,
      name: "Knowledge Base",
    },
  ]);

  // ==============================================================
  // DOCUMENTS
  // ==============================================================

  const [
    documents,
    setDocuments,
  ] = useState<DocumentItem[]>(
    []
  );

  // ==============================================================
  // ACTIVE UPLOADING / CHUNKING ITEMS
  // ==============================================================

  const [
    uploadingItems,
    setUploadingItems,
  ] = useState<UploadingItem[]>(
    []
  );

  // ==============================================================
  // LOADING
  // ==============================================================

  const [
    loading,
    setLoading,
  ] = useState(false);

  // ==============================================================
  // UPLOADING
  // ==============================================================

  const [
    uploading,
    setUploading,
  ] = useState(false);

  // ==============================================================
  // DRAGGING
  // ==============================================================

  const [
    dragging,
    setDragging,
  ] = useState(false);

  // ==============================================================
  // FOLDER MODAL
  // ==============================================================

  const [
    showFolderModal,
    setShowFolderModal,
  ] = useState(false);

  const [
    folderName,
    setFolderName,
  ] = useState("");

  const [
    creatingFolder,
    setCreatingFolder,
  ] = useState(false);

  // ==============================================================
  // DELETE
  // ==============================================================

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<DocumentItem | null>(
      null
    );

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  // ==============================================================
  // ERROR
  // ==============================================================

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  // ==============================================================
  // FILE INPUT
  // ==============================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  // ==============================================================
  // ERROR MESSAGE
  // ==============================================================

  const getErrorMessage = (
    value: unknown,
    fallback: string
  ) => {
    return getLocalizedErrorMessage(value, fallback);
  };

  // ==============================================================
  // LOAD DOCUMENTS
  // ==============================================================

  const loadDocuments =
    useCallback(
      async (
        parentId: string | null
      ) => {
        if (!isAuthenticated) {
          setDocuments([]);
          setLoading(false);

          return;
        }

        try {
          setLoading(true);
          setError(null);

          const response =
            await getDocuments(
              parentId,
              1,
              100
            );

          const resAny = response as any;
          const allItems: DocumentItem[] =
            (Array.isArray(resAny?.data?.items) && resAny.data.items) ||
            (Array.isArray(resAny?.items) && resAny.items) ||
            (Array.isArray(resAny?.data) && resAny.data) ||
            (Array.isArray(resAny) && resAny) ||
            [];

          console.log("KNOWLEDGE BASE RAW ITEMS:", allItems);

          // Only store/display global documents (conversation_id === null/undefined) and folders in Knowledge Base
          const knowledgeBaseDocs = allItems.filter(
            (item) => item.is_folder || !item.conversation_id || item.conversation_id === "null" || item.conversation_id === ""
          );

          setDocuments(knowledgeBaseDocs);
        } catch (err) {
          console.error(
            "Failed to load documents:",
            err
          );

          setDocuments([]);

          setError(
            getErrorMessage(
              err,
              "Failed to load documents."
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [isAuthenticated]
    );

  // ==============================================================
  // LOAD ON OPEN / FOLDER CHANGE
  // ==============================================================

  useEffect(() => {
    if (
      !open ||
      !isAuthenticated ||
      authLoading
    ) {
      if (
        !isAuthenticated
      ) {
        setDocuments([]);
      }

      return;
    }

    void loadDocuments(
      currentFolderId
    );
  }, [
    open,
    isAuthenticated,
    authLoading,
    currentFolderId,
    loadDocuments,
  ]);

  // ==============================================================
  // REFRESH WHEN DOCUMENTS CHANGE
  // ==============================================================

  useEffect(() => {
    const handleDocumentsUpdated =
      () => {
        if (
          isAuthenticated
        ) {
          void loadDocuments(
            currentFolderId
          );
        }
      };

    window.addEventListener(
      "documents:updated",
      handleDocumentsUpdated
    );

    return () => {
      window.removeEventListener(
        "documents:updated",
        handleDocumentsUpdated
      );
    };
  }, [
    isAuthenticated,
    currentFolderId,
    loadDocuments,
  ]);

  // ==============================================================
  // RESET DRAG / ERROR
  // ==============================================================

  useEffect(() => {
    if (open) {
      return;
    }

    setDragging(false);
    setError(null);
  }, [open]);

  // ==============================================================
  // UPLOAD
  // ==============================================================

  const uploadFiles = async (
    files: File[]
  ) => {
    if (
      files.length === 0 ||
      uploading
    ) {
      return;
    }

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

          console.log("KNOWLEDGE BASE UPLOADED DOC:", uploadedDoc);

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
                statusMessage: typeof totalChunks === "number" ? `${totalChunks} chunks processed • Ready` : "Indexed • Ready",
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
          }, 2000);
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
          }, 3000);
        }
      }

      await loadDocuments(
        currentFolderId
      );

      // Delayed refresh to capture background server indexing
      setTimeout(() => {
        void loadDocuments(currentFolderId);
      }, 1200);

      window.dispatchEvent(
        new CustomEvent(
          "documents:updated"
        )
      );
    } catch (err) {
      console.error(
        "Failed to upload document:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to upload document."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  // ==============================================================
  // FILE PICKER
  // ==============================================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      Array.from(
        event.target.files ?? []
      );

    if (files.length > 0) {
      void uploadFiles(files);
    }

    event.target.value = "";
  };

  // ==============================================================
  // DRAG ENTER
  // ==============================================================

  const handleDragEnter = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (uploading) {
      return;
    }

    setDragging(true);
  };

  // ==============================================================
  // DRAG OVER
  // ==============================================================

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (uploading) {
      return;
    }

    event.dataTransfer.dropEffect =
      "copy";

    setDragging(true);
  };

  // ==============================================================
  // DRAG LEAVE
  // ==============================================================

  const handleDragLeave = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      event.currentTarget ===
      event.target
    ) {
      setDragging(false);
    }
  };

  // ==============================================================
  // DROP
  // ==============================================================

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);

    if (!isAuthenticated) {
      setError(
        "Please sign in to upload documents."
      );

      return;
    }

    if (uploading) {
      return;
    }

    const files =
      Array.from(
        event.dataTransfer.files
      );

    if (files.length > 0) {
      void uploadFiles(files);
    }
  };

  // ==============================================================
  // CREATE FOLDER
  // ==============================================================

  const handleCreateFolder =
    async () => {
      const name =
        folderName.trim();

      if (
        !name ||
        creatingFolder
      ) {
        return;
      }

      try {
        setCreatingFolder(
          true
        );

        setError(null);

        await createFolder({
          file_name: name,

          parent_id:
            currentFolderId,
        });

        setFolderName("");

        setShowFolderModal(
          false
        );

        await loadDocuments(
          currentFolderId
        );

        window.dispatchEvent(
          new CustomEvent(
            "documents:updated"
          )
        );
      } catch (err) {
        console.error(
          "Failed to create folder:",
          err
        );

        setError(
          getErrorMessage(
            err,
            "Failed to create folder."
          )
        );
      } finally {
        setCreatingFolder(
          false
        );
      }
    };

  // ==============================================================
  // OPEN FOLDER
  // ==============================================================

  const openFolder = (
    item: DocumentItem
  ) => {
    if (!item.is_folder) {
      return;
    }

    setCurrentFolderId(
      item.id
    );

    setFolderPath(
      (previous) => [
        ...previous,
        {
          id: item.id,
          name: item.file_name,
        },
      ]
    );
  };

  // ==============================================================
  // BREADCRUMB
  // ==============================================================

  const navigateToPath = (
    index: number
  ) => {
    const target =
      folderPath[index];

    if (!target) {
      return;
    }

    setCurrentFolderId(
      target.id
    );

    setFolderPath(
      (previous) =>
        previous.slice(
          0,
          index + 1
        )
    );
  };

  // ==============================================================
  // DELETE
  // ==============================================================

  const handleDelete =
    async () => {
      if (
        !deleteTarget ||
        deletingId
      ) {
        return;
      }

      try {
        setDeletingId(
          deleteTarget.id
        );

        setError(null);

        await deleteDocument(
          deleteTarget.id
        );

        setDeleteTarget(
          null
        );

        await loadDocuments(
          currentFolderId
        );

        window.dispatchEvent(
          new CustomEvent(
            "documents:updated"
          )
        );
      } catch (err) {
        console.error(
          "Failed to delete:",
          err
        );

        setError(
          getErrorMessage(
            err,
            "Failed to delete item."
          )
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  // ==============================================================
  // FORMAT SIZE
  // ==============================================================

  const formatSize = (
    bytes: number
  ) => {
    if (!bytes) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index =
      Math.min(
        Math.floor(
          Math.log(bytes) /
          Math.log(1024)
        ),
        units.length - 1
      );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  };

  // ==============================================================
  // DON'T RENDER
  // ==============================================================

  if (!open) {
    return null;
  }

  // ==============================================================
  // RENDER
  // ==============================================================

  return (
    <>
      <div className="flex h-full w-full flex-col bg-[#f7f7f8]">
        {/* ========================================================
            HEADER (Identical Structure to Main Sidebar Header)
            ======================================================== */}

        <div className="shrink-0 border-b border-zinc-200/80 px-3 py-3.5 space-y-2.5 bg-[#f7f7f8]">
          {/* TOP ROW: Back button + Title & RAG Badge + Close */}
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-2xs transition-transform duration-200 hover:scale-105"
                aria-label="Back to chats"
                title="Back to chats"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-bold tracking-tight text-zinc-900 truncate">
                    Knowledge Base
                  </h2>
                  <span className="rounded-md bg-[#56C5D9]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#2ba8be] border border-[#56C5D9]/25 uppercase">
                    RAG
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-normal">
                  Document Index & Search
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
              aria-label="Close Knowledge Base"
              title="Close Knowledge Base"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* ACTION BUTTON 1: Upload File (Full-Width White Button matching New Chat) */}
          <div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="group relative flex w-full items-center overflow-hidden rounded-xl font-medium transition-all duration-200 border border-zinc-200/90 bg-white text-zinc-900 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] gap-2.5 px-3 py-2.5 text-sm disabled:opacity-50"
            >
              <div className="flex h-6 w-6 items-center justify-center shrink-0 rounded-lg bg-[#56C5D9]/10 border border-[#56C5D9]/25 text-[#2ba8be] transition-transform duration-200 group-hover:scale-105">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
              </div>

              <span className="flex-1 text-left text-[13px] font-semibold tracking-tight text-zinc-900">
                Upload Document
              </span>

              <span className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500 transition-colors group-hover:bg-zinc-200/60">
                + File
              </span>
            </button>
          </div>

          {/* ACTION BUTTON 2: New Folder (Full-Width White Button matching Knowledge Base) */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                setShowFolderModal(true);
              }}
              className="flex w-full items-center rounded-xl text-xs font-medium transition-all duration-150 border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 shadow-2xs gap-2.5 px-3 py-2 active:scale-[0.98]"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                <FolderPlus className="h-3.5 w-3.5" />
              </div>

              <span className="flex-1 text-left font-medium text-zinc-800">
                New Folder
              </span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf,image/*,.txt,.csv,.json,.md,.docx,.xlsx,.pptx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ========================================================
            DROP ZONE & CONTENT
            ======================================================== */}

        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative flex min-h-0 flex-1 flex-col"
        >
          {/* DRAG OVERLAY */}
          {dragging && (
            <div className="absolute inset-2 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#56C5D9] bg-white/95 shadow-lg">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-[#2ba8be] animate-bounce" />
                <p className="mt-2 text-sm font-bold text-zinc-900">
                  Drop files here
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Instantly upload & index into Knowledge Base
                </p>
              </div>
            </div>
          )}

          {/* BREADCRUMB */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200/80 bg-zinc-50/50 px-3 py-1.5">
            {folderPath.map((item, index) => (
              <div key={item.id ?? "root"} className="flex shrink-0 items-center">
                {index > 0 && (
                  <ChevronRight className="mx-1 h-3 w-3 text-zinc-400" />
                )}

                <button
                  type="button"
                  onClick={() => navigateToPath(index)}
                  className={`max-w-[120px] truncate text-[11px] font-medium transition-colors ${
                    index === folderPath.length - 1
                      ? "text-zinc-900 font-semibold"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {item.name}
                </button>
              </div>
            ))}
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="m-2 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-100">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ======================================================
              SECTION TITLE (Matches Recent Chats Header)
              ====================================================== */}
          <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Knowledge Files
            </p>
            {isAuthenticated && documents.length > 0 && (
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-200/70 px-1.5 py-0.2 rounded-full">
                {documents.length}
              </span>
            )}
          </div>

          {/* ======================================================
              ITEMS LIST
              ====================================================== */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
                <span>Loading files...</span>
              </div>
            )}

            {/* Unauthenticated / Guest Mode */}
            {!loading && !isAuthenticated && (
              <div className="mx-1 my-2 rounded-xl border border-dashed border-zinc-200 bg-white/60 p-3 text-center shadow-2xs">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#56C5D9]/10 text-[#2ba8be] border border-[#56C5D9]/25">
                  <Folder className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-zinc-800">
                  Sign In Required
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 leading-snug">
                  Knowledge Base storage and document indexing require an account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/login";
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition-all active:scale-[0.98]"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In to Continue</span>
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && isAuthenticated && documents.length === 0 && uploadingItems.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-zinc-400">
                <Folder className="h-6 w-6 mx-auto text-zinc-300 mb-1.5 opacity-60" />
                <p className="font-medium text-zinc-600">No files in this folder</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Upload files or drag & drop here
                </p>
              </div>
            )}

            {/* Active Uploading / Chunking Items (Exact same to same as ChatInput) */}
            {!loading &&
              uploadingItems.map((uItem) => {
                const fileDetails = getFileDetails(
                  uItem.filename,
                  uItem.mimeType
                );
                const isProcessing = uItem.status === "uploading" || uItem.status === "chunking";
                const isDone = uItem.status === "completed";
                const isErr = uItem.status === "error";
                const chunks = uItem.chunks;
                const totalChunks = uItem.totalChunks;
                const progressPercent = Math.min(Math.max(uItem.progress || 25, 10), 100);

                const renderFileTypeIcon = () => {
                  switch (fileDetails.category) {
                    case "image":
                      return <ImageIcon className="h-4.5 w-4.5" />;
                    case "code":
                      return <FileCode className="h-4.5 w-4.5" />;
                    case "excel":
                      return <FileSpreadsheet className="h-4.5 w-4.5" />;
                    case "archive":
                      return <FileArchive className="h-4.5 w-4.5" />;
                    case "text":
                    case "pdf":
                    case "word":
                    case "powerpoint":
                    default:
                      return <FileText className="h-4.5 w-4.5" />;
                  }
                };

                // Circle math: r=15, circumference = 2 * PI * 15 ≈ 94.25
                const circumference = 94.25;
                const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

                return (
                  <div
                    key={uItem.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("pdf:open", {
                            detail: {
                              filename: uItem.filename,
                              documentId: uItem.documentId || null,
                              file: uItem.file || null,
                            },
                          })
                        );
                      }
                    }}
                    className="group relative mb-2 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-2 sm:px-3 sm:py-2 transition-all hover:bg-zinc-100/90 shadow-2xs cursor-pointer max-w-full"
                    title="Click to preview document"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* ChatGPT-style Icon with Radial Progress Ring */}
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                        {isProcessing ? (
                          <>
                            {/* SVG Circular Progress Track & Fill */}
                            <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="15"
                                className="stroke-zinc-200 fill-none"
                                strokeWidth="2.5"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="15"
                                className="stroke-[#56C5D9] fill-none transition-all duration-300 ease-out"
                                strokeWidth="2.5"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-[#56C5D9]/10 text-[#0e879c]">
                              {renderFileTypeIcon()}
                            </div>
                          </>
                        ) : isErr ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                            <X className="h-4.5 w-4.5" />
                          </div>
                        ) : (
                          <div
                            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                              uItem.documentId
                                ? "border-emerald-200/80 bg-emerald-50 text-emerald-600"
                                : fileDetails.colorClass
                            }`}
                          >
                            {renderFileTypeIcon()}
                            {uItem.documentId && (
                              <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* File Details & Live Status */}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
                          {cleanDisplayName(uItem.filename, "Document")}
                        </p>

                        <p className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">
                          {isProcessing
                            ? uItem.statusMessage ||
                              (chunks && totalChunks
                                ? `Chunk ${chunks}/${totalChunks}...`
                                : chunks
                                ? `Chunk ${chunks}...`
                                : `Processing...`)
                            : isErr
                            ? "Failed to upload"
                            : chunks
                            ? `${fileDetails.label.toUpperCase()} · ${chunks} chunks`
                            : uItem.size
                            ? `${fileDetails.label.toUpperCase()} · ${formatFileSize(uItem.size)}`
                            : uItem.documentId
                            ? `${fileDetails.label.toUpperCase()} · Ready`
                            : `${fileDetails.label} attached`}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Preview */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("pdf:open", {
                                detail: {
                                  filename: uItem.filename,
                                  documentId: uItem.documentId || null,
                                  file: uItem.file || null,
                                },
                              })
                            );
                          }
                        }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200/80 hover:text-zinc-900 cursor-pointer"
                        title={`Open and preview ${fileDetails.label.toLowerCase()}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* Document / Folder Cards */}
            {!loading &&
              documents.length > 0 &&
              documents.map((item) => {
                return (
                  <div key={item.id} className="group relative">
                    <div
                      className="flex w-full items-center rounded-xl px-2.5 py-2 text-left text-xs transition-all duration-150 border border-transparent text-zinc-600 hover:bg-white hover:border-zinc-200/70 hover:text-zinc-900 hover:shadow-2xs"
                    >
                      {/* ICON */}
                      <div className="shrink-0 mr-2.5">
                        {(() => {
                          if (item.is_folder) {
                            return (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                                <Folder className="h-3.5 w-3.5" />
                              </div>
                            );
                          }
                          const details = getFileDetails(
                            item.file_name,
                            item.mime_type
                          );
                          const renderFileIcon = () => {
                            switch (details.category) {
                              case "image":
                                return <ImageIcon className="h-3.5 w-3.5" />;
                              case "code":
                                return <FileCode className="h-3.5 w-3.5" />;
                              case "excel":
                                return (
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                );
                              case "archive":
                                return <FileArchive className="h-3.5 w-3.5" />;
                              case "text":
                              case "pdf":
                              case "word":
                              case "powerpoint":
                              default:
                                return <FileText className="h-3.5 w-3.5" />;
                            }
                          };
                          return (
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${details.colorClass}`}
                            >
                              {renderFileIcon()}
                            </div>
                          );
                        })()}
                      </div>

                      {/* FILE / FOLDER INFO */}
                      <button
                        type="button"
                        onClick={() => {
                          if (item.is_folder) {
                            openFolder(item);
                            return;
                          }
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("pdf:open", {
                                detail: {
                                  id: item.id,
                                  documentId: item.id,
                                  filename: item.file_name,
                                },
                              })
                            );
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        title={
                          item.is_folder
                            ? "Open folder"
                            : "Preview document"
                        }
                      >
                        <span className="block truncate text-xs font-semibold text-zinc-900">
                          {cleanDisplayName(item.file_name, item.is_folder ? "Folder" : "Document")}
                        </span>

                        {!item.is_folder && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <span>{formatSize(item.size_bytes)}</span>
                            <span>•</span>
                            <span className="text-zinc-500">
                              Ready
                            </span>
                          </div>
                        )}
                      </button>

                      {/* ACTIONS: Preview & Delete (Revealed on Hover) */}
                      <div className="flex items-center gap-0.5">
                        {!item.is_folder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(
                                  new CustomEvent("pdf:open", {
                                    detail: {
                                      id: item.id,
                                      documentId: item.id,
                                      filename: item.file_name,
                                    },
                                  })
                                );
                              }
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-900 transition-all"
                            title="Preview Document"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => setDeleteTarget(item)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                          title="Delete item"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* FOOTER */}
        <SidebarFooter collapsed={false} showText={true} />
      </div>

      {/* ==========================================================
          CREATE FOLDER MODAL (Full Viewport Portal)
          ========================================================== */}

      {isMounted &&
        showFolderModal &&
        createPortal(
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
              animate-in
              fade-in
              duration-150
            "
            onClick={() => {
              if (!creatingFolder) {
                setShowFolderModal(false);
                setFolderName("");
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
                animate-in
                zoom-in-95
                duration-150
              "
              onClick={(event) => {
                event.stopPropagation();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-folder-title"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-[#56C5D9]/15
                    text-[#2ba8be]
                    border
                    border-[#56C5D9]/30
                  "
                >
                  <FolderPlus className="h-5 w-5" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowFolderModal(false);
                    setFolderName("");
                  }}
                  disabled={creatingFolder}
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
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="mt-4">
                <h2
                  id="create-folder-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  New Folder
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Create a folder inside{" "}
                  <span className="font-medium text-zinc-700">
                    {folderPath[folderPath.length - 1]?.name ?? "Knowledge Base"}
                  </span>
                  .
                </p>

                <input
                  autoFocus
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && folderName.trim() && !creatingFolder) {
                      event.preventDefault();
                      void handleCreateFolder();
                    } else if (event.key === "Escape" && !creatingFolder) {
                      setShowFolderModal(false);
                      setFolderName("");
                    }
                  }}
                  placeholder="Folder name"
                  disabled={creatingFolder}
                  className="
                    mt-4
                    w-full
                    rounded-xl
                    border
                    border-zinc-300
                    px-3.5
                    py-2.5
                    text-sm
                    text-zinc-900
                    placeholder:text-zinc-400
                    outline-none
                    transition
                    focus:border-[#2ba8be]
                    focus:ring-2
                    focus:ring-[#56C5D9]/20
                    disabled:bg-zinc-50
                    disabled:text-zinc-400
                  "
                />
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFolderModal(false);
                    setFolderName("");
                  }}
                  disabled={creatingFolder}
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
                  disabled={creatingFolder || !folderName.trim()}
                  onClick={() => void handleCreateFolder()}
                  className="
                    flex
                    min-w-[90px]
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    bg-zinc-900
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    transition
                    hover:bg-zinc-800
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {creatingFolder ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ==========================================================
          DELETE MODAL (Full Viewport Portal - Matches Main Sidebar)
          ========================================================== */}

      {isMounted &&
        deleteTarget &&
        createPortal(
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
              animate-in
              fade-in
              duration-150
            "
            onClick={() => {
              if (!deletingId) {
                setDeleteTarget(null);
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
                animate-in
                zoom-in-95
                duration-150
              "
              onClick={(event) => {
                event.stopPropagation();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-document-title"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
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
                  <Trash2 className="h-5 w-5" />
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={!!deletingId}
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
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="mt-4">
                <h2
                  id="delete-document-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Delete {deleteTarget.is_folder ? "folder" : "document"}?
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-zinc-700">
                    &quot;{deleteTarget.file_name}&quot;
                  </span>
                  ?
                </p>

                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  {deleteTarget.is_folder
                    ? "This folder and all its contents will be permanently deleted."
                    : "This document will be permanently deleted from your Knowledge Base."}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={!!deletingId}
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
                  onClick={() => void handleDelete()}
                  disabled={!!deletingId}
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
                  {deletingId ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}