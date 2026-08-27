"use client";

import { useEffect } from "react";
import {
  Menu,
  Folder,
  Plus,
} from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";

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
    <div className="shrink-0 border-b border-zinc-200/80 px-3 py-3.5 space-y-2.5">
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-zinc-200/90 shadow-2xs transition-transform duration-200 hover:scale-105">
              <BrandLogo className="h-5.5 w-5.5" />
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
                <span className="rounded-md bg-[#56C5D9]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#2ba8be] border border-[#56C5D9]/25 uppercase">
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* ==========================================================
          NEW CHAT PRIMARY ACTION BUTTON (Clean White Button)
          ========================================================== */}
      <div>
        <button
          type="button"
          onClick={onNewChat}
          title={collapsed ? "New Chat (Ctrl+K)" : undefined}
          className={`group relative flex w-full items-center overflow-hidden rounded-xl font-medium transition-all duration-200 border border-zinc-200/90 bg-white text-zinc-900 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] ${
            collapsed
              ? "h-10 w-10 mx-auto justify-center"
              : "gap-2.5 px-3 py-2.5 text-sm"
          }`}
        >
          {/* Plus Icon Container */}
          <div
            className={`flex items-center justify-center shrink-0 rounded-lg bg-[#56C5D9]/10 border border-[#56C5D9]/25 text-[#2ba8be] transition-transform duration-200 group-hover:scale-105 ${
              collapsed ? "h-7 w-7" : "h-6 w-6"
            }`}
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          </div>

          {!collapsed && showText && (
            <span className="flex-1 text-left text-[13px] font-semibold tracking-tight text-zinc-900">
              New Chat
            </span>
          )}

          {!collapsed && showText && (
            <span className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500 transition-colors group-hover:bg-zinc-200/60">
              ⌘K
            </span>
          )}
        </button>
      </div>

      {/* ==========================================================
          KNOWLEDGE BASE BUTTON (Clean White Button)
          ========================================================== */}
      <div>
        <button
          type="button"
          onClick={onDocumentsClick}
          aria-expanded={documentsOpen}
          title={collapsed ? "Knowledge Base" : undefined}
          className={`flex w-full items-center rounded-xl text-xs font-medium transition-all duration-150 border active:scale-[0.98] ${
            collapsed
              ? "justify-center h-9 w-9 mx-auto"
              : "gap-2.5 px-3 py-2"
          } ${
            documentsOpen
              ? "bg-zinc-100 text-zinc-900 border-zinc-300 shadow-2xs font-semibold"
              : "border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 shadow-2xs"
          }`}
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <Folder className="h-3.5 w-3.5" />
          </div>

          {!collapsed && showText && (
            <span className="flex-1 text-left font-medium text-zinc-800">
              Knowledge Base
            </span>
          )}
        </button>
      </div>
    </div>
  );
}