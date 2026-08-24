export interface ChatAttachment {
  type: "pdf" | string;
  documentId?: string;
  filename: string;
  file?: File;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: ChatAttachment;
}

export interface Conversation {
  id: string;
  title: string;
  document_id?: string | null;
  document_name?: string | null;
  messages: ChatMessage[];
}