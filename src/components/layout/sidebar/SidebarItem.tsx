"use client";

import { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  title: string;
  icon?: LucideIcon;
  collapsed?: boolean;
  showText?: boolean;
  onClick?: () => void;
}

export default function SidebarItem({
  title,
  icon: Icon,
  collapsed = false,
  showText = true,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? title : undefined}
      className={`group flex w-full items-center rounded-xl py-2 text-xs font-medium text-zinc-700 transition-all duration-150 hover:bg-zinc-200/60 hover:text-zinc-950 ${
        collapsed ? "justify-center px-2 h-9" : "gap-2.5 px-3"
      }`}
    >
      {Icon && (
        <Icon
          size={18}
          className="h-4.5 w-4.5 shrink-0 text-zinc-500 transition-colors duration-150 group-hover:text-zinc-900"
        />
      )}

      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
          showText ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        {title}
      </span>
    </button>
  );
}