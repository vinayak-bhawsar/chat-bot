"use client";

import { useEffect, useState } from "react";
import SidebarHeader from "./sidebar/SidebarHeader";
import DocumentsPanel from "./sidebar/DocumentsPanel";
import RecentChats from "./sidebar/RecentChats";
import SidebarFooter from "./sidebar/SidebarFooter";
import { Conversation } from "@/types/chat";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectChat: (conversationId: string) => void;
  onDeleteChat: (conversationId: string) => void;
  deletingConversationId: string | null;
}

export default function Sidebar({
  mobileOpen,
  onMobileClose,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  deletingConversationId,
}: SidebarProps) {
  // Main sidebar state
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(true);

  // Document sidebar state
  const [documentsOpen, setDocumentsOpen] = useState(false);

  // Show text after sidebar expands
  useEffect(() => {
    if (collapsed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowText(true);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [collapsed]);

  // Mobile body scroll
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      // Close document sidebar first
      if (documentsOpen) {
        setDocumentsOpen(false);
        return;
      }

      // Otherwise close mobile sidebar
      if (mobileOpen) {
        onMobileClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [documentsOpen, mobileOpen, onMobileClose]);

  // Toggle main sidebar
  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onMobileClose();
      return;
    }

    if (collapsed) {
      setCollapsed(false);
      setShowText(true);
      return;
    }

    setDocumentsOpen(false);
    setShowText(false);

    window.setTimeout(() => {
      setCollapsed(true);
    }, 150);
  };

  // Documents button toggle
  const handleDocumentsClick = () => {
    if (collapsed) {
      setCollapsed(false);
      setShowText(true);

      window.setTimeout(() => {
        setDocumentsOpen(true);
      }, 200);

      return;
    }

    setDocumentsOpen((previous) => !previous);
  };

  // Close documents panel
  const handleDocumentsClose = () => {
    setDocumentsOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-zinc-200 bg-[#f7f7f8] transition-all duration-300 ease-in-out ${
          documentsOpen ? "w-72 sm:w-80" : collapsed ? "w-20" : "w-72"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:translate-x-0`}
      >
        {documentsOpen ? (
          <DocumentsPanel
            open={documentsOpen}
            onClose={handleDocumentsClose}
          />
        ) : (
          <div className="flex h-full flex-col">
            <SidebarHeader
              collapsed={collapsed}
              showText={showText}
              documentsOpen={documentsOpen}
              onToggle={toggleSidebar}
              onNewChat={onNewChat}
              onDocumentsClick={handleDocumentsClick}
            />

            <div className="min-h-0 flex-1">
              <RecentChats
                collapsed={collapsed}
                showText={showText}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectChat={onSelectChat}
                onDeleteChat={onDeleteChat}
                deletingConversationId={deletingConversationId}
              />
            </div>

            <SidebarFooter collapsed={collapsed} showText={showText} />
          </div>
        )}
      </aside>
    </>
  );
}