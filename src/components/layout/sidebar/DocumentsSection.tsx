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
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Trash2,
  Upload,
  X,
  Eye,
} from "lucide-react";

import {
  createFolder,
  deleteDocument,
  getDocuments,
  uploadDocument,
} from "@/lib/documents";

import { ApiError } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";
import { DocumentItem } from "@/types/documents";
import { useAuth } from "@/context/AuthContext";
import { cleanDisplayName } from "@/lib/fileTypes";

// ================================================================
// Props
// ================================================================

interface DocumentsSectionProps {
  collapsed: boolean;
  showText: boolean;
}

// ================================================================
// Folder path
// ================================================================

interface FolderPathItem {
  id: string | null;
  name: string;
}

// ================================================================
// Component
// ================================================================

export default function DocumentsSection({
  collapsed,
  showText,
}: DocumentsSectionProps) {
  const {
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ==============================================================
  // Documents open / closed
  // ==============================================================

  const [documentsOpen, setDocumentsOpen] =
    useState(false);

  // ==============================================================
  // Current folder
  // ==============================================================

  const [currentFolderId, setCurrentFolderId] =
    useState<string | null>(null);

  // ==============================================================
  // Folder path
  // ==============================================================

  const [folderPath, setFolderPath] =
    useState<FolderPathItem[]>([
      {
        id: null,
        name: "Knowledge Base",
      },
    ]);

  // ==============================================================
  // Current documents / folders
  // ==============================================================

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  // ==============================================================
  // Loading
  // ==============================================================

  const [isLoading, setIsLoading] =
    useState(false);

  // ==============================================================
  // Upload
  // ==============================================================

  const [isUploading, setIsUploading] =
    useState(false);

  // ==============================================================
  // Drag and drop
  // ==============================================================

  const [isDragging, setIsDragging] =
    useState(false);

  // ==============================================================
  // Create folder modal
  // ==============================================================

  const [showFolderModal, setShowFolderModal] =
    useState(false);

  const [folderName, setFolderName] =
    useState("");

  const [isCreatingFolder, setIsCreatingFolder] =
    useState(false);

  // ==============================================================
  // Delete
  // ==============================================================

  const [deleteTarget, setDeleteTarget] =
    useState<DocumentItem | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  // ==============================================================
  // Error
  // ==============================================================

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  // ==============================================================
  // File input
  // ==============================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  // ==============================================================
  // Error helper
  // ==============================================================

  const getErrorMessage = (
    error: unknown,
    fallback: string
  ): string => {
    return getLocalizedErrorMessage(error, fallback);
  };

  // ==============================================================
  // Load documents
  // ==============================================================

  const loadDocuments = useCallback(
    async (parentId: string | null) => {
      if (!isAuthenticated) {
        setDocuments([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

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

        // Only store/display global documents (conversation_id === null/undefined) and folders in Knowledge Base
        const knowledgeBaseDocs = allItems.filter(
          (item) => item.is_folder || !item.conversation_id || item.conversation_id === "null" || item.conversation_id === ""
        );

        setDocuments(knowledgeBaseDocs);
      } catch (error) {
        console.error(
          "Failed to load documents:",
          error
        );

        setDocuments([]);

        setErrorMessage(
          getErrorMessage(
            error,
            "Failed to load documents."
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  // ==============================================================
  // Load current folder
  // ==============================================================

  useEffect(() => {
    if (
      !documentsOpen ||
      collapsed ||
      !isAuthenticated ||
      authLoading
    ) {
      if (!isAuthenticated) {
        setDocuments([]);
      }
      return;
    }

    void loadDocuments(
      currentFolderId
    );
  }, [
    documentsOpen,
    collapsed,
    isAuthenticated,
    authLoading,
    currentFolderId,
    loadDocuments,
  ]);

  // ==============================================================
  // Auto-reload on documents:updated event
  // ==============================================================

  useEffect(() => {
    const handleDocumentsUpdated = () => {
      if (isAuthenticated) {
        void loadDocuments(currentFolderId);
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
  // Toggle documents
  // ==============================================================

  const toggleDocuments = () => {
    if (collapsed) {
      return;
    }

    setDocumentsOpen(
      (previous) => !previous
    );
  };

  // ==============================================================
  // Open folder
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
  // Navigate breadcrumb
  // ==============================================================

  const navigatePath = (
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
  // Open file picker
  // ==============================================================

  const openFilePicker = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  // ==============================================================
  // Upload files
  // ==============================================================

  const uploadFiles = async (
    files: File[]
  ) => {
    if (
      files.length === 0 ||
      isUploading
    ) {
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      // Upload each file into
      // the currently opened folder.
      for (const file of files) {
        const uploadedDoc = await uploadDocument({
          file,
          parent_id:
            currentFolderId,
        });

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
      }

      // Refresh current folder.
      await loadDocuments(
        currentFolderId
      );

      setTimeout(() => {
        void loadDocuments(currentFolderId);
      }, 1200);

      window.dispatchEvent(
        new CustomEvent(
          "documents:updated"
        )
      );
    } catch (error) {
      console.error(
        "Failed to upload files:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to upload files."
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ==============================================================
  // File input change
  // ==============================================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      Array.from(
        event.target.files ?? []
      );

    if (files.length === 0) {
      return;
    }

    void uploadFiles(files);

    // Allow selecting the same file again.
    event.target.value = "";
  };

  // ==============================================================
  // Drag enter
  // ==============================================================

  const handleDragEnter = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    setIsDragging(true);
  };

  // ==============================================================
  // Drag over
  // ==============================================================

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    event.dataTransfer.dropEffect =
      "copy";

    setIsDragging(true);
  };

  // ==============================================================
  // Drag leave
  // ==============================================================

  const handleDragLeave = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    /*
     * Only remove the drag state when
     * leaving the actual drop-zone.
     *
     * This prevents flickering when
     * moving over children.
     */
    if (
      event.currentTarget ===
      event.target
    ) {
      setIsDragging(false);
    }
  };

  // ==============================================================
  // Drop
  // ==============================================================

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    if (isUploading) {
      return;
    }

    const files =
      Array.from(
        event.dataTransfer.files
      );

    if (files.length === 0) {
      return;
    }

    void uploadFiles(files);
  };

  // ==============================================================
  // Create folder
  // ==============================================================

  const handleCreateFolder =
    async () => {
      const trimmedName =
        folderName.trim();

      if (
        !trimmedName ||
        isCreatingFolder
      ) {
        return;
      }

      try {
        setIsCreatingFolder(
          true
        );

        setErrorMessage(null);

        await createFolder({
          file_name:
            trimmedName,
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
      } catch (error) {
        console.error(
          "Failed to create folder:",
          error
        );

        setErrorMessage(
          getErrorMessage(
            error,
            "Failed to create folder."
          )
        );
      } finally {
        setIsCreatingFolder(
          false
        );
      }
    };

  // ==============================================================
  // Close folder modal
  // ==============================================================

  const closeFolderModal = () => {
    if (isCreatingFolder) {
      return;
    }

    setShowFolderModal(
      false
    );

    setFolderName("");
  };

  // ==============================================================
  // Request delete
  // ==============================================================

  const requestDelete = (
    item: DocumentItem
  ) => {
    setDeleteTarget(item);
  };

  // ==============================================================
  // Delete item
  // ==============================================================

  const handleDelete = async () => {
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

      setErrorMessage(null);

      await deleteDocument(
        deleteTarget.id
      );

      setDeleteTarget(null);

      await loadDocuments(
        currentFolderId
      );
    } catch (error) {
      console.error(
        "Failed to delete item:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to delete item."
        )
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==============================================================
  // File size
  // ==============================================================

  const formatFileSize = (
    bytes: number
  ): string => {
    if (
      !bytes ||
      bytes <= 0
    ) {
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

    const size =
      bytes /
      Math.pow(
        1024,
        index
      );

    return `${size.toFixed(
      index === 0
        ? 0
        : 1
    )} ${units[index]}`;
  };

  // ==============================================================
  // Item icon
  // ==============================================================

  const getItemIcon = (
    item: DocumentItem
  ) => {
    if (item.is_folder) {
      return (
        <Folder
          className="
            h-4
            w-4
            shrink-0
            text-zinc-600
          "
        />
      );
    }

    if (
      item.mime_type
        ?.toLowerCase()
        .includes("image") ||
      /\.(png|jpe?g|webp)$/i.test(item.file_name)
    ) {
      return (
        <ImageIcon
          className="
            h-4
            w-4
            shrink-0
            text-blue-500
          "
        />
      );
    }

    if (
      item.mime_type
        ?.toLowerCase()
        .includes("pdf") ||
      item.file_name.toLowerCase().endsWith(".pdf")
    ) {
      return (
        <FileText
          className="
            h-4
            w-4
            shrink-0
            text-zinc-500
          "
        />
      );
    }

    return (
      <File
        className="
          h-4
          w-4
          shrink-0
          text-zinc-500
        "
      />
    );
  };

  // ==============================================================
  // Collapsed sidebar
  // ==============================================================

  if (collapsed) {
    return (
      <div
        className="
          shrink-0
          px-3
          py-1
        "
      >
        <div
          className="
            flex
            h-10
            w-full
            items-center
            justify-center
            rounded-lg
            text-zinc-600
          "
          title="Documents"
        >
          <Folder
            className="
              h-5
              w-5
            "
          />
        </div>
      </div>
    );
  }

  // ==============================================================
  // Expanded sidebar
  // ==============================================================

  return (
    <>
      <section
        className="
          shrink-0
          px-3
          pt-2
        "
      >
        {/* ========================================================
            Documents Header
            ======================================================== */}

        <button
          type="button"
          onClick={
            toggleDocuments
          }
          className="
            flex
            w-full
            items-center
            gap-2
            rounded-lg
            px-2
            py-2
            text-left
            text-sm
            font-medium
            text-zinc-700
            transition
            hover:bg-zinc-200
            hover:text-zinc-900
          "
        >
          {documentsOpen ? (
            <ChevronDown
              className="
                h-4
                w-4
                shrink-0
              "
            />
          ) : (
            <ChevronRight
              className="
                h-4
                w-4
                shrink-0
              "
            />
          )}

          <Folder
            className="
              h-4
              w-4
              shrink-0
            "
          />

          {showText ? (
            <span>
              Documents
            </span>
          ) : null}
        </button>

        {/* ========================================================
            DOCUMENT AREA

            The complete area below the
            Documents header is a drop zone.

            Files dropped anywhere here
            are uploaded into the currently
            opened folder.
            ======================================================== */}

        {documentsOpen &&
          showText ? (
          <div
            onDragEnter={
              handleDragEnter
            }
            onDragOver={
              handleDragOver
            }
            onDragLeave={
              handleDragLeave
            }
            onDrop={
              handleDrop
            }
            className={`
              relative
              mt-1
              overflow-hidden
              rounded-lg
              border
              transition-all
              ${isDragging
                ? "border-zinc-900 bg-zinc-100 ring-2 ring-zinc-300"
                : "border-zinc-200 bg-white"
              }
            `}
          >
            {/* ==================================================
                Drag overlay
                ================================================== */}

            {isDragging ? (
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  z-20
                  flex
                  items-center
                  justify-center
                  rounded-lg
                  bg-white/90
                  backdrop-blur-sm
                "
              >
                <div
                  className="
                    text-center
                  "
                >
                  <Upload
                    className="
                      mx-auto
                      h-7
                      w-7
                      text-zinc-700
                    "
                  />

                  <p
                    className="
                      mt-2
                      text-xs
                      font-semibold
                      text-zinc-800
                    "
                  >
                    Drop files here
                  </p>

                  <p
                    className="
                      mt-1
                      text-[10px]
                      text-zinc-500
                    "
                  >
                    Files will be uploaded
                    to this folder
                  </p>
                </div>
              </div>
            ) : null}

            {/* ==================================================
                Breadcrumb
                ================================================== */}

            {folderPath.length > 1 ? (
              <div
                className="
                  flex
                  items-center
                  gap-1
                  overflow-x-auto
                  border-b
                  border-zinc-100
                  px-2
                  py-2
                  text-[10px]
                "
              >
                {folderPath.map(
                  (
                    path,
                    index
                  ) => (
                    <div
                      key={
                        path.id ??
                        "root"
                      }
                      className="
                        flex
                        shrink-0
                        items-center
                      "
                    >
                      {index > 0 ? (
                        <span
                          className="
                            px-1
                            text-zinc-400
                          "
                        >
                          /
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          navigatePath(
                            index
                          )
                        }
                        className={`
                          max-w-[90px]
                          truncate
                          ${index ===
                            folderPath.length -
                            1
                            ? "font-medium text-zinc-800"
                            : "text-zinc-500 hover:text-zinc-800"
                          }
                        `}
                      >
                        {
                          path.name
                        }
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : null}

            {/* ==================================================
                Toolbar
                ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-zinc-100
                px-2
                py-1.5
              "
            >
              <span
                className="
                  truncate
                  text-[10px]
                  text-zinc-400
                "
              >
                {currentFolderId
                  ? folderPath[
                    folderPath.length -
                    1
                  ]?.name ??
                  "Documents"
                  : "Documents"}
              </span>

              <div
                className="
                  flex
                  items-center
                  gap-0.5
                "
              >
                {/* New Folder */}

                <button
                  type="button"
                  title="New folder"
                  onClick={() =>
                    setShowFolderModal(
                      true
                    )
                  }
                  className="
                    rounded-md
                    p-1.5
                    text-zinc-500
                    hover:bg-zinc-100
                    hover:text-zinc-900
                  "
                >
                  <FolderPlus
                    className="
                      h-3.5
                      w-3.5
                    "
                  />
                </button>

                {/* Upload */}

                <button
                  type="button"
                  title="Upload"
                  onClick={
                    openFilePicker
                  }
                  disabled={
                    isUploading
                  }
                  className="
                    rounded-md
                    p-1.5
                    text-zinc-500
                    hover:bg-zinc-100
                    hover:text-zinc-900
                    disabled:opacity-50
                  "
                >
                  {isUploading ? (
                    <Loader2
                      className="
                        h-3.5
                        w-3.5
                        animate-spin
                      "
                    />
                  ) : (
                    <Upload
                      className="
                        h-3.5
                        w-3.5
                      "
                    />
                  )}
                </button>
              </div>
            </div>

            {/* ==================================================
                Hidden file input
                ================================================== */}

            <input
              ref={
                fileInputRef
              }
              type="file"
              multiple
              className="hidden"
              onChange={
                handleFileChange
              }
            />

            {/* ==================================================
                Loading
                ================================================== */}

            {isLoading ? (
              <div
                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  px-3
                  py-5
                  text-[11px]
                  text-zinc-500
                "
              >
                <Loader2
                  className="
                    h-3.5
                    w-3.5
                    animate-spin
                  "
                />

                Loading documents...
              </div>
            ) : null}

            {/* ==================================================
                Empty
                ================================================== */}

            {!isAuthenticated ? (
              <div className="px-3 py-5 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-zinc-800">
                  Sign in required
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 leading-snug">
                  Knowledge Base and file analysis require an account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/login";
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </button>
              </div>
            ) : !isLoading && documents.length === 0 ? (
              <div
                className="
                  px-3
                  py-7
                  text-center
                "
              >
                <Folder
                  className="
                    mx-auto
                    h-6
                    w-6
                    text-zinc-300
                  "
                />

                <p
                  className="
                    mt-2
                    text-[11px]
                    font-medium
                    text-zinc-500
                  "
                >
                  No files yet
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-zinc-400
                  "
                >
                  Drag files anywhere here
                </p>
              </div>
            ) : null}

            {/* ==================================================
                Files and folders
                ================================================== */}

            {!isLoading &&
              documents.length >
              0 ? (
              <div
                className="
                  max-h-64
                  overflow-y-auto
                  p-1
                "
              >
                {documents.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="
                        group
                        flex
                        items-center
                        gap-2
                        rounded-md
                        px-2
                        py-1.5
                        transition
                        hover:bg-zinc-100
                      "
                    >
                      {/* Item */}

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            item.is_folder
                          ) {
                            openFolder(
                              item
                            );
                          } else {
                            if (
                              typeof window !==
                              "undefined"
                            ) {
                              window.dispatchEvent(
                                new CustomEvent(
                                  "pdf:open",
                                  {
                                    detail: {
                                      id: item.id,
                                      documentId:
                                        item.id,
                                      filename:
                                        item.file_name,
                                    },
                                  }
                                )
                              );
                            }
                          }
                        }}
                        className="
                          flex
                          min-w-0
                          flex-1
                          items-center
                          gap-2
                          text-left
                          cursor-pointer
                        "
                      >
                        {getItemIcon(
                          item
                        )}

                        <span
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <span
                            className="
                              block
                              truncate
                              text-xs
                              text-zinc-700
                            "
                          >
                            {cleanDisplayName(item.file_name, item.is_folder ? "Folder" : "Document")}
                          </span>

                          {!item.is_folder ? (
                            <span
                              className="
                                block
                                text-[9px]
                                text-zinc-400
                              "
                            >
                              {formatFileSize(
                                item.size_bytes
                              )}
                            </span>
                          ) : null}
                        </span>
                      </button>

                      {/* Preview */}
                      {!item.is_folder && (
                        <button
                          type="button"
                          title="Preview PDF"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              typeof window !==
                              "undefined"
                            ) {
                              window.dispatchEvent(
                                new CustomEvent(
                                  "pdf:open",
                                  {
                                    detail: {
                                      id: item.id,
                                      documentId:
                                        item.id,
                                      filename:
                                        item.file_name,
                                    },
                                  }
                                )
                              );
                            }
                          }}
                          className="
                            shrink-0
                            rounded
                            p-1
                            text-zinc-400
                            opacity-0
                            transition
                            hover:bg-zinc-200
                            hover:text-zinc-700
                            group-hover:opacity-100
                          "
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}

                      {/* Delete */}

                      <button
                        type="button"
                        title="Delete"
                        disabled={
                          deletingId ===
                          item.id
                        }
                        onClick={() =>
                          requestDelete(
                            item
                          )
                        }
                        className="
                          shrink-0
                          rounded
                          p-1
                          text-zinc-400
                          opacity-0
                          transition
                          hover:bg-red-50
                          hover:text-red-600
                          group-hover:opacity-100
                          disabled:opacity-50
                        "
                      >
                        {deletingId ===
                          item.id ? (
                          <Loader2
                            className="
                              h-3
                              w-3
                              animate-spin
                            "
                          />
                        ) : (
                          <Trash2
                            className="
                              h-3
                              w-3
                            "
                          />
                        )}
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : null}

            {/* ==================================================
                Error
                ================================================== */}

            {errorMessage ? (
              <div
                className="
                  m-2
                  flex
                  items-start
                  gap-1
                  rounded-md
                  bg-red-50
                  px-2
                  py-2
                  text-[10px]
                  text-red-600
                "
              >
                <span
                  className="
                    flex-1
                  "
                >
                  {errorMessage}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setErrorMessage(
                      null
                    )
                  }
                  aria-label="Close error"
                >
                  <X
                    className="
                      h-3
                      w-3
                    "
                  />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ============================================================
          Create Folder Modal (Full Viewport Portal)
          ============================================================ */}

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
              if (!isCreatingFolder) {
                closeFolderModal();
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
              aria-labelledby="section-create-folder-title"
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
                  onClick={closeFolderModal}
                  disabled={isCreatingFolder}
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
                  id="section-create-folder-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  New Folder
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Create a folder inside{" "}
                  <span className="font-medium text-zinc-700">
                    {folderPath[folderPath.length - 1]?.name ?? "Documents"}
                  </span>
                  .
                </p>

                <input
                  type="text"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && folderName.trim() && !isCreatingFolder) {
                      event.preventDefault();
                      void handleCreateFolder();
                    } else if (event.key === "Escape" && !isCreatingFolder) {
                      closeFolderModal();
                    }
                  }}
                  placeholder="Folder name"
                  autoFocus
                  disabled={isCreatingFolder}
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
                  onClick={closeFolderModal}
                  disabled={isCreatingFolder}
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
                  onClick={() => void handleCreateFolder()}
                  disabled={isCreatingFolder || !folderName.trim()}
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
                  {isCreatingFolder ? (
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

      {/* ============================================================
          Delete Item Modal (Full Viewport Portal - Matches Main Sidebar)
          ============================================================ */}

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
              aria-labelledby="section-delete-document-title"
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
                  id="section-delete-document-title"
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