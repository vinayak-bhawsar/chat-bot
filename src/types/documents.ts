// ================================================================
// Document / Folder Types
// ================================================================

export interface DocumentItem {
  file_name: string;
  id: string;
  user_id: string;
  parent_id: string | null;
  is_folder: boolean;
  mime_type: string;
  size_bytes: number;
  status: string;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

// ================================================================
// GET /documents response
// ================================================================

export interface DocumentsData {
  items: DocumentItem[];

  total: number;

  page: number;

  page_size: number;

  total_pages: number;
}

// ================================================================
// Standard backend response
// ================================================================

export interface DocumentsResponse {
  success: boolean;

  status_code: number;

  message: string;

  data: DocumentsData;

  error_code: string | null;
}

// ================================================================
// Create folder request
// ================================================================

export interface CreateFolderRequest {
  file_name: string;

  parent_id: string | null;
}

// ================================================================
// Upload document options
// ================================================================

export interface UploadDocumentOptions {
  file: File;

  parent_id?: string | null;

  conversation_id?: string | null;
}