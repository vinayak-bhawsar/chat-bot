"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownMessageProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Preprocesses markdown text from LLM / RAG backend to fix common formatting issues:
 * 1. Pseudo-tables (tab-separated or pipe-separated without GFM delimiters)
 * 2. Multi-line bullet points inside table cells (converts inner newlines to <br/>)
 * 3. Concatenated rows (| | -> |\n|) and trailing pipe cleanup
 * 4. Plain section titles (e.g. "Vinayak's Projects" -> "### Vinayak's Projects")
 * 5. Standalone dash/bullet points formatted as proper Markdown lists
 */
function preprocessMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 1. Normalize tabs to pipe separators if used in table headers/rows
  const lines = text.split("\n");
  const processedLines: string[] = [];

  let inTable = false;
  let tableHeaderCols = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Check if line is a tab-separated pseudo table header (e.g. `Project\tWhat it does\tKey takeaways`)
    if (line.includes("\t") && !line.includes("|")) {
      const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        line = `| ${parts.join(" | ")} |`;
      }
    }

    // Check if line looks like a pipe-separated row:
    // e.g. `Project | What it does | Key take-aways` or `| Project | ... |`
    const isPipeRow = line.includes("|") && line.split("|").length >= 3;
    const isDelimiterRow = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line);

    if (isPipeRow && !isDelimiterRow) {
      // Ensure leading and trailing pipes
      if (!line.startsWith("|")) line = `| ${line}`;
      // Remove trailing double pipes like `| |`
      line = line.replace(/\|\s*\|\s*$/, "|");
      if (!line.endsWith("|")) line = `${line} |`;

      // Check if this is a table header and next line is NOT a delimiter
      const colCount = line.split("|").length - 2;
      const nextLine = (lines[i + 1] || "").trim();
      const nextIsDelimiter = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(nextLine);

      if (!inTable) {
        inTable = true;
        tableHeaderCols = colCount;
        processedLines.push(line);

        if (!nextIsDelimiter && colCount > 0) {
          const delimiter = `| ${Array(colCount).fill("---").join(" | ")} |`;
          processedLines.push(delimiter);
        }
        continue;
      }
    } else if (isDelimiterRow) {
      inTable = true;
      processedLines.push(line);
      continue;
    } else if (inTable) {
      // If we were in a table and this line is a continuation bullet (e.g. `• Handles 100+ ...`)
      // or continuation of the previous cell before the row closes
      if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
        const lastIdx = processedLines.length - 1;
        if (lastIdx >= 0) {
          let prev = processedLines[lastIdx];
          if (prev.endsWith("|")) {
            // Re-open previous cell before closing pipe
            prev = prev.slice(0, -1).trimEnd();
            processedLines[lastIdx] = `${prev}<br/>${line} |`;
            continue;
          }
        }
      } else if (line === "") {
        inTable = false;
      }
    }

    // Check if line is a standalone title:
    // e.g. `Vinayak's Projects` or `What Vinayak focused on`
    if (
      line.length > 0 &&
      line.length < 50 &&
      !line.startsWith("#") &&
      !line.startsWith("-") &&
      !line.startsWith("*") &&
      !line.startsWith("•") &&
      !line.startsWith("|") &&
      !line.endsWith(":") &&
      !line.endsWith(".") &&
      (lines[i + 1] || "").trim().length > 0
    ) {
      const next = (lines[i + 1] || "").trim();
      // If followed by a table, list, or bullet
      if (
        next.includes("|") ||
        next.startsWith("•") ||
        next.startsWith("-") ||
        next.includes("–") ||
        next.includes(" - ")
      ) {
        line = `### ${line}`;
      }
    }

    // Convert bullet points with `•` outside tables to Markdown `- `
    if (line.startsWith("• ")) {
      line = `- ${line.slice(2).trim()}`;
    }

    // Convert `Title – Description` or `Title - Description` into `- **Title**: Description`
    if (!line.startsWith("-") && !line.startsWith("#") && !line.startsWith("|") && (line.includes(" – ") || line.includes(" - "))) {
      const separator = line.includes(" – ") ? " – " : " - ";
      const [title, ...descParts] = line.split(separator);
      if (title && title.length < 40 && descParts.length > 0) {
        line = `- **${title.trim()}**: ${descParts.join(separator).trim()}`;
      }
    }

    processedLines.push(line);
  }

  text = processedLines.join("\n");

  // 2. Fix consecutive table row boundaries: `| |` -> `|\n|`
  text = text.replace(/\|\s*\|\s*/g, "|\n|");

  // 3. Separate text after table if stuck
  text = text.replace(/\|\s*(###?\s+|[A-Z][a-zA-Z\s]+:)/g, "|\n\n$1");

  return text;
}

export default function MarkdownMessage({
  content,
  isStreaming = false,
}: MarkdownMessageProps) {
  const formattedContent = useMemo(() => {
    return preprocessMarkdown(content);
  }, [content]);

  if (!formattedContent && isStreaming) {
    return (
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
        <span className="text-sm">Thinking...</span>
      </div>
    );
  }

  return (
    <div className="markdown-content text-zinc-900 text-[14.5px] leading-relaxed break-words space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-zinc-900 mt-4 mb-2 pb-1 border-b border-zinc-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-zinc-900 mt-3.5 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-zinc-900 mt-3 mb-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wide mt-2 mb-1">
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,

          // Bold & Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-950">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-zinc-800">{children}</em>,

          // Lists
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc pl-5 space-y-1.5 text-zinc-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal pl-5 space-y-1.5 text-zinc-800">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,

          // Tables
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-2xs">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-xs sm:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-50/90 text-zinc-900 border-b border-zinc-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-zinc-100 bg-white">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-zinc-50/60 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th
              scope="col"
              className="px-3.5 py-2.5 font-semibold text-zinc-900 tracking-tight"
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 text-zinc-700 align-top leading-relaxed">
              {children}
            </td>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[12.5px] text-pink-600 font-medium border border-zinc-200/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs font-mono text-zinc-100 shadow-sm border border-zinc-800 leading-relaxed">
              {children}
            </pre>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-3 border-zinc-300 pl-3.5 italic text-zinc-600">
              {children}
            </blockquote>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700 transition"
            >
              {children}
            </a>
          ),

          // Horizontal rule
          hr: () => <hr className="my-4 border-zinc-200" />,
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}
