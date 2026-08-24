"use client";

import { useEffect } from "react";
import {
  Menu,
  Sparkles,
  Folder,
  Plus,
} from "lucide-react";

interface SidebarHeaderProps {
  collapsed: boolean;
  showText: boolean;

  documentsOpen: boolean;

  onToggle: () => void;

  onNewChat: () => void;

  onDocumentsClick: () => void;
}

export default function SidebarHeader({
  collapsed,
  showText,
  documentsOpen,
  onToggle,
  onNewChat,
  onDocumentsClick,
}: SidebarHeaderProps) {
  // Global shortcut: Cmd+K / Ctrl+K or Cmd+N / Ctrl+N for New Chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "n")) {
        e.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewChat]);

  return (
    <div className="shrink-0 border-b border-zinc-200/80 px-3 py-3.5 space-y-3">
      {/* ==========================================================
          TOP HEADER & BRAND LOGO
          ========================================================== */}
      <div
        className={`flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {/* LOGO */}
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 text-white shadow-xs transition-transform duration-200 hover:scale-105">
              <Sparkles className="h-4.5 w-4.5" />
            </div>

            <div
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                showText ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <h1 className="text-[15px] font-bold tracking-tight text-zinc-900">
                  AI Chat
                </h1>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-600 border border-indigo-100/80 uppercase">
                  RAG
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-normal">
                Intelligent Assistant
              </p>
            </div>
          </div>
        )}

        {/* TOGGLE / MENU */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* ==========================================================
          NEW CHAT PRIMARY ACTION BUTTON (Vibrant Indigo Gradient)
          ========================================================== */}
      <div>
        <button
          type="button"
          onClick={onNewChat}
          title={collapsed ? "New Chat (Ctrl+K)" : undefined}
          className={`group relative flex w-full items-center overflow-hidden rounded-xl font-medium transition-all duration-200 active:scale-[0.98] ${
            collapsed
              ? "h-10 w-10 mx-auto justify-center bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-xs shadow-indigo-500/25 hover:shadow-md hover:shadow-indigo-500/35 hover:scale-105"
              : "gap-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-3 py-2.5 text-sm text-white shadow-xs shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/30 hover:brightness-105"
          }`}
        >
          {/* Subtle animated light sheen on hover */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />

          {/* Frosted Glass Icon Container */}
          <div
            className={`flex items-center justify-center shrink-0 rounded-lg bg-white/20 text-white backdrop-blur-xs transition-transform duration-200 group-hover:scale-110 ${
              collapsed ? "h-7 w-7" : "h-6 w-6"
            }`}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </div>

          {!collapsed && showText && (
            <span className="flex-1 text-left text-[13px] font-semibold tracking-tight text-white">
              New Chat
            </span>
          )}

          {!collapsed && showText && (
            <span className="flex items-center gap-0.5 rounded-md border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-medium font-mono text-white/90 backdrop-blur-xs transition-colors group-hover:bg-white/25 group-hover:border-white/40">
              ⌘K
            </span>
          )}
        </button>
      </div>

      {/* ==========================================================
          DOCUMENTS EXPLORER BUTTON
          ========================================================== */}
      <div>
        <button
          type="button"
          onClick={onDocumentsClick}
          aria-expanded={documentsOpen}
          title={collapsed ? "Knowledge Documents" : undefined}
          className={`flex w-full items-center rounded-xl text-xs font-medium transition-all duration-150 ${
            collapsed
              ? "justify-center h-9 w-9 mx-auto"
              : "gap-2.5 px-3 py-2"
          } ${
            documentsOpen
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs font-semibold"
              : "border border-zinc-200/80 bg-white/80 text-zinc-700 hover:bg-white hover:text-zinc-900 hover:border-zinc-300 shadow-2xs"
          }`}
        >
          <Folder
            className={`h-4 w-4 shrink-0 ${
              documentsOpen ? "text-indigo-600" : "text-zinc-500"
            }`}
          />

          {!collapsed && showText && (
            <span className="flex-1 text-left">Knowledge Documents</span>
          )}
        </button>
      </div>
    </div>
  );
}