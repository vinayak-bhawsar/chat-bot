import { Conversation } from "@/types/chat";

const memoryCache = new Map<string, Partial<Conversation>>();

export function getCachedConversation(
  id: string
): Partial<Conversation> | undefined {
  if (!id) return undefined;
  return memoryCache.get(id);
}

export function setCachedConversation(
  id: string,
  data: Partial<Conversation>
): void {
  if (!id) return;
  const existing = memoryCache.get(id) || {};
  memoryCache.set(id, {
    ...existing,
    ...data,
    id,
  });
}

export function clearConversationCache(id?: string): void {
  if (id) {
    memoryCache.delete(id);
  } else {
    memoryCache.clear();
  }
}
