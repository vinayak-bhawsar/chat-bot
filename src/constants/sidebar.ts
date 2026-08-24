import {
  MessageSquarePlus,
  Folder,
  Settings,
} from "lucide-react";
import { SidebarItem } from "@/types/sidebar";

export const TOP_MENU: SidebarItem[] = [
  {
    id: "new-chat",
    title: "New Chat",
    icon: MessageSquarePlus,
  },
  {
    id: "projects",
    title: "Projects",
    icon: Folder,
  },
];

export const BOTTOM_MENU: SidebarItem[] = [
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
  },
];