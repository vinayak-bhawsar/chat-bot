"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  ChevronRight,
  Eye,
  File,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
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

import { DocumentItem } from "@/types/documents";

import { useAuth } from "@/context/AuthContext";

interface DocumentsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface FolderPath {
  id: string | null;
  name: string;
}

export default function DocumentsPanel({
  open,
  onClose,
}: DocumentsPanelProps) {
  const {
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

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
      name: "Documents",
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
  // SELECTED DOCUMENT
  // ==============================================================

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = useState<string | null>(
    null
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

          setDocuments(
            response?.data?.items ??
            []
          );
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
        await uploadDocument({
          file,

          parent_id:
            currentFolderId,
        });
      }

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
  // SELECT DOCUMENT
  // ==============================================================

  const selectDocument = (
    item: DocumentItem
  ) => {
    // ------------------------------------------------------------
    // Never select folder
    // ------------------------------------------------------------

    if (item.is_folder) {
      return;
    }

    // ------------------------------------------------------------
    // Validate backend ID
    // ------------------------------------------------------------

    if (
      !item.id ||
      typeof item.id !==
      "string"
    ) {
      console.error(
        "Document does not contain a valid ID:",
        item
      );

      setError(
        "Unable to select this document because its ID is missing."
      );

      return;
    }

    // ------------------------------------------------------------
    // REAL BACKEND DOCUMENT ID
    // ------------------------------------------------------------

    const documentId =
      item.id.trim();

    // ------------------------------------------------------------
    // SAVE LOCALLY
    // ------------------------------------------------------------

    setSelectedDocumentId(
      documentId
    );

    if (typeof window !== "undefined") {
      localStorage.setItem("active_document_id", documentId);
      localStorage.setItem("active_document_name", item.file_name || "");
    }

    // ------------------------------------------------------------
    // EVENT PAYLOAD
    // ------------------------------------------------------------

    const detail = {
      id: documentId,

      file_name:
        item.file_name,

      is_folder:
        false,

      mime_type:
        item.mime_type,

      size_bytes:
        item.size_bytes,
    };

    // ------------------------------------------------------------
    // DEBUG
    // ------------------------------------------------------------

    console.log(
      "===================================="
    );

    console.log(
      "DOCUMENT SELECTED IN SIDEBAR:"
    );

    console.log(
      detail
    );

    console.log(
      "DOCUMENT ID:",
      documentId
    );

    console.log(
      "===================================="
    );

    // ------------------------------------------------------------
    // SEND TO MAIN CONTENT
    // ------------------------------------------------------------

    window.dispatchEvent(
      new CustomEvent(
        "document:select",
        {
          detail,
        }
      )
    );

    // ------------------------------------------------------------
    // CLOSE DOCUMENT SIDEBAR
    // ------------------------------------------------------------

    onClose();
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

        if (
          selectedDocumentId ===
          deleteTarget.id
        ) {
          setSelectedDocumentId(
            null
          );

          window.dispatchEvent(
            new CustomEvent(
              "document:select",
              {
                detail: null,
              }
            )
          );
        }

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
            HEADER
            ======================================================== */}

        <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-zinc-200/80 px-3.5 bg-white/70 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-2xs transition-colors"
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-zinc-900">
                  Knowledge Base
                </h2>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 border border-indigo-100 uppercase">
                  Docs
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-normal">
                Files indexed for AI Assistant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 transition-colors"
            aria-label="Close documents"
          >
            <X className="h-4 w-4" />
          </button>
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
          {/* ======================================================
              DRAG OVERLAY
              ====================================================== */}

          {dragging && (
            <div className="absolute inset-2 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-indigo-500 bg-white/95 shadow-lg">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-indigo-600 animate-bounce" />
                <p className="mt-2 text-sm font-bold text-zinc-900">
                  Drop PDF files here
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Instantly upload & index into Knowledge Base
                </p>
              </div>
            </div>
          )}

          {/* ======================================================
              TOOLBAR ACTIONS
              ====================================================== */}

          <div className="flex items-center gap-2 border-b border-zinc-200/80 px-3 py-2.5 bg-zinc-50/50">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Upload PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                setShowFolderModal(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-2xs transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-zinc-500" />
              <span>New Folder</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* ======================================================
              BREADCRUMB
              ====================================================== */}

          <div
            className="
              flex
              items-center
              gap-1
              overflow-x-auto
              border-b
              border-zinc-200
              px-3
              py-2
            "
          >
            {folderPath.map(
              (
                item,
                index
              ) => (
                <div
                  key={
                    item.id ??
                    "root"
                  }
                  className="flex shrink-0 items-center"
                >
                  {index > 0 && (
                    <ChevronRight className="mx-1 h-3 w-3 text-zinc-400" />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      navigateToPath(
                        index
                      )
                    }
                    className="
                      max-w-[120px]
                      truncate
                      text-[11px]
                      font-medium
                      text-zinc-600
                      hover:text-zinc-900
                    "
                  >
                    {
                      item.name
                    }
                  </button>
                </div>
              )
            )}
          </div>

          {/* ======================================================
              ERROR
              ====================================================== */}

          {error && (
            <div
              className="
                m-3
                flex
                items-start
                gap-2
                rounded-lg
                bg-red-50
                px-3
                py-2
                text-xs
                text-red-600
              "
            >
              <span className="flex-1">
                {error}
              </span>

              <button
                type="button"
                onClick={() =>
                  setError(
                    null
                  )
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ======================================================
              ITEMS
              ====================================================== */}

          <div
            className="
              min-h-0
              flex-1
              overflow-y-auto
              p-2
            "
          >
            {loading && (
              <div
                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  py-10
                  text-xs
                  text-zinc-500
                "
              >
                <Loader2 className="h-4 w-4 animate-spin" />

                Loading...
              </div>
            )}

            {!loading &&
              isAuthenticated &&
              documents.length ===
              0 && (
                <div
                  className="
                    flex
                    h-full
                    min-h-[250px]
                    flex-col
                    items-center
                    justify-center
                    rounded-xl
                    border-2
                    border-dashed
                    border-zinc-200
                    px-6
                    text-center
                  "
                >
                  <Folder className="h-10 w-10 text-zinc-300" />

                  <p className="mt-3 text-sm font-medium text-zinc-600">
                    No documents
                  </p>

                  <p className="mt-1 text-xs text-zinc-400">
                    Drag and drop files
                    here
                  </p>
                </div>
              )}

            {!loading &&
              documents.length >
              0 && (
                <div className="space-y-1.5">
                  {documents.map((item) => {
                    const isSelected =
                      !item.is_folder && selectedDocumentId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-150 ${
                          isSelected
                            ? "border-indigo-300 bg-white shadow-2xs"
                            : "border-zinc-200/70 bg-white/70 hover:border-zinc-300 hover:bg-white shadow-2xs"
                        }`}
                      >
                        {/* ICON */}
                        <div
                          className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg ${
                            item.is_folder
                              ? "bg-amber-500/10 text-amber-600 border border-amber-200/60"
                              : item.mime_type?.includes("pdf") || item.file_name.toLowerCase().endsWith(".pdf")
                              ? "bg-red-500/10 text-red-600 border border-red-200/60"
                              : "bg-blue-500/10 text-blue-600 border border-blue-200/60"
                          }`}
                        >
                          {item.is_folder ? (
                            <Folder className="h-4.5 w-4.5" />
                          ) : item.mime_type?.includes("pdf") || item.file_name.toLowerCase().endsWith(".pdf") ? (
                            <FileText className="h-4.5 w-4.5" />
                          ) : (
                            <File className="h-4.5 w-4.5" />
                          )}
                        </div>

                        {/* FILE / FOLDER INFO */}
                        <button
                          type="button"
                          onClick={() => {
                            if (item.is_folder) {
                              openFolder(item);
                              return;
                            }
                            selectDocument(item);
                          }}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                          title={
                            item.is_folder
                              ? "Open folder"
                              : "Select document for chat"
                          }
                        >
                          <span className="block truncate text-xs font-semibold text-zinc-900">
                            {item.file_name}
                          </span>

                          {!item.is_folder && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                              <span>{formatSize(item.size_bytes)}</span>
                              <span>•</span>
                              <span
                                className={
                                  isSelected
                                    ? "font-semibold text-indigo-600"
                                    : "text-zinc-500"
                                }
                              >
                                {isSelected ? "Active in Chat" : "Click to select"}
                              </span>
                            </div>
                          )}
                        </button>

                        {/* PREVIEW BUTTON */}
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
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-800 group-hover:opacity-100"
                            title="Preview Document"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        {/* DELETE BUTTON */}
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => setDeleteTarget(item)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                          title="Delete item"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ==========================================================
          CREATE FOLDER MODAL
          ========================================================== */}

      {showFolderModal && (
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
          "
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-2xl
              bg-white
              p-5
              shadow-2xl
            "
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">
                New Folder
              </h3>

              <button
                type="button"
                onClick={() =>
                  setShowFolderModal(
                    false
                  )
                }
              >
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>

            <input
              autoFocus
              value={
                folderName
              }
              onChange={(
                event
              ) =>
                setFolderName(
                  event.target.value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void handleCreateFolder();
                }
              }}
              placeholder="Folder name"
              className="
                mt-4
                w-full
                rounded-lg
                border
                border-zinc-300
                px-3
                py-2.5
                text-sm
                outline-none
                focus:border-zinc-500
              "
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFolderModal(
                    false
                  );

                  setFolderName(
                    ""
                  );
                }}
                className="
                  rounded-lg
                  border
                  border-zinc-300
                  px-4
                  py-2
                  text-sm
                "
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  creatingFolder ||
                  !folderName.trim()
                }
                onClick={() =>
                  void handleCreateFolder()
                }
                className="
                  rounded-lg
                  bg-zinc-900
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  disabled:opacity-50
                "
              >
                {creatingFolder
                  ? "Creating..."
                  : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          DELETE MODAL
          ========================================================== */}

      {deleteTarget && (
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
          "
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-2xl
              bg-white
              p-5
              shadow-2xl
            "
          >
            <h3 className="text-base font-semibold text-zinc-900">
              Delete{" "}
              {deleteTarget.is_folder
                ? "Folder"
                : "File"}
              ?
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want
              to delete "
              {
                deleteTarget.file_name
              }
              "?
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={
                  !!deletingId
                }
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                className="
                  rounded-lg
                  border
                  border-zinc-300
                  px-4
                  py-2
                  text-sm
                "
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  !!deletingId
                }
                onClick={() =>
                  void handleDelete()
                }
                className="
                  rounded-lg
                  bg-red-600
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  disabled:opacity-50
                "
              >
                {deletingId
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}