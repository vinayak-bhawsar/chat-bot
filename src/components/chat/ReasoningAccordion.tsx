"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
} from "lucide-react";
import { ChatSource } from "@/types/chat";
import { cleanDisplayName } from "@/lib/fileTypes";

export interface GroupedSource {
  documentId?: string;
  filename: string;
  pageText?: string;
  section?: string;
  citationNumber?: number | string;
  url?: string;
  rawSource: ChatSource;
}

/**
 * Deduplicates and groups sources from multiple chunks into compact cards
 * with page ranges (e.g. `Pages 10–14` or `Page 12`).
 */
export function groupSources(sources?: ChatSource[]): GroupedSource[] {
  if (!sources || sources.length === 0) return [];

  const groups = new Map<
    string,
    {
      documentId?: string;
      filename: string;
      pages: Set<number | string>;
      section?: string;
      citationNumber?: number | string;
      url?: string;
      rawSource: ChatSource;
    }
  >();

  for (const s of sources) {
    if (!s) continue;
    const filename = s.filename || s.title || "Document";
    const key = s.documentId || filename || s.url || JSON.stringify(s);

    if (!groups.has(key)) {
      groups.set(key, {
        documentId: s.documentId,
        filename,
        pages: new Set(),
        section: s.section,
        citationNumber: s.citationNumber,
        url: s.url,
        rawSource: s,
      });
    }

    const g = groups.get(key)!;
    if (s.page !== undefined && s.page !== null) g.pages.add(s.page);
    if (s.pageNumber !== undefined && s.pageNumber !== null)
      g.pages.add(s.pageNumber);
    if (Array.isArray(s.pages)) {
      s.pages.forEach((p) => g.pages.add(p));
    }
    if (!g.section && s.section) g.section = s.section;
    if (!g.citationNumber && s.citationNumber)
      g.citationNumber = s.citationNumber;
  }

  const result: GroupedSource[] = [];

  for (const g of groups.values()) {
    let pageText: string | undefined = undefined;
    if (g.pages.size > 0) {
      const numericPages = Array.from(g.pages)
        .map((p) => Number(p))
        .filter((p) => !isNaN(p) && p > 0)
        .sort((a, b) => a - b);

      if (numericPages.length === 1) {
        pageText = `Page ${numericPages[0]}`;
      } else if (numericPages.length > 1) {
        const isContiguous = numericPages.every(
          (p, idx, arr) => idx === 0 || p === arr[idx - 1] + 1
        );
        if (isContiguous && numericPages.length > 2) {
          pageText = `Pages ${numericPages[0]}–${
            numericPages[numericPages.length - 1]
          }`;
        } else {
          pageText = `Pages ${numericPages.slice(0, 3).join(", ")}${
            numericPages.length > 3 ? "..." : ""
          }`;
        }
      } else {
        const nonNumPages = Array.from(g.pages);
        pageText =
          nonNumPages.length === 1
            ? `Page ${nonNumPages[0]}`
            : `Pages ${nonNumPages.join(", ")}`;
      }
    }

    result.push({
      documentId: g.documentId,
      filename: g.filename,
      pageText,
      section: g.section,
      citationNumber: g.citationNumber,
      url: g.url,
      rawSource: g.rawSource,
    });

    if (result.length >= 4) break; // MAX_VISIBLE_SOURCES = 4
  }

  return result;
}

interface ReasoningSection {
  title: string;
  content: string;
}

/**
 * Formats inline code fragments (e.g. `search_kb`) with styled code blocks.
 */
function FormattedInlineText({ text }: { text: string }) {
  if (!text) return null;

  const parts = text.split(/(`[^`]+`)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          const code = part.slice(1, -1);
          return (
            <code
              key={index}
              className="font-mono not-italic font-bold text-slate-800 bg-slate-200/80 px-1 py-0.5 rounded text-[12px] border border-slate-300/50"
            >
              {code}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/**
 * Strictly parses real reasoning emitted by backend (raw string, JSON, or step list).
 * Returns empty array if no backend reasoning or steps are present.
 */
export function parseReasoningSections(
  rawReasoning?: string,
  reasoningSteps?: string[]
): ReasoningSection[] {
  // 1. Real raw reasoning string from backend (SSE reasoning, thought, or <think>)
  if (rawReasoning && rawReasoning.trim()) {
    const trimmed = rawReasoning.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sections: ReasoningSection[] = [];
          for (const item of parsed) {
            if (typeof item === "string" && item.trim()) {
              sections.push({ title: "Reasoning Step", content: item.trim() });
            } else if (typeof item === "object" && item !== null) {
              const title =
                item.title || item.step || item.action || item.name || "Reasoning Step";
              const content =
                item.content ||
                item.description ||
                item.detail ||
                item.text ||
                item.message ||
                JSON.stringify(item);
              sections.push({ title: String(title), content: String(content) });
            }
          }
          if (sections.length > 0) return sections.slice(0, 6);
        } else if (typeof parsed === "object" && parsed !== null) {
          const title =
            parsed.title || parsed.step || parsed.action || "Reasoning";
          const content =
            parsed.content ||
            parsed.description ||
            parsed.detail ||
            parsed.text ||
            JSON.stringify(parsed);
          return [{ title: String(title), content: String(content) }];
        }
      } catch {
        // Not JSON, continue to text parser
      }
    }

    const cleanText = rawReasoning
      .replace(/<\/?think>/gi, "")
      .replace(/^```[a-z]*\r?\n/gi, "")
      .replace(/\r?\n```$/gi, "")
      .trim();

    if (cleanText) {
      const rawParagraphs = cleanText
        .split(/(?:\r?\n){2,}|(?=^#{1,4}\s+)|(?=^\*\*[A-Z])/m)
        .map((p) => p.trim())
        .filter(Boolean);

      const sections: ReasoningSection[] = [];

      for (const paragraph of rawParagraphs) {
        const lines = paragraph
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) continue;

        let title = "";
        let content = "";

        const firstLine = lines[0];
        const headerMatch = firstLine.match(
          /^(?:#{1,4}\s+|\*\*)([^*#]+)\*\*?:?$/
        );

        if (headerMatch) {
          title = headerMatch[1].replace(/[:#*]/g, "").trim();
          content = lines.slice(1).join("\n").trim();
        } else if (
          lines.length > 1 &&
          firstLine.length < 65 &&
          (firstLine.endsWith(":") || !firstLine.includes("."))
        ) {
          title = firstLine.replace(/[:#*]/g, "").trim();
          content = lines.slice(1).join("\n").trim();
        } else {
          const fullParagraph = lines.join(" ");
          const actionMatch = fullParagraph.match(
            /^([A-Z][a-z]+ing(?:\s+[a-zA-Z0-9_\-]+){1,4}):?\s*(.*)$/
          );

          if (actionMatch && actionMatch[1].length < 45) {
            title = actionMatch[1].trim();
            content = actionMatch[2] || fullParagraph;
          } else {
            if (/search|query|look|kb|knowledge|database|retriev/i.test(fullParagraph)) {
              title =
                sections.length === 0
                  ? "Searching for details"
                  : "Searching knowledge base";
            } else if (/find|extract|attribut|spec|propert|detail/i.test(fullParagraph)) {
              title = "Finding relevant attributes";
            } else if (/analyz|evaluat|compar|process|review/i.test(fullParagraph)) {
              title = "Analyzing information";
            } else if (/generat|answer|prepar|formul|summar/i.test(fullParagraph)) {
              title = "Preparing the response";
            } else {
              title = sections.length === 0 ? "Searching for details" : `Step ${sections.length + 1}`;
            }
            content = fullParagraph;
          }
        }

        if (title || content) {
          sections.push({
            title: title || "Reasoning",
            content: content || title,
          });
        }
      }

      if (sections.length > 0) {
        return sections.slice(0, 6);
      }
    }
  }

  // 2. Real discrete steps / activities emitted by backend
  if (reasoningSteps && reasoningSteps.length > 0) {
    const sections: ReasoningSection[] = [];
    for (let i = 0; i < reasoningSteps.length; i++) {
      const step = reasoningSteps[i].trim();
      if (!step) continue;

      let title = "";
      if (/search|query|retriev/i.test(step)) {
        title = "Searching for details";
      } else if (/find|extract|attribut|chunk/i.test(step)) {
        title = "Finding relevant attributes";
      } else if (/analyz|evaluat|process/i.test(step)) {
        title = "Analyzing information";
      } else {
        title = `Step ${i + 1}`;
      }

      sections.push({
        title,
        content: step,
      });
    }
    if (sections.length > 0) {
      return sections.slice(0, 6);
    }
  }

  return [];
}

interface ReasoningAccordionProps {
  reasoning?: string;
  sources?: ChatSource[];
  activities?: string[];
  reasoningSteps?: string[];
  isStreaming?: boolean;
  hasAnswer?: boolean;
  durationSeconds?: number;
  onSourceClick?: (source: ChatSource) => void;
}

export default function ReasoningAccordion({
  reasoning,
  sources = [],
  reasoningSteps = [],
  isStreaming = false,
  hasAnswer = false,
  onSourceClick,
}: ReasoningAccordionProps) {
  const isThinkingActive = isStreaming && !hasAnswer;

  // Open by default during active streaming, auto-closed by default once generation completes
  const [isOpen, setIsOpen] = useState(isStreaming);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false);
  const prevStreamingRef = React.useRef(isStreaming);

  // Grouped sources strictly from the actual sources returned for this message
  const groupedSources = useMemo(
    () => groupSources(sources),
    [sources]
  );
  const hasSources = groupedSources.length > 0;

  // Check if real backend reasoning or steps are present
  const hasBackendReasoning = Boolean(
    (reasoning && reasoning.trim().length > 0) ||
    (reasoningSteps && reasoningSteps.length > 0)
  );

  // Parse structured sections strictly from real backend reasoning or steps
  const sections = useMemo(() => {
    return parseReasoningSections(reasoning, reasoningSteps);
  }, [reasoning, reasoningSteps]);

  const hasSections = sections.length > 0;

  // Lifecycle:
  // 1. While streaming is active -> reasoning stays OPEN by default
  // 2. When agent finishes printing the message (isStreaming: true -> false) -> auto-close by default
  useEffect(() => {
    if (isStreaming) {
      if (!hasManuallyToggled) {
        setIsOpen(true);
      }
    } else {
      if (prevStreamingRef.current) {
        setIsOpen(false);
        setHasManuallyToggled(false);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, hasManuallyToggled]);

  const handleToggle = () => {
    setHasManuallyToggled(true);
    setIsOpen((prev) => !prev);
  };

  // If actively streaming and backend reasoning has not arrived yet, ONLY show pulsing "..."
  if (isStreaming && !hasBackendReasoning) {
    return (
      <div className="my-2.5 pl-3 border-l-2 border-[#56C5D9]/50 transition-all duration-200">
        <div className="flex items-center gap-1.5 text-left text-[13px] font-medium text-[#0e879c]">
          <Brain className="h-3.5 w-3.5 text-[#56C5D9] animate-pulse shrink-0" />
          <span className="flex items-center gap-1 pl-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#56C5D9] animate-bounce [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#56C5D9] animate-bounce [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#56C5D9] animate-bounce" />
          </span>
        </div>
      </div>
    );
  }

  // If no sections from backend and no sources, do NOT render anything
  if (!isThinkingActive && !hasSections && !hasSources) {
    return null;
  }

  return (
    <div className="my-2.5 pl-3 border-l-2 border-[#56C5D9]/60 transition-all duration-200">
      {/* Header Button (Brain Icon + UI Theme Text + Chevron) */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-left text-[13px] font-semibold text-[#0e879c] hover:text-[#0b6d7e] transition-colors focus:outline-none cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <Brain className="h-4 w-4 text-[#56C5D9] shrink-0" />

        <span>{isOpen ? "Hide reasoning" : "Show reasoning"}</span>

        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 text-[#56C5D9] shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#56C5D9] shrink-0" />
        )}

        {isThinkingActive && (
          <span className="ml-1 flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#56C5D9] animate-ping" />
        )}
      </button>

      {/* Expanded Reasoning Box (Styled to match AI Chat Aqua Theme) */}
      {isOpen && (
        <div className="mt-2.5 rounded-2xl bg-[#f0fbfd]/60 p-4 sm:p-5 space-y-3.5 text-slate-800 shadow-2xs border border-[#56C5D9]/25">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <h4 className="font-bold italic text-slate-900 text-[13.5px] tracking-tight">
                {section.title}
              </h4>
              <p className="italic text-slate-600 text-[13px] leading-relaxed font-normal">
                <FormattedInlineText text={section.content} />
              </p>
            </div>
          ))}

          {/* Sources & Data Used Section */}
          {hasSources && (
            <div className={`pt-3 ${hasSections ? "border-t border-[#56C5D9]/20" : ""}`}>
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-[#0e879c] mb-2.5">
                <FileText className="h-3.5 w-3.5 text-[#56C5D9]" />
                <span>Sources & Data Used ({groupedSources.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groupedSources.map((source, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => onSourceClick?.(source.rawSource)}
                    className="group flex items-center justify-between gap-2.5 rounded-xl border border-[#56C5D9]/30 bg-white px-3 py-2.5 text-left shadow-2xs hover:border-[#56C5D9] hover:bg-[#56C5D9]/5 transition cursor-pointer"
                    title={`View ${source.filename}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#56C5D9]/10 text-[#0e879c] group-hover:bg-[#56C5D9]/20 transition-colors">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-900 group-hover:text-[#0e879c]">
                          {cleanDisplayName(source.filename, "Document")}
                        </span>
                        <span className="block truncate text-[11px] font-medium text-slate-500">
                          {source.pageText || "Page 1"}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#56C5D9] opacity-70 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
