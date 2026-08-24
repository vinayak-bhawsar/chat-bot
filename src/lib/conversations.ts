import { apiRequest } from "@/lib/api";

export interface ConversationSummary {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

interface ConversationsResponse {
  success: boolean;
  status_code: number;
  conversations: ConversationSummary[];
}

export async function getConversations(): Promise<
  ConversationSummary[]
> {
  const response =
    await apiRequest<ConversationsResponse>(
      "/documents/conversations",
      {
        method: "GET",
      }
    );

  return response.conversations;
}