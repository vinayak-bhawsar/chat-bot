"use client";

import { useState } from "react";
import {
  Globe,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
} from "lucide-react";

import SidebarItem from "./SidebarItem";
import { useAuth } from "@/context/AuthContext";
import { useLocale, type Locale } from "@/i18n";

interface SidebarFooterProps {
  collapsed: boolean;
  showText: boolean;
}

const LANGUAGES: {
  code: Locale;
  name: string;
  flag: string;
}[] = [
  {
    code: "en",
    name: "English",
    flag: "🇬🇧",
  },
  {
    code: "de",
    name: "Deutsch",
    flag: "🇩🇪",
  },
  {
    code: "es",
    name: "Español",
    flag: "🇪🇸",
  },
];

export default function SidebarFooter({
  collapsed,
  showText,
}: SidebarFooterProps) {
  const {
    user,
    isAuthenticated,
    isLoading,
    logout,
  } = useAuth();

  const { locale, setLocale } = useLocale();

  // ==============================================================
  // SETTINGS OPEN / CLOSE
  // ==============================================================

  const [settingsOpen, setSettingsOpen] = useState(false);

  // ==============================================================
  // TOGGLE SETTINGS
  // ==============================================================

  const handleSettings = () => {
    setSettingsOpen((previous) => !previous);
  };

  // ==============================================================
  // LOGIN / SIGNUP / LOGOUT
  // ==============================================================

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleSignup = () => {
    window.location.href = "/signup";
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // ==============================================================
  // USER DISPLAY NAME
  // ==============================================================

  const displayName =
    user?.name?.trim() ||
    user?.username?.trim() ||
    user?.email ||
    "User";

  // ==============================================================
  // RENDER
  // ==============================================================

  return (
    <div className="shrink-0 border-t border-zinc-200/80 bg-[#f7f7f8] p-2.5 space-y-1.5">
      {/* ========================================================
          USER PROFILE CARD (Authenticated) OR GUEST PROMPT (Unauthenticated)
          ======================================================== */}
      {isLoading ? null : isAuthenticated && user ? (
        !collapsed ? (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-2xs">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-zinc-900 leading-tight">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] text-zinc-500 font-medium truncate">
                    {user.email || "Active User"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSettings}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  settingsOpen
                    ? "bg-zinc-200 text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                }`}
                title="Settings & Language"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSettings}
            title={displayName}
            className="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-2xs hover:scale-105 transition-transform"
          >
            {displayName.charAt(0).toUpperCase()}
          </button>
        )
      ) : (
        /* GUEST MODE: Sign In button + Settings */
        <div className="space-y-1">
          {!collapsed ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLogin}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={handleSettings}
                title="Settings & Language"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/80 bg-white transition-colors ${
                  settingsOpen
                    ? "bg-zinc-200 text-zinc-900 border-zinc-300"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              title="Sign In"
              className="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-zinc-900 text-white shadow-2xs hover:bg-zinc-800 transition-colors"
            >
              <LogIn className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ========================================================
          SETTINGS / AUTH / LANGUAGE DROPDOWN
          ======================================================== */}
      {settingsOpen && (
        <div className="pt-2 pb-1 space-y-2 border-t border-zinc-200/80 mt-1">
          {/* Language Selector */}
          {!collapsed && (
            <div className="rounded-xl border border-zinc-200/70 bg-white p-2 shadow-2xs">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <Globe className="h-3 w-3 text-zinc-400" />
                  Language
                </span>
                <span className="text-[10px] font-medium text-zinc-400">
                  {LANGUAGES.find((l) => l.code === locale)?.name}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {LANGUAGES.map((lang) => {
                  const isActive = locale === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLocale(lang.code)}
                      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                        isActive
                          ? "bg-zinc-900 text-white shadow-2xs"
                          : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200/60"
                      }`}
                    >
                      <span className="text-xs">{lang.flag}</span>
                      <span>{lang.code.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auth Action Items */}
          {isLoading ? null : !isAuthenticated ? (
            <div className="space-y-1">
              <SidebarItem
                title="Create Account"
                icon={UserPlus}
                collapsed={collapsed}
                showText={showText}
                onClick={handleSignup}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <SidebarItem
                title="Logout"
                icon={LogOut}
                collapsed={collapsed}
                showText={showText}
                onClick={handleLogout}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}