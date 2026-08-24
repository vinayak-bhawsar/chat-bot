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
  File,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
  Eye,
} from "lucide-react";

import PdfViewerModal from "@/components/common/PdfViewerModal";

import {
  createFolder,
  deleteDocument,
  getDocuments,
  uploadDocument,
} from "@/lib/documents";

import {
  ApiError,
} from "@/lib/api";

import {
  getLocalizedErrorMessage,
} from "@/i18n";

import {
  DocumentItem,
} from "@/types/documents";

import { useAuth } from "@/context/AuthContext";

// ================================================================
// Breadcrumb type
// ================================================================

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

// ================================================================
// Props
// ================================================================

interface DocumentsPageProps {
  conversationId?: string | null;
}

// ================================================================
// Component
// ================================================================

export default function DocumentsPage({
  conversationId = null,
}: DocumentsPageProps) {
  const {
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  // ==============================================================
  // Current folder
  // ==============================================================

  const [
    currentFolderId,
    setCurrentFolderId,
  ] = useState<string | null>(null);

  // ==============================================================
  // Current folder name
  // ==============================================================

  const [
    currentFolderName,
    setCurrentFolderName,
  ] = useState("Documents");

  // ==============================================================
  // Breadcrumbs
  // ==============================================================

  const [
    breadcrumbs,
    setBreadcrumbs,
  ] = useState<BreadcrumbItem[]>([
    {
      id: null,
      name: "Documents",
    },
  ]);

  // ==============================================================
  // Documents
  // ==============================================================

  const [
    documents,
    setDocuments,
  ] = useState<DocumentItem[]>([]);

  // ==============================================================
  // Loading
  // ==============================================================

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  // ==============================================================
  // Upload state
  // ==============================================================

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  // ==============================================================
  // Drag state
  // ==============================================================

  const [
    isDragging,
    setIsDragging,
  ] = useState(false);

  // ==============================================================
  // Create folder modal
  // ==============================================================

  const [
    showCreateFolder,
    setShowCreateFolder,
  ] = useState(false);

  const [
    folderName,
    setFolderName,
  ] = useState("");

  const [
    isCreatingFolder,
    setIsCreatingFolder,
  ] = useState(false);

  // ==============================================================
  // Delete state
  // ==============================================================

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<DocumentItem | null>(
    null
  );

  // ==============================================================
  // PDF Preview Modal
  // ==============================================================

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

  const handlePreviewPdf = (item: DocumentItem) => {
    setPreviewPdf({
      isOpen: true,
      filename: item.file_name,
      documentId: item.id,
      file: null,
      url: null,
    });
  };

  useEffect(() => {
    const handlePdfOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{
        filename?: string;
        file_name?: string;
        name?: string;
        documentId?: string | null;
        id?: string | null;
        file?: File | null;
        url?: string | null;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      setPreviewPdf({
        isOpen: true,
        filename:
          detail.filename ||
          detail.file_name ||
          detail.name ||
          detail.file?.name ||
          "document.pdf",
        documentId: detail.documentId || detail.id || null,
        file: detail.file || null,
        url: detail.url || null,
      });
    };

    window.addEventListener("pdf:open", handlePdfOpen);
    return () => window.removeEventListener("pdf:open", handlePdfOpen);
  }, []);

  // ==============================================================
  // Error
  // ==============================================================

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  // ==============================================================
  // File input
  // ==============================================================

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  // ==============================================================
  // Load documents
  // ==============================================================

  const loadDocuments =
    useCallback(
      async (
        folderId: string | null
      ) => {
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
              folderId,
              1,
              100
            );

          /*
           * Backend response:
           *
           * {
           *   success: true,
           *   data: {
           *     items: [...]
           *   }
           * }
           */

          const items =
            response?.data?.items ??
            [];

          setDocuments(items);
        } catch (error) {
          console.error(
            "Failed to load documents:",
            error
          );

          setErrorMessage(
            getLocalizedErrorMessage(
              error,
              "Failed to load documents."
            )
          );

          setDocuments([]);
        } finally {
          setIsLoading(false);
        }
      },
      [isAuthenticated]
    );

  // ==============================================================
  // Initial load / folder change
  // ==============================================================

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      if (!isAuthenticated) {
        setDocuments([]);
      }
      return;
    }

    loadDocuments(
      currentFolderId
    );
  }, [
    isAuthenticated,
    authLoading,
    currentFolderId,
    loadDocuments,
  ]);

  // ==============================================================
  // Open folder
  // ==============================================================

  const openFolder = (
    folder: DocumentItem
  ) => {
    if (!folder.is_folder) {
      return;
    }

    setCurrentFolderId(
      folder.id
    );

    setCurrentFolderName(
      folder.file_name
    );

    setBreadcrumbs(
      (previous) => [
        ...previous,
        {
          id: folder.id,
          name: folder.file_name,
        },
      ]
    );
  };

  // ==============================================================
  // Navigate breadcrumb
  // ==============================================================

  const navigateToBreadcrumb = (
    index: number
  ) => {
    const target =
      breadcrumbs[index];

    if (!target) {
      return;
    }

    setCurrentFolderId(
      target.id
    );

    setCurrentFolderName(
      target.name
    );

    setBreadcrumbs(
      breadcrumbs.slice(
        0,
        index + 1
      )
    );
  };

  // ==============================================================
  // Go to root
  // ==============================================================

  const goToRoot = () => {
    setCurrentFolderId(null);

    setCurrentFolderName(
      "Documents"
    );

    setBreadcrumbs([
      {
        id: null,
        name: "Documents",
      },
    ]);
  };

  // ==============================================================
  // Select files
  // ==============================================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    void handleUpload(
      Array.from(files)
    );

    /*
     * Clear input so the same file can
     * be selected again later.
     */

    event.target.value = "";
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

  const handleUpload = async (
    files: File[]
  ) => {
    if (
      !files ||
      files.length === 0
    ) {
      return;
    }

    if (isUploading) {
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      /*
       * Upload sequentially.
       *
       * This avoids sending many simultaneous
       * requests to the backend.
       */

      for (const file of files) {
        await uploadDocument({
          file,

          parent_id:
            currentFolderId,

          conversation_id:
            conversationId,
        });
      }

      /*
       * Reload current folder after
       * successful uploads.
       */

      await loadDocuments(
        currentFolderId
      );
    } catch (error) {
      console.error(
        "Document upload failed:",
        error
      );

      setErrorMessage(
        getLocalizedErrorMessage(
          error,
          "Document upload failed."
        )
      );
    } finally {
      setIsUploading(false);
    }
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
     * Only leave when the actual drop
     * zone is exited.
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

    void handleUpload(files);
  };

  // ==============================================================
  // Create folder
  // ==============================================================

  const handleCreateFolder =
    async () => {
      const trimmedName =
        folderName.trim();

      if (!trimmedName) {
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

        /*
         * Close modal.
         */

        setShowCreateFolder(
          false
        );

        setFolderName("");

        /*
         * Refresh current folder.
         */

        await loadDocuments(
          currentFolderId
        );
      } catch (error) {
        console.error(
          "Failed to create folder:",
          error
        );

        setErrorMessage(
          getLocalizedErrorMessage(
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
  // Delete confirmation
  // ==============================================================

  const requestDelete = (
    item: DocumentItem
  ) => {
    setDeleteTarget(item);
  };

  // ==============================================================
  // Delete document
  // ==============================================================

  const handleDelete = async () => {
    if (!deleteTarget) {
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

      /*
       * Refresh current folder.
       */

      await loadDocuments(
        currentFolderId
      );
    } catch (error) {
      console.error(
        "Failed to delete document:",
        error
      );

      setErrorMessage(
        getLocalizedErrorMessage(
          error,
          "Failed to delete document."
        )
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==============================================================
  // Format file size
  // ==============================================================

  const formatFileSize = (
    bytes: number
  ): string => {
    if (!bytes || bytes <= 0) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    );

    const safeIndex =
      Math.min(
        index,
        units.length - 1
      );

    const size =
      bytes /
      Math.pow(
        1024,
        safeIndex
      );

    return `${size.toFixed(
      safeIndex === 0
        ? 0
        : 1
    )} ${units[safeIndex]}`;
  };

  // ==============================================================
  // File icon
  // ==============================================================

  const getFileIcon = (
    item: DocumentItem
  ) => {
    if (item.is_folder) {
      return (
        <Folder
          className="
            h-5
            w-5
            text-zinc-700
          "
        />
      );
    }

    const mime =
      item.mime_type
        ?.toLowerCase() || "";

    if (
      mime.includes("image")
    ) {
      return (
        <ImageIcon
          className="
            h-5
            w-5
            text-zinc-600
          "
        />
      );
    }

    if (
      mime.includes("pdf") ||
      mime.includes("text") ||
      mime.includes("document")
    ) {
      return (
        <FileText
          className="
            h-5
            w-5
            text-zinc-600
          "
        />
      );
    }

    return (
      <File
        className="
          h-5
          w-5
          text-zinc-600
        "
      />
    );
  };

  // ==============================================================
  // Sort folders before files
  // ==============================================================

  const sortedDocuments = [
    ...documents,
  ].sort((a, b) => {
    if (
      a.is_folder &&
      !b.is_folder
    ) {
      return -1;
    }

    if (
      !a.is_folder &&
      b.is_folder
    ) {
      return 1;
    }

    return a.file_name.localeCompare(
      b.file_name
    );
  });

  // ==============================================================
  // Render
  // ==============================================================

  return (
    <div
      className="
        flex
        min-h-screen
        flex-col
        bg-white
      "
    >
      {/* ========================================================
          Header
          ======================================================== */}

      <header
        className="
          border-b
          border-zinc-200
          px-4
          py-4
          sm:px-6
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-7xl
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <h1
              className="
                text-xl
                font-semibold
                text-zinc-900
              "
            >
              Documents
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-zinc-500
              "
            >
              Manage your files and folders
            </p>
          </div>

          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >
            <button
              type="button"
              onClick={() =>
                setShowCreateFolder(
                  true
                )
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-zinc-300
                bg-white
                px-3
                py-2
                text-sm
                font-medium
                text-zinc-700
                transition
                hover:bg-zinc-100
              "
            >
              <FolderPlus
                className="
                  h-4
                  w-4
                "
              />

              New Folder
            </button>

            <button
              type="button"
              onClick={
                openFilePicker
              }
              disabled={
                isUploading
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-zinc-900
                px-3
                py-2
                text-sm
                font-medium
                text-white
                transition
                hover:bg-zinc-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {isUploading ? (
                <Loader2
                  className="
                    h-4
                    w-4
                    animate-spin
                  "
                />
              ) : (
                <Upload
                  className="
                    h-4
                    w-4
                  "
                />
              )}

              {isUploading
                ? "Uploading..."
                : "Upload"}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          Main
          ======================================================== */}

      <main
        className="
          mx-auto
          w-full
          max-w-7xl
          flex-1
          px-4
          py-5
          sm:px-6
        "
      >
        {/* ======================================================
            Breadcrumbs
            ====================================================== */}

        <div
          className="
            mb-5
            flex
            min-w-0
            items-center
            gap-1
            overflow-x-auto
            text-sm
          "
        >
          {breadcrumbs.map(
            (
              breadcrumb,
              index
            ) => (
              <div
                key={
                  breadcrumb.id ??
                  "root"
                }
                className="
                  flex
                  shrink-0
                  items-center
                "
              >
                {index > 0 && (
                  <span
                    className="
                      mx-2
                      text-zinc-400
                    "
                  >
                    /
                  </span>
                )}

                <button
                  type="button"
                  onClick={() =>
                    navigateToBreadcrumb(
                      index
                    )
                  }
                  className={`
                    truncate
                    transition
                    hover:text-zinc-900
                    ${
                      index ===
                      breadcrumbs.length -
                        1
                        ? "font-medium text-zinc-900"
                        : "text-zinc-500"
                    }
                  `}
                >
                  {
                    breadcrumb.name
                  }
                </button>
              </div>
            )
          )}
        </div>

        {/* ======================================================
            Error
            ====================================================== */}

        {errorMessage && (
          <div
            className="
              mb-5
              flex
              items-start
              gap-3
              rounded-lg
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              text-red-700
            "
          >
            <p className="flex-1">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                setErrorMessage(
                  null
                )
              }
              className="
                rounded
                p-1
                hover:bg-red-100
              "
              aria-label="Close error"
            >
              <X
                className="
                  h-4
                  w-4
                "
              />
            </button>
          </div>
        )}

        {/* ======================================================
            Drag & Drop
            ====================================================== */}

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
          onDrop={handleDrop}
          onClick={
            openFilePicker
          }
          className={`
            mb-6
            cursor-pointer
            rounded-xl
            border-2
            border-dashed
            px-6
            py-8
            text-center
            transition
            ${
              isDragging
                ? "border-zinc-900 bg-zinc-100"
                : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
            }
            ${
              isUploading
                ? "pointer-events-none opacity-60"
                : ""
            }
          `}
        >
          {isUploading ? (
            <>
              <Loader2
                className="
                  mx-auto
                  h-8
                  w-8
                  animate-spin
                  text-zinc-700
                "
              />

              <p
                className="
                  mt-3
                  text-sm
                  font-medium
                  text-zinc-800
                "
              >
                Uploading files...
              </p>
            </>
          ) : (
            <>
              <Upload
                className="
                  mx-auto
                  h-8
                  w-8
                  text-zinc-500
                "
              />

              <p
                className="
                  mt-3
                  text-sm
                  font-medium
                  text-zinc-800
                "
              >
                {isDragging
                  ? "Drop your files here"
                  : "Drag & drop files here"}
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-zinc-500
                "
              >
                or click to browse files
              </p>
            </>
          )}
        </div>

        {/* Hidden file input */}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={
            handleFileChange
          }
        />

        {/* ======================================================
            Toolbar
            ====================================================== */}

        <div
          className="
            mb-3
            flex
            items-center
            justify-between
          "
        >
          <div>
            <h2
              className="
                text-sm
                font-semibold
                text-zinc-900
              "
            >
              {currentFolderName}
            </h2>

            {!isLoading && (
              <p
                className="
                  mt-0.5
                  text-xs
                  text-zinc-500
                "
              >
                {documents.length}{" "}
                {documents.length ===
                1
                  ? "item"
                  : "items"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              loadDocuments(
                currentFolderId
              )
            }
            disabled={
              isLoading
            }
            title="Refresh"
            className="
              rounded-lg
              p-2
              text-zinc-500
              transition
              hover:bg-zinc-100
              hover:text-zinc-900
              disabled:opacity-50
            "
          >
            <RefreshCw
              className={`
                h-4
                w-4
                ${
                  isLoading
                    ? "animate-spin"
                    : ""
                }
              `}
            />
          </button>
        </div>

        {/* ======================================================
            Loading
            ====================================================== */}

        {isLoading && (
          <div
            className="
              rounded-xl
              border
              border-zinc-200
              bg-white
              py-16
              text-center
            "
          >
            <Loader2
              className="
                mx-auto
                h-7
                w-7
                animate-spin
                text-zinc-500
              "
            />

            <p
              className="
                mt-3
                text-sm
                text-zinc-500
              "
            >
              Loading documents...
            </p>
          </div>
        )}

        {/* ======================================================
            Unauthenticated prompt
            ====================================================== */}

        {!isAuthenticated && !authLoading && (
          <div
            className="
              rounded-xl
              border-2
              border-dashed
              border-zinc-200
              bg-white
              px-6
              py-16
              text-center
            "
          >
            <div
              className="
                mx-auto
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-zinc-100
              "
            >
              <File
                className="
                  h-5
                  w-5
                  text-zinc-500
                "
              />
            </div>

            <h3
              className="
                mt-4
                text-sm
                font-semibold
                text-zinc-900
              "
            >
              Sign in required
            </h3>

            <p
              className="
                mt-1
                text-sm
                text-zinc-500
              "
            >
              Please sign in to view and manage your documents.
            </p>

            <div
              className="
                mt-5
                flex
                justify-center
              "
            >
              <a
                href="/login"
                className="
                  inline-flex
                  items-center
                  rounded-lg
                  bg-zinc-900
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  hover:bg-zinc-800
                "
              >
                Sign In
              </a>
            </div>
          </div>
        )}

        {/* ======================================================
            Empty state
            ====================================================== */}

        {!isLoading &&
          isAuthenticated &&
          sortedDocuments.length ===
            0 && (
            <div
              className="
                rounded-xl
                border-2
                border-dashed
                border-zinc-200
                bg-white
                px-6
                py-16
                text-center
              "
            >
              <div
                className="
                  mx-auto
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  bg-zinc-100
                "
              >
                <File
                  className="
                    h-5
                    w-5
                    text-zinc-500
                  "
                />
              </div>

              <h3
                className="
                  mt-4
                  text-sm
                  font-semibold
                  text-zinc-900
                "
              >
                No documents yet
              </h3>

              <p
                className="
                  mt-1
                  text-sm
                  text-zinc-500
                "
              >
                Upload a file or create
                a folder to get started.
              </p>

              <div
                className="
                  mt-5
                  flex
                  justify-center
                  gap-2
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateFolder(
                      true
                    )
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-zinc-300
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-zinc-700
                    hover:bg-zinc-100
                  "
                >
                  <FolderPlus
                    className="
                      h-4
                      w-4
                    "
                  />

                  New Folder
                </button>

                <button
                  type="button"
                  onClick={
                    openFilePicker
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-zinc-900
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-white
                    hover:bg-zinc-700
                  "
                >
                  <Upload
                    className="
                      h-4
                      w-4
                    "
                  />

                  Upload
                </button>
              </div>
            </div>
          )}

        {/* ======================================================
            Documents
            ====================================================== */}

        {!isLoading &&
          sortedDocuments.length >
            0 && (
            <div
              className="
                overflow-hidden
                rounded-xl
                border
                border-zinc-200
                bg-white
              "
            >
              {/* Desktop heading */}

              <div
                className="
                  hidden
                  grid-cols-[1fr_120px_80px]
                  border-b
                  border-zinc-200
                  bg-zinc-50
                  px-4
                  py-3
                  text-xs
                  font-medium
                  text-zinc-500
                  sm:grid
                "
              >
                <span>
                  Name
                </span>

                <span>
                  Size
                </span>

                <span />
              </div>

              {sortedDocuments.map(
                (item) => {
                  const isDeleting =
                    deletingId ===
                    item.id;

                  return (
                    <div
                      key={item.id}
                      className="
                        group
                        flex
                        items-center
                        gap-3
                        border-b
                        border-zinc-100
                        px-4
                        py-3
                        last:border-b-0
                        hover:bg-zinc-50
                      "
                    >
                      {/* Icon */}

                      <div
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          bg-zinc-100
                        "
                      >
                        {getFileIcon(
                          item
                        )}
                      </div>

                      {/* Name */}
                      <button
                        type="button"
                        onClick={() => {
                          if (item.is_folder) {
                            openFolder(item);
                          } else {
                            handlePreviewPdf(item);
                          }
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer hover:text-zinc-600"
                      >
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {item.file_name}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-zinc-500 sm:hidden">
                          {item.is_folder
                            ? "Folder"
                            : formatFileSize(item.size_bytes)}
                        </p>
                      </button>

                      {/* Size */}
                      <div className="hidden w-[120px] shrink-0 text-xs text-zinc-500 sm:block">
                        {item.is_folder ? "—" : formatFileSize(item.size_bytes)}
                      </div>

                      {/* Actions */}
                      <div className="relative shrink-0 flex items-center gap-1">
                        {!item.is_folder && (
                          <button
                            type="button"
                            onClick={() => handlePreviewPdf(item)}
                            title="Preview PDF"
                            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => requestDelete(item)}
                          title={item.is_folder ? "Delete folder" : "Delete file"}
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
      </main>

      {/* ========================================================
          Create Folder Modal
          ======================================================== */}

      {showCreateFolder && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/40
            px-4
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCreateFolder(
                false
              );
              setFolderName("");
            }
          }}
        >
          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              bg-white
              p-5
              shadow-xl
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <div>
                <h2
                  className="
                    text-base
                    font-semibold
                    text-zinc-900
                  "
                >
                  Create folder
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    text-zinc-500
                  "
                >
                  Create a folder inside{" "}
                  {currentFolderName}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateFolder(
                    false
                  );
                  setFolderName("");
                }}
                className="
                  rounded-lg
                  p-2
                  text-zinc-500
                  hover:bg-zinc-100
                "
              >
                <X
                  className="
                    h-4
                    w-4
                  "
                />
              </button>
            </div>

            <div className="mt-5">
              <label
                htmlFor="folder-name"
                className="
                  mb-2
                  block
                  text-sm
                  font-medium
                  text-zinc-700
                "
              >
                Folder name
              </label>

              <input
                id="folder-name"
                type="text"
                value={folderName}
                onChange={(event) =>
                  setFolderName(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    void handleCreateFolder();
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    setShowCreateFolder(
                      false
                    );
                    setFolderName("");
                  }
                }}
                placeholder="e.g. Projects"
                autoFocus
                disabled={
                  isCreatingFolder
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-zinc-300
                  px-3
                  py-2.5
                  text-sm
                  text-zinc-900
                  outline-none
                  transition
                  placeholder:text-zinc-400
                  focus:border-zinc-500
                  focus:ring-2
                  focus:ring-zinc-200
                  disabled:bg-zinc-100
                "
              />
            </div>

            <div
              className="
                mt-5
                flex
                justify-end
                gap-2
              "
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateFolder(
                    false
                  );
                  setFolderName("");
                }}
                disabled={
                  isCreatingFolder
                }
                className="
                  rounded-lg
                  border
                  border-zinc-300
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-zinc-700
                  hover:bg-zinc-100
                  disabled:opacity-50
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleCreateFolder()
                }
                disabled={
                  isCreatingFolder ||
                  !folderName.trim()
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-zinc-900
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  hover:bg-zinc-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {isCreatingFolder && (
                  <Loader2
                    className="
                      h-4
                      w-4
                      animate-spin
                    "
                  />
                )}

                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          Delete Confirmation Modal
          ======================================================== */}

      {deleteTarget && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/40
            px-4
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!deletingId) {
                setDeleteTarget(
                  null
                );
              }
            }
          }}
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-2xl
              bg-white
              p-5
              shadow-xl
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-red-50
              "
            >
              <Trash2
                className="
                  h-5
                  w-5
                  text-red-600
                "
              />
            </div>

            <h2
              className="
                mt-4
                text-base
                font-semibold
                text-zinc-900
              "
            >
              Delete{" "}
              {deleteTarget.is_folder
                ? "folder"
                : "document"}
              ?
            </h2>

            <p
              className="
                mt-2
                text-sm
                leading-6
                text-zinc-500
              "
            >
              Are you sure you want to
              delete "
              {deleteTarget.file_name}
              "? This action cannot be
              undone.
            </p>

            <div
              className="
                mt-5
                flex
                justify-end
                gap-2
              "
            >
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
                  font-medium
                  text-zinc-700
                  hover:bg-zinc-100
                  disabled:opacity-50
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
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-red-600
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-white
                  hover:bg-red-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {deletingId && (
                  <Loader2
                    className="
                      h-4
                      w-4
                      animate-spin
                    "
                  />
                )}

                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          PDF PREVIEW MODAL
          ========================================================== */}
      <PdfViewerModal
        isOpen={previewPdf.isOpen}
        onClose={() =>
          setPreviewPdf((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        filename={previewPdf.filename}
        documentId={previewPdf.documentId}
        file={previewPdf.file}
        url={previewPdf.url}
      />
    </div>
  );
}