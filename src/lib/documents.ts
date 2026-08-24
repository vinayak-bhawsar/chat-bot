import { apiRequest, ApiError } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";

import {
  CreateFolderRequest,
  DocumentItem,
  DocumentsResponse,
  UploadDocumentOptions,
} from "@/types/documents";

// ================================================================
// GET DOCUMENTS
// ================================================================

export async function getDocuments(
  parentId: string | null = null,
  page: number = 1,
  pageSize: number = 100
): Promise<DocumentsResponse> {
  const params = new URLSearchParams();

  if (parentId) {
    params.append("parent_id", parentId);
  }

  params.append("page", String(page));
  params.append("page_size", String(pageSize));

  return apiRequest<DocumentsResponse>(
    `/documents?${params.toString()}`,
    {
      method: "GET",
    }
  );
}

// ================================================================
// CREATE FOLDER
// ================================================================

export async function createFolder(
  data: CreateFolderRequest
): Promise<DocumentItem> {
  if (!data?.file_name || !data.file_name.trim()) {
    throw new ApiError(
      getLocalizedErrorMessage("VALIDATION_ERROR", "Folder name is required."),
      400,
      "VALIDATION_ERROR"
    );
  }

  const response = await apiRequest<any>(
    "/documents/folder",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: data.file_name.trim(),
        parent_id: data.parent_id ?? null,
      }),
    }
  );

  return response?.data ?? response;
}

// ================================================================
// UPLOAD DOCUMENT
// ================================================================

export async function uploadDocument(
  options: UploadDocumentOptions
): Promise<DocumentItem> {
  if (!options?.file) {
    throw new ApiError(
      getLocalizedErrorMessage("BAD_REQUEST", "A document file is required."),
      400,
      "BAD_REQUEST"
    );
  }

  const formData = new FormData();
  formData.append("file", options.file);

  if (options.parent_id) {
    formData.append("parent_id", options.parent_id);
  }

  if (options.conversation_id) {
    formData.append("conversation_id", options.conversation_id);
  }

  /*
   * Do NOT manually set Content-Type.
   *
   * apiRequest() detects FormData and allows the browser
   * to create the multipart boundary.
   */

  const response = await apiRequest<any>(
    "/documents/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  return response?.data ?? response;
}

// ================================================================
// GET SINGLE DOCUMENT
// ================================================================

export async function getDocument(
  documentId: string
): Promise<DocumentItem> {
  if (!documentId) {
    throw new ApiError(
      getLocalizedErrorMessage("BAD_REQUEST", "Document ID is required."),
      400,
      "BAD_REQUEST"
    );
  }

  const response = await apiRequest<any>(
    `/documents/${encodeURIComponent(documentId)}`,
    {
      method: "GET",
    }
  );

  return response?.data ?? response;
}

// ================================================================
// DELETE DOCUMENT
// ================================================================

export async function deleteDocument(
  documentId: string
): Promise<void> {
  if (!documentId) {
    throw new ApiError(
      getLocalizedErrorMessage("BAD_REQUEST", "Document ID is required."),
      400,
      "BAD_REQUEST"
    );
  }

  await apiRequest(
    `/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
    }
  );
}