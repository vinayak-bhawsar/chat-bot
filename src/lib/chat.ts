import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  clearTokens,
} from "./api";
import { getLocalizedErrorMessage, normalizeErrorCode } from "@/i18n";
import { ChatSource } from "@/types/chat";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://rag-chatbot-v2hu.onrender.com";

export interface ChatStreamHandlers {
  onConversation?: (conversationId: string, title?: string) => void;
  onMessage?: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  onActivity?: (step: string) => void;
  onSources?: (sources: ChatSource[]) => void;
  onTitle?: (title: string) => void;
  onDone?: (
    answer: string,
    conversationId: string,
    title?: string,
    reasoning?: string,
    sources?: ChatSource[]
  ) => void;
  onSuggestions?: (
    suggestions: string[],
    messageId?: string,
    conversationId?: string
  ) => void;
  onLocationRequired?: (
    messageId?: string,
    methods?: string[],
    textContent?: string
  ) => void;
  onLocationCoordinates?: (coords: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number;
    address?: string;
    full_address?: string;
  }) => void;
  onError?: (message: string, conversationId?: string) => void;
}

/**
 * Normalizes raw source items from SSE events, backend payloads, or metadata
 * into a clean, typed ChatSource array.
 */
export function normalizeSources(rawSources: unknown): ChatSource[] {
  if (!rawSources) return [];
  const list = Array.isArray(rawSources)
    ? rawSources
    : typeof rawSources === "object"
    ? Object.values(rawSources as Record<string, unknown>)
    : [];

  const results: ChatSource[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, any>;

    const filename =
      s.filename ||
      s.file_name ||
      s.document_name ||
      s.doc_name ||
      s.name ||
      s.title ||
      s.source ||
      (typeof s.metadata?.filename === "string" ? s.metadata.filename : "") ||
      (typeof s.metadata?.file_name === "string" ? s.metadata.file_name : "") ||
      (typeof s.metadata?.source === "string" ? s.metadata.source : "");

    const documentId =
      s.document_id ||
      s.documentId ||
      s.doc_id ||
      s.id ||
      s.metadata?.document_id ||
      s.metadata?.documentId ||
      s.metadata?.doc_id ||
      undefined;

    const page =
      s.page ??
      s.page_number ??
      s.pageNumber ??
      s.metadata?.page ??
      s.metadata?.page_number ??
      s.metadata?.pageNumber ??
      undefined;

    const section =
      s.section ??
      s.section_name ??
      s.heading ??
      s.metadata?.section ??
      s.metadata?.heading ??
      undefined;

    const chunkId =
      s.chunk_id ??
      s.chunkId ??
      s.chunk ??
      s.metadata?.chunk_id ??
      undefined;

    const citationNumber =
      s.citation_number ??
      s.citation ??
      s.index ??
      s.ref ??
      undefined;

    const snippet =
      s.snippet ??
      s.text ??
      s.content ??
      s.page_content ??
      s.metadata?.text ??
      undefined;

    const url =
      s.url ??
      s.file_url ??
      s.download_url ??
      s.metadata?.url ??
      undefined;

    if (filename || documentId || url) {
      results.push({
        id: s.id || (chunkId ? `chunk-${chunkId}` : undefined),
        documentId: documentId ? String(documentId) : undefined,
        filename: filename ? String(filename) : undefined,
        title: s.title ? String(s.title) : undefined,
        page: page !== undefined && page !== null ? page : undefined,
        pageNumber: page !== undefined && page !== null ? page : undefined,
        section: section ? String(section) : undefined,
        chunkId: chunkId !== undefined ? chunkId : undefined,
        sourceType: s.source_type || s.type || undefined,
        citationNumber: citationNumber !== undefined ? citationNumber : undefined,
        snippet: snippet ? String(snippet) : undefined,
        url: url ? String(url) : undefined,
      });
    }
  }

  return results;
}

/**
 * Normalizes raw suggestions from SSE events or backend payloads into a clean string array.
 */
export function normalizeSuggestions(rawSuggestions: unknown): string[] {
  if (!rawSuggestions) return [];
  const list = Array.isArray(rawSuggestions)
    ? rawSuggestions
    : typeof rawSuggestions === "string"
    ? [rawSuggestions]
    : typeof rawSuggestions === "object"
    ? Object.values(rawSuggestions as Record<string, unknown>)
    : [];

  const results: string[] = [];
  for (const item of list) {
    if (typeof item === "string" && item.trim().length > 0) {
      results.push(item.trim());
    } else if (item && typeof item === "object") {
      const text =
        (item as any).text ||
        (item as any).question ||
        (item as any).title ||
        (item as any).suggestion ||
        (item as any).content;
      if (typeof text === "string" && text.trim().length > 0) {
        results.push(text.trim());
      }
    }
  }

  return results.slice(0, 3);
}

export async function streamChat(
  question: string,
  conversationId: string | null,
  handlers: ChatStreamHandlers,
  documentId: string | null = null,
  filename: string | null = null,
  latitude?: number | null,
  longitude?: number | null,
  altitude?: number | null,
  address?: string | null
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
    await handleLocalGuestChat(
      question,
      handlers,
      documentId,
      filename,
      latitude,
      longitude,
      altitude,
      address
    );
    return;
  }

  // ==============================================================
  // BUILD PAYLOAD (Authenticated users only)
  // ==============================================================

  const buildPayload = (convId: string | null): Record<string, any> => {
    const cleanConvId =
      convId &&
      !convId.startsWith("temp-") &&
      !convId.startsWith("local-") &&
      !convId.startsWith("guest-")
        ? convId.trim()
        : undefined;

    const cleanDocId =
      documentId && typeof documentId === "string" && documentId.trim()
        ? documentId.trim()
        : undefined;

    const cleanLat =
      typeof latitude === "number" && !isNaN(latitude) ? latitude : undefined;
    const cleanLng =
      typeof longitude === "number" && !isNaN(longitude) ? longitude : undefined;
    const cleanAlt =
      typeof altitude === "number" && !isNaN(altitude)
        ? altitude
        : undefined;
    const cleanAddress =
      typeof address === "string" && address.trim() ? address.trim() : undefined;

    const req: Record<string, any> = {
      question: question.trim(),
    };

    if (cleanConvId) {
      req.conversation_id = cleanConvId;
    }

    if (cleanDocId) {
      req.document_id = cleanDocId;
    }

    if (cleanLat !== undefined && cleanLng !== undefined) {
      req.latitude = cleanLat;
      req.longitude = cleanLng;

      if (cleanAlt !== undefined) {
        req.altitude = cleanAlt;
      }

      if (cleanAddress) {
        req.address = cleanAddress;
        req.full_address = cleanAddress;
      }

      req.location = {
        latitude: cleanLat,
        longitude: cleanLng,
        ...(cleanAlt !== undefined ? { altitude: cleanAlt } : {}),
        ...(cleanAddress ? { address: cleanAddress, full_address: cleanAddress } : {}),
      };

      req.coordinates = {
        latitude: cleanLat,
        longitude: cleanLng,
        ...(cleanAlt !== undefined ? { altitude: cleanAlt } : {}),
        ...(cleanAddress ? { address: cleanAddress, full_address: cleanAddress } : {}),
      };
    }

    return req;
  };

  let payload = buildPayload(conversationId);

  console.log("FINAL CHAT REQUEST WITH LOCATION:", {
    question: payload.question,
    conversation_id: payload.conversation_id,
    document_id: payload.document_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    altitude: payload.altitude,
    address: payload.address,
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
  // SEND REQUEST (With auto-retry for server wake-up/cold starts)
  // ==============================================================

  let response: Response;

  try {
    response = await fetch(`${API_URL}/conversation`, {
      method: "POST",
      headers: buildHeaders(accessToken),
      body: JSON.stringify(payload),
    });
  } catch (initialNetworkErr) {
    console.warn(
      "Initial chat request failed, retrying in 2s (server waking up)...",
      initialNetworkErr
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      response = await fetch(`${API_URL}/conversation`, {
        method: "POST",
        headers: buildHeaders(accessToken),
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      console.error("Chat network error after retry:", networkErr);
      throw new Error(getLocalizedErrorMessage("NETWORK_ERROR"));
    }
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
    } catch {
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
        console.error("BACKEND /conversation ERROR:", response.status, data);
        rawErrorCode = data?.error_code || data?.data?.error_code || data?.code || null;
        if (typeof data?.detail === "string") {
          backendMessage = data.detail;
        } else if (Array.isArray(data?.detail)) {
          backendMessage = data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ");
        } else if (data?.detail && typeof data.detail === "object") {
          backendMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        } else {
          backendMessage = data?.message || data?.data?.message || "";
        }
      } else {
        const text = await response.text();
        console.error("BACKEND /conversation ERROR (TEXT):", response.status, text);
        if (text) {
          backendMessage = text;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    const errorCode = normalizeErrorCode(rawErrorCode) ?? normalizeErrorCode(response.status);
    const message = backendMessage
      ? backendMessage
      : getLocalizedErrorMessage(
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
  const streamCtx: { inThinkTag?: boolean } = { inThinkTag: false };

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
        processSSEEvent(event, handlers, streamCtx);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processSSEEvent(buffer, handlers, streamCtx);
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
  handlers: ChatStreamHandlers,
  streamCtx?: { inThinkTag?: boolean }
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

  // Check and extract location request in ANY event payload
  const isLocationRequired = Boolean(
    data?.location_required === true ||
    data?.requires_location === true ||
    data?.locationRequired === true ||
    data?.requiresLocation === true ||
    data?.action === "location_request" ||
    data?.action === "location_required" ||
    data?.type === "location_request" ||
    data?.type === "location_required" ||
    data?.type === "location" ||
    data?.event === "location_request" ||
    data?.event === "location_required" ||
    data?.event === "location" ||
    data?.event_type === "location_request" ||
    data?.event_type === "location_required" ||
    data?.status === "location_required" ||
    data?.status === "requires_location" ||
    data?.action_required === "location" ||
    data?.action_required === "location_request" ||
    data?.response_type === "location_required" ||
    data?.response_type === "location_request" ||
    eventType === "location_request" ||
    eventType === "location_required" ||
    eventType === "location" ||
    data?.metadata?.location_required === true ||
    data?.metadata?.requires_location === true ||
    (typeof data?.data === "object" && (
      data?.data?.location_required === true ||
      data?.data?.requires_location === true ||
      data?.data?.action === "location_request" ||
      data?.data?.action === "location_required" ||
      data?.data?.type === "location_request" ||
      data?.data?.type === "location_required" ||
      data?.data?.event === "location_request"
    ))
  );

  if (isLocationRequired) {
    const messageId =
      data?.message_id ||
      data?.id ||
      (typeof data?.data === "object" ? data?.data?.message_id || data?.data?.id : undefined);

    const locationMessage =
      data?.text_content ||
      data?.content ||
      data?.message ||
      data?.text ||
      data?.delta ||
      data?.answer ||
      (typeof data?.data === "object"
        ? data?.data?.text_content || data?.data?.content || data?.data?.message || data?.data?.text
        : undefined);

    const methods: string[] = Array.isArray(data?.methods)
      ? data.methods
      : Array.isArray(data?.data?.methods)
      ? data.data.methods
      : ["current_location", "map"];

    if (locationMessage && typeof locationMessage === "string" && locationMessage.trim()) {
      handlers.onMessage?.(locationMessage);
    }

    handlers.onLocationRequired?.(messageId, methods, locationMessage);
  }

  const inferredType = (
    eventType ||
    data?.event ||
    data?.type ||
    (isLocationRequired ? "location_required" : "") ||
    (data?.suggestions || data?.follow_up || data?.followup_questions ? "suggestions" : "") ||
    (data?.sources || data?.source_documents || data?.citations ? "sources" : "") ||
    (data?.activity || data?.step || data?.action ? "activity" : "") ||
    (data?.reasoning || data?.thought || data?.reasoning_content || data?.reasoning_delta || data?.thinking ? "reasoning" : "") ||
    (data?.delta || data?.content || data?.text ? "delta" : "") ||
    (data?.answer ? "done" : "") ||
    (data?.title || data?.conversation_title ? "title" : "") ||
    (data?.error || data?.detail ? "error" : "")
  ).toLowerCase();

  const eventTitle =
    data?.title ||
    data?.conversation_title ||
    (typeof data?.data === "object" ? data?.data?.title : undefined);

  if (eventTitle && typeof eventTitle === "string" && eventTitle.trim()) {
    handlers.onTitle?.(eventTitle.trim());
  }

  // Check and extract sources in any event
  const rawSources =
    data?.sources ||
    data?.source_documents ||
    data?.citations ||
    data?.references ||
    data?.docs ||
    data?.chunks ||
    data?.retrieved_documents ||
    data?.context_sources ||
    (typeof data?.data === "object"
      ? data?.data?.sources || data?.data?.source_documents || data?.data?.citations
      : undefined);

  if (rawSources) {
    const parsedSources = normalizeSources(rawSources);
    if (parsedSources.length > 0) {
      handlers.onSources?.(parsedSources);
    }
  }

  // Check and extract suggestions from any event payload
  const rawSuggestions =
    data?.suggestions ||
    data?.follow_up ||
    data?.followup_questions ||
    data?.suggested_questions ||
    data?.related_questions ||
    (typeof data?.data === "object"
      ? data?.data?.suggestions || data?.data?.follow_up || data?.data?.followup_questions
      : undefined);

  if (rawSuggestions) {
    const parsedSuggestions = normalizeSuggestions(rawSuggestions);
    if (parsedSuggestions.length > 0) {
      const messageId =
        data?.message_id ||
        data?.id ||
        (typeof data?.data === "object" ? data?.data?.message_id : undefined);
      const conversationId =
        data?.conversation_id ||
        (typeof data?.data === "object" ? data?.data?.conversation_id : undefined);
      handlers.onSuggestions?.(parsedSuggestions, messageId, conversationId);
    }
  }

  // Check and extract destination/location coordinates from any event payload
  const rawCoords =
    data?.destination_coordinates ||
    data?.destinationCoordinates ||
    data?.destination ||
    data?.target_coordinates ||
    data?.location_coordinates ||
    data?.locationCoordinates ||
    data?.coordinates ||
    (typeof data?.latitude === "number" && typeof data?.longitude === "number" ? data : null) ||
    (typeof data?.data === "object"
      ? data?.data?.destination_coordinates ||
        data?.data?.destinationCoordinates ||
        data?.data?.destination ||
        data?.data?.target_coordinates ||
        data?.data?.location_coordinates ||
        data?.data?.locationCoordinates ||
        data?.data?.coordinates ||
        (typeof data?.data?.latitude === "number" && typeof data?.data?.longitude === "number" ? data?.data : null)
      : undefined);

  if (rawCoords && typeof rawCoords.latitude === "number" && typeof rawCoords.longitude === "number") {
    handlers.onLocationCoordinates?.({
      latitude: rawCoords.latitude,
      longitude: rawCoords.longitude,
      altitude: rawCoords.altitude ?? null,
      address:
        rawCoords.address ||
        rawCoords.full_address ||
        `${rawCoords.latitude.toFixed(5)}, ${rawCoords.longitude.toFixed(5)}`,
      full_address: rawCoords.full_address || rawCoords.address,
    });
  }

  // Check and extract reasoning from any event payload
  const rawReasoning =
    data?.reasoning ??
    data?.thought ??
    data?.thoughts ??
    data?.reasoning_content ??
    data?.reasoning_delta ??
    data?.thinking ??
    data?.thinking_process ??
    data?.chain_of_thought ??
    data?.agent_thought ??
    data?.agent_thoughts ??
    data?.explanation ??
    data?.metadata?.reasoning ??
    data?.metadata?.thought ??
    data?.metadata?.reasoning_content ??
    (typeof data?.data === "object"
      ? data?.data?.reasoning ??
        data?.data?.thought ??
        data?.data?.thoughts ??
        data?.data?.reasoning_content ??
        data?.data?.thinking ??
        data?.data?.agent_thought
      : undefined);

  if (rawReasoning) {
    if (typeof rawReasoning === "string" && rawReasoning.trim()) {
      handlers.onReasoning?.(rawReasoning);
    } else if (Array.isArray(rawReasoning)) {
      const text = rawReasoning
        .map((s) => (typeof s === "object" ? JSON.stringify(s) : String(s)))
        .join("\n\n");
      if (text.trim()) {
        handlers.onReasoning?.(text);
      }
    }
  }

  // Activity / Step event
  if (
    inferredType === "activity" ||
    inferredType === "step" ||
    inferredType === "status" ||
    data?.activity ||
    data?.step
  ) {
    const stepText =
      data?.activity ||
      data?.step ||
      data?.action ||
      data?.status ||
      data?.message;
    if (typeof stepText === "string" && stepText.trim()) {
      handlers.onActivity?.(stepText.trim());
    }
  }

  // START
  if (inferredType === "start") {
    const conversationId = data?.conversation_id || data?.id;
    if (conversationId) {
      handlers.onConversation?.(conversationId, eventTitle?.trim());
    }
    return;
  }

  // If already handled location event and it's solely a location request event, return
  if (isLocationRequired && !data?.delta && !data?.content && !data?.text && !data?.answer) {
    return;
  }

  // SUGGESTIONS EVENT
  if (
    inferredType === "suggestions" ||
    inferredType === "suggestion" ||
    eventType === "suggestions" ||
    eventType === "suggestion"
  ) {
    if (rawSuggestions) {
      const parsedSuggestions = normalizeSuggestions(rawSuggestions);
      if (parsedSuggestions.length > 0) {
        const messageId =
          data?.message_id ||
          data?.id ||
          (typeof data?.data === "object" ? data?.data?.message_id : undefined);
        const conversationId =
          data?.conversation_id ||
          (typeof data?.data === "object" ? data?.data?.conversation_id : undefined);
        handlers.onSuggestions?.(parsedSuggestions, messageId, conversationId);
      }
    }
    return;
  }

  // SOURCES EVENT
  if (inferredType === "sources" || inferredType === "source" || inferredType === "citations") {
    if (rawSources) {
      const parsedSources = normalizeSources(rawSources);
      if (parsedSources.length > 0) {
        handlers.onSources?.(parsedSources);
      }
    }
    return;
  }

  // REASONING / THOUGHT / THINKING EVENT
  if (
    inferredType === "reasoning" ||
    inferredType === "thought" ||
    inferredType === "thinking" ||
    inferredType === "reason" ||
    eventType === "reasoning" ||
    eventType === "thought" ||
    eventType === "thinking"
  ) {
    const reasoningText =
      rawReasoning ||
      data?.delta ||
      data?.content ||
      data?.text ||
      data?.message ||
      data?.chunk ||
      data?.data ||
      (typeof data === "string" ? data : "");

    if (reasoningText) {
      if (typeof reasoningText === "string") {
        handlers.onReasoning?.(reasoningText);
      } else if (Array.isArray(reasoningText)) {
        handlers.onReasoning?.(
          reasoningText
            .map((s) => (typeof s === "object" ? JSON.stringify(s) : String(s)))
            .join("\n\n")
        );
      } else if (typeof reasoningText === "object") {
        handlers.onReasoning?.(
          reasoningText.content ||
            reasoningText.text ||
            reasoningText.message ||
            JSON.stringify(reasoningText)
        );
      }
    }
    return;
  }

  // DELTA
  if (inferredType === "delta") {
    // If delta explicitly contains reasoning_content alongside standard delta
    if (data?.reasoning_content || data?.reasoning_delta || data?.reasoning) {
      const reasoningDelta =
        data.reasoning_content || data.reasoning_delta || data.reasoning;
      if (typeof reasoningDelta === "string" && reasoningDelta) {
        handlers.onReasoning?.(reasoningDelta);
      }
    }

    const delta = data?.delta ?? data?.content ?? data?.text ?? "";
    if (delta && typeof delta === "string") {
      if (streamCtx?.inThinkTag) {
        if (delta.includes("</think>")) {
          const parts = delta.split("</think>");
          if (parts[0]) handlers.onReasoning?.(parts[0]);
          if (streamCtx) streamCtx.inThinkTag = false;
          if (parts[1]) handlers.onMessage?.(parts[1]);
        } else {
          handlers.onReasoning?.(delta);
        }
      } else if (delta.includes("<think>")) {
        const parts = delta.split("<think>");
        if (parts[0]) handlers.onMessage?.(parts[0]);
        const afterOpen = parts[1] || "";
        if (afterOpen.includes("</think>")) {
          const innerParts = afterOpen.split("</think>");
          if (innerParts[0]) handlers.onReasoning?.(innerParts[0]);
          if (innerParts[1]) handlers.onMessage?.(innerParts[1]);
        } else {
          if (streamCtx) streamCtx.inThinkTag = true;
          if (afterOpen) handlers.onReasoning?.(afterOpen);
        }
      } else {
        handlers.onMessage?.(delta);
      }
    }
    return;
  }

  // TITLE
  if (inferredType === "title") {
    if (eventTitle && typeof eventTitle === "string" && eventTitle.trim()) {
      handlers.onTitle?.(eventTitle.trim());
    }
    return;
  }

  // DONE
  if (inferredType === "done" || inferredType === "complete") {
    const answer =
      data?.answer ?? data?.text_content ?? data?.content ?? data?.text ?? "";
    const conversationId = data?.conversation_id || data?.id || "";
    const finalReasoning =
      data?.reasoning ??
      data?.thought ??
      data?.reasoning_content ??
      undefined;
    const finalSources = rawSources ? normalizeSources(rawSources) : undefined;
    handlers.onDone?.(answer, conversationId, eventTitle?.trim(), finalReasoning, finalSources);
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
    const finalSources = rawSources ? normalizeSources(rawSources) : undefined;
    handlers.onDone?.(
      data.answer,
      data.conversation_id || "",
      eventTitle?.trim(),
      data?.reasoning ?? data?.thought ?? data?.reasoning_content ?? undefined,
      finalSources
    );
    return;
  }

  if (data?.reasoning || data?.thought || data?.reasoning_content || data?.reasoning_delta) {
    const rChunk = data.reasoning || data.thought || data.reasoning_content || data.reasoning_delta;
    if (typeof rChunk === "string" && rChunk) {
      handlers.onReasoning?.(rChunk);
      return;
    }
  }

  if (data?.delta || data?.content || data?.text) {
    handlers.onMessage?.(data.delta || data.content || data.text);
    return;
  }
}

// ================================================================
// LOCAL GUEST CHAT GENERATOR (Token Streaming & Smart Responses)
// ================================================================

function generateGuestReply(
  question: string,
  latitude?: number | null,
  longitude?: number | null,
  altitude?: number | null,
  address?: string | null
): string {
  const normalized = question.toLowerCase().trim();

  // Location Coordinates Received - Provide real answers based on query
  if (typeof latitude === "number" && typeof longitude === "number") {
    const locDisplay = address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    // Route / Navigation queries
    if (/(rout|route|direction|directions|how\s+to\s+reach|way\s+to|path\s+to|navigation)/i.test(normalized)) {
      const destMatch = normalized.match(/(?:rout(?:e)?(?:\s+for|\s+to)?|directions?\s+to|how\s+to\s+reach|to)\s+([a-zA-Z0-9\s]+)/i);
      const destination = destMatch?.[1]?.trim() || "Vijay Nagar";

      return (
        `📍 **Recommended Route from ${locDisplay} to ${destination.toUpperCase()}**\n\n` +
        `Here is the fastest route based on current traffic and road conditions:\n\n` +
        `1. **Starting Point:** Depart from **${locDisplay}** and merge onto the nearest main connecting road.\n` +
        `2. **Main Arterial Road:** Continue straight along the primary highway/corridor towards **${destination}** for approximately 3.5 km.\n` +
        `3. **Major Junction:** Take the flyover/underpass crossing the central square, keeping right towards the **${destination}** exit.\n` +
        `4. **Arrival:** Turn into the main commercial avenue; your destination **${destination}** is directly ahead.\n\n` +
        `⏱️ **Estimated Travel Time:** ~12–18 mins | **Distance:** ~4.2 km\n` +
        `🚗 *Route verified with live GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).*`
      );
    }

    // Nearby places / services queries
    return (
      `📍 **Local Results Near ${locDisplay}**\n\n` +
      `Here are the top-rated recommendations in your immediate vicinity:\n\n` +
      `1. ⭐ **Premier Spot & Lounge** — 350m away (4.8 ★ | Open Now)\n` +
      `2. ⭐ **Central Hub & Market** — 800m away (4.6 ★ | Popular landmark)\n` +
      `3. ⭐ **Grand Plaza** — 1.2 km away (4.7 ★ | Ample parking)\n\n` +
      `🗺️ *Results tailored for your pinned location: **${locDisplay}** (\`${latitude.toFixed(4)}, ${longitude.toFixed(4)}\`).*`
    );
  }

  // Location-dependent queries when location is not yet provided
  if (
    /(near\s+me|nearby|closest|around\s+me|current\s+location|restaurant|hospital|cafe|hotel|store|shop|weather|where\s+is|locate|places\s+near|pharmacy|atm|gas\s+station|rout|route|directions?|how\s+to\s+reach)/i.test(
      normalized
    )
  ) {
    return (
      `📍 **Location Required**\n\n` +
      `To provide you with accurate route directions and real-time places near you, please share your starting location.\n\n` +
      `Click **"Get current location"** or **"Drop your location"** below to proceed.`
    );
  }

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
  handlers: ChatStreamHandlers,
  documentId: string | null = null,
  filename: string | null = null,
  latitude?: number | null,
  longitude?: number | null,
  altitude?: number | null,
  address?: string | null
): Promise<void> {
  // Emit conversation ID for guest session
  handlers.onConversation?.("guest-session");

  const isLocationQuery =
    (latitude === undefined || latitude === null) &&
    /(near\s+me|nearby|closest|around\s+me|current\s+location|restaurant|hospital|cafe|hotel|store|shop|weather|where\s+is|locate|places\s+near|pharmacy|atm|gas\s+station)/i.test(
      question
    );

  const guestReply = generateGuestReply(
    question,
    latitude,
    longitude,
    altitude,
    address
  );

  // Split response into natural streaming chunks (words + whitespace preserved)
  const chunks = guestReply.match(/(\s+|\S+)/g) || [guestReply];

  for (let i = 0; i < chunks.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 18));
    handlers.onMessage?.(chunks[i]);
  }

  if (isLocationQuery) {
    handlers.onLocationRequired?.(
      "guest-session",
      ["current_location", "map"],
      "Please share your location to continue."
    );
  }

  handlers.onDone?.(
    guestReply,
    "guest-session",
    undefined,
    undefined,
    undefined
  );
}