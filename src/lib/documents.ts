import {
  apiRequest,
  ApiError,
  extractDocumentId,
  extractConversationId,
} from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";

export { extractDocumentId, extractConversationId };

import {
  CreateFolderRequest,
  DocumentItem,
  DocumentsResponse,
  UploadDocumentOptions,
} from "@/types/documents";

// ================================================================
// GET DOCUMENTS
export async function getDocuments(
  parentId: string | null = null,
  page: number = 1,
  pageSize: number = 100,
  _conversationId?: string | null
): Promise<DocumentsResponse> {
  const params = new URLSearchParams();

  const safePage = Math.max(1, page || 1);
  const safePageSize = Math.min(Math.max(1, pageSize || 100), 100);

  params.set("page", String(safePage));
  params.set("page_size", String(safePageSize));

  if (parentId && typeof parentId === "string" && parentId.trim()) {
    params.set("parent_id", parentId.trim());
  }

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

import {
  uploadDocument as apiUploadDocument,
} from "@/lib/api";

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

  const response = await apiUploadDocument(options);

  const docItem = response?.data ?? response;
  const extractedDocId = extractDocumentId(docItem) || extractDocumentId(response);
  const extractedConvId = extractConversationId(docItem) || extractConversationId(response);

  let resultDoc: any = docItem;
  if (typeof resultDoc !== "object" || resultDoc === null) {
    resultDoc = {
      id: extractedDocId,
      document_id: extractedDocId,
      file_name: options.file.name,
      filename: options.file.name,
      conversation_id: extractedConvId,
      is_folder: false,
    };
  } else {
    if (!resultDoc.id && extractedDocId) {
      resultDoc.id = extractedDocId;
    }
    if (!resultDoc.document_id && extractedDocId) {
      resultDoc.document_id = extractedDocId;
    }
    if (!resultDoc.conversation_id && extractedConvId) {
      resultDoc.conversation_id = extractedConvId;
    }
    if (!resultDoc.file_name && !resultDoc.filename) {
      resultDoc.file_name = options.file.name;
    }
  }

  console.log("DOCUMENT UPLOAD SUCCESS", {
    documentId: extractedDocId,
    fileName: resultDoc?.file_name || resultDoc?.filename || options.file.name,
    conversationId: extractedConvId,
  });

  return resultDoc as DocumentItem;
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
    return;
  }

  try {
    await apiRequest(
      `/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
      }
    );
  } catch (err: any) {
    // 404 Document not found means it's already removed on backend or was local-only
    if (
      err?.statusCode === 404 ||
      err?.status === 404 ||
      String(err?.message || "").toLowerCase().includes("not found")
    ) {
      return;
    }
    throw err;
  }
}