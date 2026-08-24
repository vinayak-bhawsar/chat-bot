import { useEffect, useState } from "react";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";

export const translations = {
  en,
  de,
  es,
} as const;

export type Locale = keyof typeof translations;

export const SUPPORTED_LOCALES: Locale[] = ["en", "de", "es"];

export function isSupportedLocale(locale: string): locale is Locale {
  return locale in translations;
}

// ================================================================
// Status Code to Error Code Map
// ================================================================

export const STATUS_CODE_TO_ERROR_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  408: "GATEWAY_TIMEOUT",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMIT_EXCEEDED",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

// ================================================================
// Common Error Name / Message Alias Map
// ================================================================

const ERROR_CODE_ALIASES: Record<string, string> = {
  "failed to fetch": "NETWORK_ERROR",
  "network error": "NETWORK_ERROR",
  "networkerror": "NETWORK_ERROR",
  "connection refused": "NETWORK_ERROR",
  "load failed": "NETWORK_ERROR",
  "bad request": "BAD_REQUEST",
  "unauthorized": "UNAUTHORIZED",
  "forbidden": "FORBIDDEN",
  "not found": "NOT_FOUND",
  "conflict": "CONFLICT",
  "payload too large": "PAYLOAD_TOO_LARGE",
  "request entity too large": "PAYLOAD_TOO_LARGE",
  "unsupported media type": "UNSUPPORTED_MEDIA_TYPE",
  "validation error": "VALIDATION_ERROR",
  "unprocessable entity": "VALIDATION_ERROR",
  "rate limit exceeded": "RATE_LIMIT_EXCEEDED",
  "too many requests": "RATE_LIMIT_EXCEEDED",
  "internal server error": "INTERNAL_SERVER_ERROR",
  "bad gateway": "BAD_GATEWAY",
  "service unavailable": "SERVICE_UNAVAILABLE",
  "gateway timeout": "GATEWAY_TIMEOUT",
};

// ================================================================
// Browser language
// ================================================================

export function getBrowserLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const browserLanguage = navigator.language.toLowerCase().split("-")[0];

  if (isSupportedLocale(browserLanguage)) {
    return browserLanguage;
  }

  return "en";
}

// ================================================================
// Current language
// ================================================================

export function getLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const savedLocale = localStorage.getItem("app_locale");
    if (savedLocale && isSupportedLocale(savedLocale)) {
      return savedLocale;
    }
  } catch {
    // Ignore localStorage access errors (e.g. iframe / private mode)
  }

  return getBrowserLocale();
}

// ================================================================
// Change language
// ================================================================

export function setLocale(locale: Locale): void {
  if (!isSupportedLocale(locale)) {
    return;
  }

  try {
    localStorage.setItem("app_locale", locale);
  } catch {
    // Ignore localStorage error
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("locale:changed", {
        detail: { locale },
      })
    );
  }
}

// ================================================================
// React Hook for Reactive Locale
// ================================================================

export function useLocale(): {
  locale: Locale;
  setLocale: (newLocale: Locale) => void;
  getErrorMessage: (input?: unknown, fallback?: string) => string;
} {
  const [currentLocale, setCurrentLocale] = useState<Locale>(() => getLocale());

  useEffect(() => {
    setCurrentLocale(getLocale());

    const handleLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale?: Locale }>;
      if (customEvent.detail?.locale && isSupportedLocale(customEvent.detail.locale)) {
        setCurrentLocale(customEvent.detail.locale);
      } else {
        setCurrentLocale(getLocale());
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "app_locale" && event.newValue && isSupportedLocale(event.newValue)) {
        setCurrentLocale(event.newValue);
      }
    };

    window.addEventListener("locale:changed", handleLocaleChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("locale:changed", handleLocaleChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return {
    locale: currentLocale,
    setLocale: (newLocale: Locale) => {
      setLocale(newLocale);
      setCurrentLocale(newLocale);
    },
    getErrorMessage: (input?: unknown, fallback?: string) =>
      getLocalizedErrorMessage(input, fallback, currentLocale),
  };
}

// ================================================================
// Error Code Normalizer
// ================================================================

export function normalizeErrorCode(rawInput?: unknown): string | null {
  if (rawInput === null || rawInput === undefined) {
    return null;
  }

  // 1. Direct number (e.g. 404, 500)
  if (typeof rawInput === "number") {
    return STATUS_CODE_TO_ERROR_CODE[rawInput] || null;
  }

  // 2. Error or ApiError object
  if (typeof rawInput === "object") {
    const obj = rawInput as Record<string, unknown>;

    // errorCode property
    if (typeof obj.errorCode === "string" && obj.errorCode) {
      const resolved = normalizeErrorCode(obj.errorCode);
      if (resolved) return resolved;
    }

    // error_code property
    if (typeof obj.error_code === "string" && obj.error_code) {
      const resolved = normalizeErrorCode(obj.error_code);
      if (resolved) return resolved;
    }

    // code property
    if (typeof obj.code === "string" && obj.code) {
      const resolved = normalizeErrorCode(obj.code);
      if (resolved) return resolved;
    }

    // statusCode property
    if (typeof obj.statusCode === "number") {
      const resolved = STATUS_CODE_TO_ERROR_CODE[obj.statusCode];
      if (resolved) return resolved;
    }

    // status property
    if (typeof obj.status === "number") {
      const resolved = STATUS_CODE_TO_ERROR_CODE[obj.status];
      if (resolved) return resolved;
    }

    // message / detail property check
    if (typeof obj.message === "string" && obj.message) {
      const resolved = normalizeErrorCode(obj.message);
      if (resolved) return resolved;
    }
  }

  // 3. String input
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    // Check if numeric string ("404", "500")
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && STATUS_CODE_TO_ERROR_CODE[numeric]) {
      return STATUS_CODE_TO_ERROR_CODE[numeric];
    }

    // Upper snake_case transformation ("not_found" -> "NOT_FOUND", "bad-request" -> "BAD_REQUEST")
    const normalizedKey = trimmed
      .toUpperCase()
      .replace(/[-\s]+/g, "_");

    const validKeys = Object.keys(translations.en.errors);
    if (validKeys.includes(normalizedKey)) {
      return normalizedKey;
    }

    // Check aliases ("Failed to fetch", "not found", etc.)
    const lower = trimmed.toLowerCase();
    if (ERROR_CODE_ALIASES[lower]) {
      return ERROR_CODE_ALIASES[lower];
    }

    // Check partial alias match for common network errors
    if (lower.includes("failed to fetch") || lower.includes("network error") || lower.includes("networkerror")) {
      return "NETWORK_ERROR";
    }
  }

  return null;
}

// ================================================================
// Get translation
// ================================================================

export function getLocalizedErrorMessage(
  input?: unknown,
  fallback?: string,
  targetLocale?: Locale
): string {
  const locale = targetLocale && isSupportedLocale(targetLocale) ? targetLocale : getLocale();
  const errorCode = normalizeErrorCode(input);

  const selectedMessages = translations[locale]?.errors as Record<string, string> | undefined;
  const englishMessages = translations.en.errors as Record<string, string>;

  // 1. Found exact localized message for resolved error code
  if (errorCode && selectedMessages && selectedMessages[errorCode]) {
    return selectedMessages[errorCode];
  }

  // 2. English fallback for resolved error code
  if (errorCode && englishMessages[errorCode]) {
    return englishMessages[errorCode];
  }

  // 3. If raw input is an Error or string with a meaningful message (and not a status code or network exception)
  if (typeof input === "string" && input.trim() && !errorCode) {
    return input.trim();
  }

  if (input instanceof Error && input.message && !errorCode) {
    return input.message;
  }

  // 4. Custom fallback if provided
  if (fallback && fallback.trim()) {
    return fallback.trim();
  }

  // 5. Default localized fallback
  return selectedMessages?.UNKNOWN_ERROR || englishMessages.UNKNOWN_ERROR || "Something went wrong. Please try again.";
}