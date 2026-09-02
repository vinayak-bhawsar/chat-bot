"use client";

import KnowledgeBaseContent from "./KnowledgeBaseContent";

interface DocumentsPageProps {
  conversationId?: string | null;
}

export default function DocumentsPage({
  conversationId = null,
}: DocumentsPageProps) {
  return <KnowledgeBaseContent conversationId={conversationId} />;
}