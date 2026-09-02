export interface ChatAttachment {
  type: "pdf" | "image" | string;
  documentId?: string;
  filename: string;
  file?: File;
  url?: string;
}

export interface ChatSource {
  id?: string;
  documentId?: string;
  filename?: string;
  title?: string;
  pageNumber?: number | string;
  page?: number | string;
  pages?: (number | string)[];
  section?: string;
  chunkId?: string | number;
  sourceType?: string;
  citationNumber?: number | string;
  snippet?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: ChatAttachment;
  reasoning?: string;
  reasoningDurationSeconds?: number;
  sources?: ChatSource[];
  reasoningSteps?: string[];
  suggestions?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  document_id?: string | null;
  document_name?: string | null;
  messages: ChatMessage[];
}