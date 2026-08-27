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
      accessToken = null;
    }
  }

  const isGuest = !accessToken;

  // ==============================================================
  // LOCAL GUEST CHAT (Offline / Preview Mode - No failing network call)
  // ==============================================================
  if (isGuest) {
    await handleLocalGuestChat(question, handlers);
    return;
  }

  // ==============================================================
  // BUILD PAYLOAD (Authenticated users only)
  // ==============================================================

  const buildPayload = (convId: string | null): {
    question: string;
    conversation_id: string | null;
    document_id: string | null;
  } => {
    const cleanConvId =
      convId &&
      !convId.startsWith("temp-") &&
      !convId.startsWith("local-") &&
      !convId.startsWith("guest-")
        ? convId.trim()
        : null;

    const cleanDocId =
      documentId && typeof documentId === "string" && documentId.trim()
        ? documentId.trim()
        : null;

    return {
      question: question.trim(),
      conversation_id: cleanConvId,
      document_id: cleanDocId,
    };
  };

  let payload = buildPayload(conversationId);

  console.log("FINAL CHAT REQUEST", {
    question: payload.question,
    conversation_id: payload.conversation_id,
    document_id: payload.document_id,
  });

  // ==============================================================
  // BUILD HEADERS
  // ==============================================================

  const buildHeaders = (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  // ==============================================================
  // SEND REQUEST
  // ==============================================================

  let response: Response;

  try {
    response = await fetch(`${API_URL}/conversation`, {
      method: "POST",
      headers: buildHeaders(accessToken),
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error("Chat network error:", networkErr);
    throw new Error(getLocalizedErrorMessage("NETWORK_ERROR"));
  }

  // ==============================================================
  // 401 REFRESH RETRY (Authenticated users only)
  // ==============================================================

  if (response.status === 401 && Boolean(getRefreshToken())) {
    try {
      console.log("Chat token expired. Refreshing token...");
      accessToken = await refreshAccessToken();
      response = await fetch(`${API_URL}/conversation`, {
        method: "POST",
        headers: buildHeaders(accessToken),
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
        headers: buildHeaders(accessToken),
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
      data?.text_content ||
      data?.message ||
      data?.detail ||
      (typeof data?.error === "string" ? data.error : data?.error?.message);

    const errorCode = normalizeErrorCode(rawErrorCode) ?? normalizeErrorCode(rawMessage);
    const message = rawMessage || getLocalizedErrorMessage(
      errorCode || "SERVER_ERROR",
      "Chat generation failed."
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

// ================================================================
// LOCAL GUEST CHAT GENERATOR (Token Streaming & Smart Responses)
// ================================================================

function generateGuestReply(question: string): string {
  const normalized = question.toLowerCase().trim();

  // 1. Greetings
  if (
    /^(hi|hello|hey|greetings|hola|namaste|good\s+(morning|afternoon|evening|day)|who\s+are\s+you|what\s+is\s+your\s+name)/i.test(
      normalized
    )
  ) {
    return (
      `Hello! 👋 Welcome to **AI Chat**.\n\n` +
      `You are currently exploring in **Guest Preview Mode**.\n\n` +
      `Here is what you can do with AI Chat:\n` +
      `• 💬 **Conversational AI:** Ask questions, brainstorm ideas, write code, and draft content.\n` +
      `• 📄 **Document & RAG Intelligence:** Upload PDFs, text documents, or spreadsheets to chat directly with your files.\n` +
      `• 🕒 **Persistent Chat History:** Save and organize multi-turn conversations across devices.\n\n` +
      `👉 **[Sign in](/login)** or **[Create a free account](/signup)** to unlock live AI generation and document analysis!`
    );
  }

  // 2. Capabilities, Features & Help
  if (
    /(what\s+can\s+you\s+do|features|help|capabilities|how\s+to\s+use|what\s+is\s+this|document|pdf|rag|upload)/i.test(
      normalized
    )
  ) {
    return (
      `### 🚀 What AI Chat Can Do\n\n` +
      `1. **📄 Document Intelligence (RAG):**\n` +
      `   Upload research papers, user manuals, contracts, or books and ask questions directly against their contents.\n\n` +
      `2. **💬 Multi-Turn Conversation:**\n` +
      `   Engage in contextual reasoning, coding assistance, and problem-solving with full conversation memory.\n\n` +
      `3. **🌐 Multilingual Interface:**\n` +
      `   Seamlessly switch between multiple supported languages.\n\n` +
      `---\n` +
      `💡 *Guest sessions are local and temporary. To test live document retrieval and keep your chat history, please **[Sign In](/login)** or **[Register](/signup)**.*`
    );
  }

  // 3. Coding & Development queries
  if (
    /(code|function|python|javascript|typescript|react|html|css|sql|bug|algorithm|api)/i.test(
      normalized
    )
  ) {
    return (
      `Here is a preview of how code formatting and syntax highlighting look in AI Chat:\n\n` +
      `\`\`\`typescript\n` +
      `// Example: Interactive Streaming Hook\n` +
      `async function streamAIResponse(prompt: string) {\n` +
      `  const response = await fetch('/api/chat', {\n` +
      `    method: 'POST',\n` +
      `    headers: { 'Content-Type': 'application/json' },\n` +
      `    body: JSON.stringify({ prompt }),\n` +
      `  });\n` +
      `  return response.body;\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `🔒 *You are currently in **Guest Preview Mode**. [Sign in](/login) or [Create an account](/signup) to chat with the live model and generate customized code solutions.*`
    );
  }

  // 4. General Queries Fallback
  return (
    `Thanks for trying **AI Chat**! 🤖\n\n` +
    `You asked:\n` +
    `> *"${question.trim()}"*\n\n` +
    `You are currently in **Guest Preview Mode**.\n\n` +
    `**To get live AI responses and save your chat history:**\n` +
    `1. 👉 **[Sign In](/login)** if you already have an account.\n` +
    `2. 👉 **[Create an Account](/signup)** for free access to real-time AI and document uploads.\n\n` +
    `*Guest mode is local and does not store conversation history.*`
  );
}

async function handleLocalGuestChat(
  question: string,
  handlers: ChatStreamHandlers
): Promise<void> {
  // Emit conversation ID for guest session
  handlers.onConversation?.("guest-session");

  const guestReply = generateGuestReply(question);

  // Split response into natural streaming chunks (words + whitespace preserved)
  const chunks = guestReply.match(/(\s+|\S+)/g) || [guestReply];

  for (let i = 0; i < chunks.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 18));
    handlers.onMessage?.(chunks[i]);
  }

  handlers.onDone?.(guestReply, "guest-session");
}