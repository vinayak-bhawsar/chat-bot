"use client";

import { Folder } from "lucide-react";

interface DocumentsButtonProps {
  collapsed: boolean;
  showText: boolean;
  open: boolean;
  onClick: () => void;
}

export default function DocumentsButton({
  collapsed,
  showText,
  open,
  onClick,
}: DocumentsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        collapsed
          ? "Documents"
          : undefined
      }
      className={`
        flex
        w-full
        items-center
        rounded-lg
        py-2.5
        text-sm
        font-medium
        transition-colors
        ${
          collapsed
            ? "justify-center px-2"
            : "gap-3 px-3"
        }
        ${
          open
            ? "bg-zinc-200 text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        }
      `}
    >
      <Folder
        className="
          h-5
          w-5
          shrink-0
        "
      />

      {!collapsed &&
      showText ? (
        <span
          className="
            truncate
          "
        >
          Documents
        </span>
      ) : null}
    </button>
  );
}