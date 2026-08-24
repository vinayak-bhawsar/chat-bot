import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  clearTokens,
} from "./api";
import { getLocalizedErrorMessage, normalizeErrorCode } from "@/i18n";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://rag-chatbot-v2hu.onrender.com";

export interface ChatStreamHandlers {
  onConversation?: (conversationId: string) => void;
  onMessage?: (content: string) => void;
  onDone?: (answer: string, conversationId: string) => void;
  onError?: (message: string, conversationId?: string) => void;
}

export async function streamChat(
  question: string,
  conversationId: string | null,
  handlers: ChatStreamHandlers,
  documentId: string | null = null,
  filename: string | null = null
): Promise<void> {
  let accessToken = getAccessToken();
  const initialRefreshToken = getRefreshToken();

  if (!accessToken && initialRefreshToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      clearTokens();
      throw new Error(getLocalizedErrorMessage("UNAUTHORIZED"));
    }
  }

  if (!accessToken) {
    throw new Error(getLocalizedErrorMessage("UNAUTHORIZED"));
  }

  // ==============================================================
  // BUILD PAYLOAD
  // ==============================================================

  const buildPayload = (convId: string | null) => {
    const payload: {
      question: string;
      conversation_id: string | null;
      document_id?: string;
    } = {
      question: question.trim(),
      conversation_id:
        convId &&
        !convId.startsWith("temp-") &&
        !convId.startsWith("local-")
          ? convId
          : null,
    };

    if (documentId && documentId.trim()) {
      payload.document_id = documentId.trim();
    }

    return payload;
  };

  let payload = buildPayload(conversationId);

  console.log("FINAL CHAT PAYLOAD:", JSON.stringify(payload, null, 2));

  // ==============================================================
  // SEND REQUEST
  // ==============================================================

  let response: Response;

  try {
    response = await fetch(`${API_URL}/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error("Chat network error:", networkErr);
    throw new Error(getLocalizedErrorMessage("NETWORK_ERROR"));
  }

  // ==============================================================
  // 401 REFRESH RETRY
  // ==============================================================

  if (response.status === 401 && Boolean(getRefreshToken())) {
    try {
      console.log("Chat token expired. Refreshing token...");
      accessToken = await refreshAccessToken();
      response = await fetch(`${API_URL}/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (refreshErr) {
      console.error("Chat token refresh failed:", refreshErr);
      clearTokens();
      throw new Error(getLocalizedErrorMessage("UNAUTHORIZED"));
    }
  }

  // ==============================================================
  // 404 AUTO-RETRY
  // ==============================================================

  if (response.status === 404 && payload.conversation_id) {
    console.warn(
      `Conversation ${payload.conversation_id} not found (404). Retrying as new conversation...`
    );

    payload = buildPayload(null);

    try {
      response = await fetch(`${API_URL}/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (retryNetworkErr) {
      throw new Error(getLocalizedErrorMessage("NETWORK_ERROR"));
    }
  }

  // ==============================================================
  // ERROR
  // ==============================================================

  if (!response.ok) {
    let rawErrorCode: string | null = null;
    let backendMessage = "";

    try {
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        rawErrorCode = data?.error_code || data?.data?.error_code || data?.code || null;
        backendMessage =
          data?.detail ||
          data?.message ||
          data?.data?.message ||
          "";
      } else {
        const text = await response.text();
        if (text) {
          backendMessage = text;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    const errorCode = normalizeErrorCode(rawErrorCode) ?? normalizeErrorCode(response.status);
    const message = getLocalizedErrorMessage(
      errorCode || response.status,
      backendMessage || undefined
    );

    throw new Error(message);
  }

  // ==============================================================
  // STREAM
  // ==============================================================

  if (!response.body) {
    throw new Error(getLocalizedErrorMessage("INTERNAL_SERVER_ERROR", "Streaming response body is not available."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        processSSEEvent(event, handlers);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processSSEEvent(buffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

// ================================================================
// SSE EVENT PROCESSOR
// ================================================================

function processSSEEvent(
  event: string,
  handlers: ChatStreamHandlers
): void {
  const lines = event.split(/\r?\n/);
  let eventType = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const dataString = dataLines.join("\n");

  if (!dataString) {
    return;
  }

  let data: any;

  try {
    data = JSON.parse(dataString);
  } catch {
    if (dataString.trim()) {
      handlers.onMessage?.(dataString);
    }
    return;
  }

  const inferredType = (
    eventType ||
    data?.event ||
    data?.type ||
    (data?.delta || data?.content || data?.text ? "delta" : "") ||
    (data?.answer ? "done" : "") ||
    (data?.error || data?.detail ? "error" : "")
  ).toLowerCase();

  // START
  if (inferredType === "start") {
    const conversationId = data?.conversation_id || data?.id;
    if (conversationId) {
      handlers.onConversation?.(conversationId);
    }
    return;
  }

  // DELTA
  if (inferredType === "delta") {
    const delta = data?.delta ?? data?.content ?? data?.text ?? "";
    if (delta) {
      handlers.onMessage?.(delta);
    }
    return;
  }

  // DONE
  if (inferredType === "done" || inferredType === "complete") {
    const answer =
      data?.answer ?? data?.text_content ?? data?.content ?? data?.text ?? "";
    const conversationId = data?.conversation_id || data?.id || "";
    handlers.onDone?.(answer, conversationId);
    return;
  }

  // ERROR
  if (inferredType === "error") {
    console.error("Backend SSE error event payload:", data);
    const rawErrorCode = data?.error_code || data?.code;
    const rawMessage =
      data?.message ||
      data?.detail ||
      (typeof data?.error === "string" ? data.error : data?.error?.message);

    const errorCode = normalizeErrorCode(rawErrorCode) ?? normalizeErrorCode(rawMessage);
    const message = getLocalizedErrorMessage(
      errorCode || rawMessage,
      rawMessage || "Chat generation failed."
    );

    handlers.onError?.(message, data?.conversation_id);
    return;
  }

  // FALLBACKS
  if (data?.answer) {
    handlers.onDone?.(data.answer, data.conversation_id || "");
    return;
  }

  if (data?.delta || data?.content || data?.text) {
    handlers.onMessage?.(data.delta || data.content || data.text);
    return;
  }
}