// ================================================================
// API Configuration
// ================================================================

import {
  getLocalizedErrorMessage,
  normalizeErrorCode,
} from "@/i18n";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://rag-chatbot-v2hu.onrender.com";

if (!API_URL) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not configured."
  );
}

// ================================================================
// Types
// ================================================================

export interface UploadDocumentResponse {
  message?: string;
  document_id: string;
  filename: string;
  status?: string;
  chunks?: number;
}

// ================================================================
// Document Types
// ================================================================

export interface DocumentItem {
  id: string;

  file_name: string;

  user_id: string;

  parent_id: string | null;

  is_folder: boolean;

  mime_type: string | null;

  size_bytes: number | null;

  status: string | null;

  conversation_id: string | null;

  created_at: string;

  updated_at: string;
}

export interface DocumentsData {
  items: DocumentItem[];

  total: number;

  page: number;

  page_size: number;

  total_pages: number;
}

export interface GetDocumentsResponse {
  success: boolean;

  status_code: number;

  message: string;

  data: DocumentsData;

  error_code: string | null;
}

export interface CreateFolderRequest {
  file_name: string;

  parent_id?: string | null;
}

export interface CreateFolderResponse {
  success: boolean;

  status_code: number;

  message: string;

  data?: DocumentItem;

  error_code: string | null;
}

export interface DeleteDocumentResponse {
  success: boolean;

  status_code: number;

  message: string;

  data?: any;

  error_code: string | null;
}

// ================================================================
// API Error
// ================================================================

export class ApiError extends Error {
  statusCode: number;

  errorCode: string | null;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string | null
  ) {
    super(message);

    this.name = "ApiError";

    this.statusCode = statusCode;

    this.errorCode =
      errorCode ?? normalizeErrorCode(statusCode) ?? null;
  }
}

// ================================================================
// Get Access Token
// ================================================================

export function getAccessToken(): string | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  return localStorage.getItem(
    "access_token"
  );
}

// ================================================================
// Get Refresh Token
// ================================================================

export function getRefreshToken(): string | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  return localStorage.getItem(
    "refresh_token"
  );
}

// ================================================================
// Store Tokens
// ================================================================

export function storeTokens(
  accessToken: string,
  refreshToken?: string
): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  if (!accessToken) {
    return;
  }

  localStorage.setItem(
    "access_token",
    accessToken
  );

  /*
   * Only update the refresh token when
   * the backend actually returns one.
   */

  if (refreshToken) {
    localStorage.setItem(
      "refresh_token",
      refreshToken
    );
  }
}

// ================================================================
// Clear Tokens
// ================================================================

export function clearTokens(): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  localStorage.removeItem(
    "access_token"
  );

  localStorage.removeItem(
    "refresh_token"
  );

  localStorage.removeItem(
    "active_conversation_id"
  );
}

// ================================================================
// Non-Refreshable Endpoint Check
// ================================================================

function isNonRefreshableEndpoint(
  endpoint: string
): boolean {
  const cleanEndpoint = endpoint.split("?")[0].toLowerCase().trim();
  return (
    cleanEndpoint === "/auth/login" ||
    cleanEndpoint === "/auth/signup" ||
    cleanEndpoint === "/auth/refresh" ||
    cleanEndpoint === "/auth/logout"
  );
}

// ================================================================
// In-flight GET Request Deduplication
// ================================================================

/*
 * React development Strict Mode can run
 * effects more than once.
 *
 * If two identical GET requests start before
 * the first one finishes, both callers reuse
 * the same Promise instead of sending two
 * HTTP requests.
 *
 * IMPORTANT:
 * Only GET requests are deduplicated.
 *
 * POST /login
 * POST /signup
 * POST /chat
 * POST /upload
 *
 * are never deduplicated.
 */

const pendingGetRequests =
  new Map<
    string,
    Promise<unknown>
  >();

// ================================================================
// Refresh Access Token
// ================================================================

let refreshPromise:
  | Promise<string>
  | null = null;

export async function refreshAccessToken(): Promise<string> {
  /*
   * If another request is already refreshing
   * the token, reuse that request.
   *
   * This prevents multiple simultaneous
   * /auth/refresh calls.
   */

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    performTokenRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ================================================================
// Perform Token Refresh
// ================================================================

async function performTokenRefresh(): Promise<string> {
  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    throw new ApiError(
      getLocalizedErrorMessage(
        "UNAUTHORIZED"
      ),
      401,
      "UNAUTHORIZED"
    );
  }

  if (!API_URL) {
    throw new ApiError(
      "API URL is not configured.",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  let response: Response;

  try {
    response =
      await fetch(
        `${API_URL}/auth/refresh`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${refreshToken}`,
          },

          body: JSON.stringify({
            refresh_token:
              refreshToken,
            refreshToken:
              refreshToken,
          }),
        }
      );
  } catch (networkErr) {
    throw new ApiError(
      getLocalizedErrorMessage("NETWORK_ERROR"),
      0,
      "NETWORK_ERROR"
    );
  }

  // ==============================================================
  // Parse response
  // ==============================================================

  const contentType =
    response.headers.get(
      "content-type"
    );

  let data: any = null;

  if (
    contentType?.includes(
      "application/json"
    )
  ) {
    data =
      await response.json();
  } else {
    const text =
      await response.text();

    data =
      text || null;
  }

  // ==============================================================
  // Refresh failed
  // ==============================================================

  if (!response.ok) {
    clearTokens();

    const rawErrorCode =
      data?.error_code ??
      data?.data?.error_code ??
      data?.code ??
      null;

    const errorCode =
      normalizeErrorCode(rawErrorCode) ??
      normalizeErrorCode(response.status);

    const message =
      getLocalizedErrorMessage(
        errorCode || response.status,
        getBackendMessage(
          data,
          "Unable to refresh access token."
        )
      );

    throw new ApiError(
      message,
      response.status,
      errorCode
    );
  }

  // ==============================================================
  // Read token
  // ==============================================================

  const accessToken =
    data?.access_token ||
    data?.data?.access_token ||
    data?.token ||
    data?.data?.token;

  const newRefreshToken =
    data?.refresh_token ||
    data?.data?.refresh_token;

  if (!accessToken) {
    clearTokens();

    throw new ApiError(
      getLocalizedErrorMessage(
        "INTERNAL_SERVER_ERROR"
      ),
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  // ==============================================================
  // Store tokens
  // ==============================================================

  storeTokens(
    accessToken,
    newRefreshToken
  );

  return accessToken;
}

// ================================================================
// API Request
// ================================================================

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not configured.",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  const method = (
    options.method ||
    "GET"
  ).toUpperCase();

  // ==============================================================
  // Only deduplicate GET requests
  // ==============================================================

  if (method === "GET") {
    const requestKey =
      createGetRequestKey(
        endpoint,
        options
      );

    const existingRequest =
      pendingGetRequests.get(
        requestKey
      );

    if (existingRequest) {
      console.log(
        "Reusing in-flight GET request:",
        endpoint
      );

      return existingRequest as Promise<T>;
    }

    const request =
      performApiRequest<T>(
        endpoint,
        options
      );

    pendingGetRequests.set(
      requestKey,
      request
    );

    const cleanup = () => {
      if (
        pendingGetRequests.get(
          requestKey
        ) === request
      ) {
        pendingGetRequests.delete(
          requestKey
        );
      }
    };

    request.then(cleanup, cleanup);

    return request;
  }

  // ==============================================================
  // POST / PUT / PATCH / DELETE
  // ==============================================================

  return performApiRequest<T>(
    endpoint,
    options
  );
}

// ================================================================
// GET Request Key
// ================================================================

function createGetRequestKey(
  endpoint: string,
  options: RequestInit
): string {
  const headers =
    new Headers(
      options.headers
    );

  /*
   * Include Authorization in the key.
   *
   * This prevents one user's authenticated
   * request from being reused by another token
   * in the same browser session.
   */

  const authorization =
    headers.get(
      "Authorization"
    ) ||
    getAccessToken() ||
    "";

  return [
    "GET",
    endpoint,
    authorization,
  ].join(":");
}

// ================================================================
// Perform API Request
// ================================================================

async function performApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not configured.",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  // ==============================================================
  // Get Access Token
  // ==============================================================

  let accessToken =
    getAccessToken();

  // ==============================================================
  // Headers
  // ==============================================================

  const headers =
    new Headers(
      options.headers
    );

  /*
   * FormData requests must NOT receive
   * Content-Type: application/json.
   */

  const isFormData =
    typeof FormData !==
    "undefined" &&
    options.body instanceof
    FormData;

  /*
   * JSON requests:
   *
   * Add application/json only when:
   *
   * 1. Request is NOT FormData
   * 2. Caller didn't provide Content-Type
   */

  if (
    !isFormData &&
    !headers.has(
      "Content-Type"
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  /*
   * Add Authorization only when
   * an access token exists.
   */

  if (accessToken) {
    headers.set(
      "Authorization",
      `Bearer ${accessToken}`
    );
  }

  // ==============================================================
  // First Request (with automatic 1.2s retry on network drop/Render wake-up)
  // ==============================================================

  let response: Response;

  try {
    response =
      await fetch(
        `${API_URL}${endpoint}`,
        {
          ...options,
          headers,
        }
      );
  } catch (networkErr) {
    console.warn("Initial network request failed, retrying in 1.2s...", networkErr);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (retryErr) {
      console.warn("Network request failed after retry:", retryErr);
      throw new ApiError(
        getLocalizedErrorMessage("NETWORK_ERROR"),
        0,
        "NETWORK_ERROR"
      );
    }
  }

  // ==============================================================
  // Handle 401
  // ==============================================================

  const refreshToken =
    getRefreshToken();

  const shouldRefreshToken =
    response.status === 401 &&
    !isNonRefreshableEndpoint(endpoint) &&
    Boolean(refreshToken);

  if (shouldRefreshToken) {
    try {
      console.log(
        "Access token expired. Refreshing token..."
      );

      accessToken =
        await refreshAccessToken();

      headers.set(
        "Authorization",
        `Bearer ${accessToken}`
      );

      /*
       * Retry original request.
       */

      try {
        response =
          await fetch(
            `${API_URL}${endpoint}`,
            {
              ...options,
              headers,
            }
          );
      } catch (retryNetworkErr) {
        throw new ApiError(
          getLocalizedErrorMessage("NETWORK_ERROR"),
          0,
          "NETWORK_ERROR"
        );
      }
    } catch (
    refreshError
    ) {
      console.error(
        "Token refresh failed:",
        refreshError
      );

      clearTokens();

      throw new ApiError(
        getLocalizedErrorMessage(
          "UNAUTHORIZED"
        ),
        401,
        "UNAUTHORIZED"
      );
    }
  } else if (
    response.status === 401 &&
    !["/auth/login", "/auth/signup"].includes(
      endpoint.split("?")[0].toLowerCase().trim()
    )
  ) {
    clearTokens();
  }

  // ==============================================================
  // Parse Response
  // ==============================================================

  const contentType =
    response.headers.get(
      "content-type"
    );

  let data: any = null;

  if (
    contentType?.includes(
      "application/json"
    )
  ) {
    data =
      await response.json();
  } else {
    const text =
      await response.text();

    data =
      text || null;
  }

  // ==============================================================
  // Handle HTTP Error
  // ==============================================================

  if (!response.ok) {
    const rawErrorCode =
      data?.error_code ??
      data?.data?.error_code ??
      data?.code ??
      null;

    const errorCode =
      normalizeErrorCode(rawErrorCode) ??
      normalizeErrorCode(response.status);

    const validationMessage =
      Array.isArray(data?.detail)
        ? data.detail
            .map((item: any) => item?.msg)
            .filter(Boolean)
            .join(", ")
        : null;

    const backendMessage =
      getBackendMessage(data, "");

    const isCustomBackendMessage =
      Boolean(backendMessage) &&
      !["not found", "unauthorized", "bad request", "forbidden", "internal server error", "bad gateway", "service unavailable", "gateway timeout"].includes(
        backendMessage.toLowerCase().trim()
      );

    const message =
      validationMessage ||
      (isCustomBackendMessage
        ? backendMessage
        : getLocalizedErrorMessage(
            errorCode || response.status,
            backendMessage || undefined
          ));

    throw new ApiError(
      message,
      response.status,
      errorCode
    );
  }

  // ==============================================================
  // Return Response
  // ==============================================================

  return data as T;
}

// ================================================================
// Upload Document
// ================================================================

export interface UploadDocumentOptions {
  file: File;

  parent_id?: string | null;

  conversation_id?: string | null;
}

export interface DocumentResponse {
  success?: boolean;

  status_code?: number;

  message?: string;

  data?: any;

  error_code?: string | null;
}

export async function uploadDocument(
  options:
    | File
    | UploadDocumentOptions
): Promise<any> {
  if (!API_URL) {
    throw new ApiError(
      "API URL is not configured.",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  // ==============================================================
  // Normalize input
  // ==============================================================

  const file =
    options instanceof File
      ? options
      : options.file;

  const parentId =
    options instanceof File
      ? null
      : options.parent_id ??
      null;

  const conversationId =
    options instanceof File
      ? null
      : options.conversation_id ??
      null;

  if (!file) {
    throw new ApiError(
      "A document file is required.",
      400,
      "BAD_REQUEST"
    );
  }

  // ==============================================================
  // Access Token
  // ==============================================================

  let accessToken =
    getAccessToken();

  const uploadInitialRefreshToken =
    getRefreshToken();

  if (!accessToken && uploadInitialRefreshToken) {
    try {
      accessToken =
        await refreshAccessToken();
    } catch {
      clearTokens();
      throw new ApiError(
        getLocalizedErrorMessage(
          "UNAUTHORIZED"
        ),
        401,
        "UNAUTHORIZED"
      );
    }
  }

  if (!accessToken) {
    throw new ApiError(
      getLocalizedErrorMessage(
        "UNAUTHORIZED"
      ),
      401,
      "UNAUTHORIZED"
    );
  }

  // ==============================================================
  // FormData
  // ==============================================================

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  if (parentId) {
    formData.append(
      "parent_id",
      parentId
    );
  }

  if (conversationId) {
    formData.append(
      "conversation_id",
      conversationId
    );
  }

  // ==============================================================
  // Upload Request
  // ==============================================================

  let response: Response;

  try {
    response =
      await fetch(
        `${API_URL}/documents/upload`,
        {
          method: "POST",

          headers: {
            /*
             * DO NOT set Content-Type manually.
             */

            Authorization:
              `Bearer ${accessToken}`,
          },

          body: formData,
        }
      );
  } catch (networkErr) {
    console.error("Document upload network error:", networkErr);
    throw new ApiError(
      getLocalizedErrorMessage("NETWORK_ERROR"),
      0,
      "NETWORK_ERROR"
    );
  }

  // ==============================================================
  // Refresh On 401
  // ==============================================================

  const uploadRefreshToken =
    getRefreshToken();

  if (
    response.status === 401 &&
    Boolean(uploadRefreshToken)
  ) {
    try {
      console.log(
        "Upload access token expired. Refreshing..."
      );

      accessToken =
        await refreshAccessToken();

      try {
        response =
          await fetch(
            `${API_URL}/documents/upload`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },

              body: formData,
            }
          );
      } catch (retryNetworkErr) {
        throw new ApiError(
          getLocalizedErrorMessage("NETWORK_ERROR"),
          0,
          "NETWORK_ERROR"
        );
      }
    } catch (
    refreshError
    ) {
      console.error(
        "Upload token refresh failed:",
        refreshError
      );

      clearTokens();

      throw new ApiError(
        getLocalizedErrorMessage(
          "UNAUTHORIZED"
        ),
        401,
        "UNAUTHORIZED"
      );
    }
  } else if (
    response.status === 401
  ) {
    clearTokens();
  }

  // ==============================================================
  // Parse Response
  // ==============================================================

  const contentType =
    response.headers.get(
      "content-type"
    );

  let data: any = null;

  if (
    contentType?.includes(
      "application/json"
    )
  ) {
    data =
      await response.json();
  } else {
    const text =
      await response.text();

    data =
      text || null;
  }

  // ==============================================================
  // Error
  // ==============================================================

  if (!response.ok) {
    const rawErrorCode =
      data?.error_code ??
      data?.data?.error_code ??
      data?.code ??
      null;

    const errorCode =
      normalizeErrorCode(rawErrorCode) ??
      normalizeErrorCode(response.status);

    const validationMessage =
      Array.isArray(data?.detail)
        ? data.detail
            .map((item: any) => item?.msg)
            .filter(Boolean)
            .join(", ")
        : null;

    const backendMessage =
      getBackendMessage(data, "");

    const isCustomBackendMessage =
      Boolean(backendMessage) &&
      !["not found", "unauthorized", "bad request", "forbidden", "internal server error", "bad gateway", "service unavailable", "gateway timeout"].includes(
        backendMessage.toLowerCase().trim()
      );

    const message =
      validationMessage ||
      (isCustomBackendMessage
        ? backendMessage
        : getLocalizedErrorMessage(
            errorCode || response.status,
            backendMessage || "Document upload failed."
          ));

    throw new ApiError(
      message,
      response.status,
      errorCode
    );
  }

  // ==============================================================
  // Success
  // ==============================================================

  return data;
}

// ================================================================
// GET DOCUMENTS
// ================================================================

export async function getDocuments(
  parentId: string | null = null,
  page: number = 1,
  pageSize: number = 100
): Promise<GetDocumentsResponse> {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(page)
  );

  params.set(
    "page_size",
    String(pageSize)
  );

  /*
   * Root:
   *
   * GET /documents?page=1&page_size=100
   *
   * Inside folder:
   *
   * GET /documents?page=1&page_size=100&parent_id=...
   */

  if (parentId) {
    params.set(
      "parent_id",
      parentId
    );
  }

  return apiRequest<GetDocumentsResponse>(
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
  request: CreateFolderRequest
): Promise<CreateFolderResponse> {
  if (
    !request.file_name ||
    !request.file_name.trim()
  ) {
    throw new ApiError(
      "Folder name is required.",
      400,
      "BAD_REQUEST"
    );
  }

  return apiRequest<CreateFolderResponse>(
    "/documents/folder",
    {
      method: "POST",

      body: JSON.stringify({
        file_name:
          request.file_name.trim(),

        parent_id:
          request.parent_id ??
          null,
      }),
    }
  );
}

// ================================================================
// DELETE DOCUMENT / FOLDER
// ================================================================

export async function deleteDocument(
  documentId: string
): Promise<DeleteDocumentResponse> {
  if (!documentId) {
    throw new ApiError(
      "Document ID is required.",
      400,
      "BAD_REQUEST"
    );
  }

  return apiRequest<DeleteDocumentResponse>(
    `/documents/${encodeURIComponent(
      documentId
    )}`,
    {
      method: "DELETE",
    }
  );
}

// ================================================================
// Backend Message Helper
// ================================================================

function getBackendMessage(
  data: any,
  fallback: string
): string {
  /*
   * Plain text response
   */

  if (
    typeof data === "string"
  ) {
    return data || fallback;
  }

  /*
   * FastAPI validation errors
   */

  if (
    Array.isArray(
      data?.detail
    )
  ) {
    const validationMessage =
      data.detail
        .map(
          (item: any) =>
            item?.msg
        )
        .filter(Boolean)
        .join(", ");

    if (validationMessage) {
      return validationMessage;
    }
  }

  /*
   * Normal backend messages
   */

  return (
    data?.detail ||
    data?.message ||
    data?.data?.detail ||
    data?.data?.message ||
    fallback
  );
}