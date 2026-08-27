export type FileCategory =
  | "image"
  | "pdf"
  | "text"
  | "word"
  | "excel"
  | "powerpoint"
  | "code"
  | "archive"
  | "file";

export function getFileCategory(
  filename?: string | null,
  mimeType?: string | null
): FileCategory {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";

  if (!filename) return "file";
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif", "tiff"].includes(ext)) {
    return "image";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  if (["txt", "md", "markdown", "log", "rtf", "nfo"].includes(ext)) {
    return "text";
  }
  if (["csv", "tsv", "xls", "xlsx", "ods"].includes(ext)) {
    return "excel";
  }
  if (["doc", "docx", "odt"].includes(ext)) {
    return "word";
  }
  if (["ppt", "pptx", "odp"].includes(ext)) {
    return "powerpoint";
  }
  if (
    [
      "json",
      "xml",
      "html",
      "htm",
      "css",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "c",
      "cs",
      "sql",
      "sh",
      "bash",
      "yaml",
      "yml",
      "graphql",
      "php",
      "rb",
      "go",
      "rs",
    ].includes(ext)
  ) {
    return "code";
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
    return "archive";
  }

  return "file";
}

export function getFileDetails(
  filename?: string | null,
  mimeType?: string | null
) {
  const category = getFileCategory(filename, mimeType);
  const ext = (filename?.split(".").pop() || "").toUpperCase();

  switch (category) {
    case "image":
      return {
        category,
        label: ext ? `${ext} Image` : "Image",
        badge: ext || "IMG",
        colorClass: "border-blue-100 bg-blue-50 text-blue-600",
        borderHover: "hover:border-blue-300",
        pillBg: "bg-blue-50 border-blue-200 text-blue-700",
      };
    case "pdf":
      return {
        category,
        label: "PDF Document",
        badge: "PDF",
        colorClass: "border-red-100 bg-red-50 text-red-600",
        borderHover: "hover:border-red-300",
        pillBg: "bg-red-50 border-red-200 text-red-700",
      };
    case "text":
      return {
        category,
        label: ext === "MD" ? "Markdown Document" : "Text Document",
        badge: ext || "TXT",
        colorClass: "border-emerald-100 bg-emerald-50 text-emerald-600",
        borderHover: "hover:border-emerald-300",
        pillBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
      };
    case "code":
      return {
        category,
        label: ext ? `${ext} Source File` : "Code File",
        badge: ext || "CODE",
        colorClass: "border-violet-100 bg-violet-50 text-violet-600",
        borderHover: "hover:border-violet-300",
        pillBg: "bg-violet-50 border-violet-200 text-violet-700",
      };
    case "excel":
      return {
        category,
        label: ext === "CSV" ? "CSV Data" : "Spreadsheet",
        badge: ext || "XLS",
        colorClass: "border-teal-100 bg-teal-50 text-teal-600",
        borderHover: "hover:border-teal-300",
        pillBg: "bg-teal-50 border-teal-200 text-teal-700",
      };
    case "word":
      return {
        category,
        label: "Word Document",
        badge: ext || "DOC",
        colorClass: "border-sky-100 bg-sky-50 text-sky-600",
        borderHover: "hover:border-sky-300",
        pillBg: "bg-sky-50 border-sky-200 text-sky-700",
      };
    case "powerpoint":
      return {
        category,
        label: "Presentation",
        badge: ext || "PPT",
        colorClass: "border-amber-100 bg-amber-50 text-amber-600",
        borderHover: "hover:border-amber-300",
        pillBg: "bg-amber-50 border-amber-200 text-amber-700",
      };
    case "archive":
      return {
        category,
        label: "Archive File",
        badge: ext || "ZIP",
        colorClass: "border-purple-100 bg-purple-50 text-purple-600",
        borderHover: "hover:border-purple-300",
        pillBg: "bg-purple-50 border-purple-200 text-purple-700",
      };
    default:
      return {
        category: "file" as const,
        label: ext ? `${ext} File` : "Attached Document",
        badge: ext || "FILE",
        colorClass: "border-zinc-200 bg-zinc-100 text-zinc-700",
        borderHover: "hover:border-zinc-400",
        pillBg: "bg-zinc-100 border-zinc-200 text-zinc-800",
      };
  }
}

/**
 * Sanitizes filenames and document labels so that raw UUIDs, MongoDB IDs,
 * or backend IDs are never displayed in the chat interface.
 */
export function cleanDisplayName(
  filename?: string | null,
  fallback = "Document"
): string {
  if (!filename || typeof filename !== "string") return fallback;
  const trimmed = filename.trim();
  if (!trimmed) return fallback;

  // 1. Check if the entire name is a UUID (with or without extension)
  const fullUuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(\.[a-zA-Z0-9]+)?$/i;
  if (fullUuidPattern.test(trimmed)) {
    const ext = trimmed.includes(".") ? trimmed.slice(trimmed.lastIndexOf(".")).toLowerCase() : "";
    if (ext === ".pdf") return "Document.pdf";
    if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return `Image${ext}`;
    if ([".docx", ".doc"].includes(ext)) return `Document${ext}`;
    if ([".xlsx", ".xls", ".csv"].includes(ext)) return `Spreadsheet${ext}`;
    if ([".txt", ".md"].includes(ext)) return `Text Document${ext}`;
    if ([".json", ".ts", ".js", ".py", ".sql"].includes(ext)) return `Code${ext}`;
    if (ext) return `Document${ext}`;
    return fallback;
  }

  // 2. Check if the name has a leading UUID prefix like `c3463679-255f-44d2-86ce-d3d8f330fe5e_Quarterly_Report.pdf`
  const prefixUuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-](.+)$/i;
  const prefixMatch = trimmed.match(prefixUuidPattern);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1];
  }

  return trimmed;
}
