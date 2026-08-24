"use client";

import {
  useLocale,
  getLocalizedErrorMessage,
  type Locale,
} from "@/i18n";
import { ApiError } from "@/lib/api";

const languages: {
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

const errorCodes = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "VALIDATION_ERROR",
  "RATE_LIMIT_EXCEEDED",
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "NETWORK_ERROR",
];

const statusCodeTests = [
  400,
  401,
  403,
  404,
  409,
  413,
  415,
  422,
  429,
  500,
  502,
  503,
  504,
];

export default function I18nTestPage() {
  const { locale, setLocale } = useLocale();

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
  };

  const handleReset = () => {
    localStorage.removeItem("app_locale");
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl">
        {/* ======================================================
            Header
        ====================================================== */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            i18n Translation & Error Test
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Test error code, status code, and ApiError translations across all supported languages.
          </p>
        </div>

        {/* ======================================================
            Current Language
        ====================================================== */}

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-medium text-zinc-500">
              Current language
            </p>

            <p className="mt-1 text-xl font-bold">
              {languages.find((lang) => lang.code === locale)?.flag}{" "}
              {languages.find((lang) => lang.code === locale)?.name}
            </p>
          </div>

          {/* ====================================================
              Language Buttons
          ==================================================== */}

          <div className="flex flex-wrap gap-3">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => handleLanguageChange(language.code)}
                className={`
                  rounded-xl
                  border
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  transition

                  ${
                    locale === language.code
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                  }
                `}
              >
                {language.flag} {language.name}
              </button>
            ))}
          </div>

          {/* ====================================================
              Reset
          ==================================================== */}

          <button
            type="button"
            onClick={handleReset}
            className="
              mt-4
              text-sm
              font-medium
              text-zinc-500
              underline
              underline-offset-4
              hover:text-zinc-900
            "
          >
            Reset language preference
          </button>
        </section>

        {/* ======================================================
            Standard Error Codes
        ====================================================== */}

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm mb-6">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-bold">
              Standard error codes
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Direct error code translations from locale JSON files.
            </p>
          </div>

          <div className="divide-y divide-zinc-100">
            {errorCodes.map((errorCode) => (
              <div
                key={errorCode}
                className="
                  grid
                  gap-2
                  px-6
                  py-4
                  sm:grid-cols-[260px_1fr]
                  sm:items-center
                "
              >
                <code
                  className="
                    w-fit
                    rounded-lg
                    bg-zinc-100
                    px-2.5
                    py-1
                    text-xs
                    font-bold
                    text-zinc-700
                  "
                >
                  {errorCode}
                </code>

                <p className="text-sm font-medium leading-6 text-zinc-800">
                  {getLocalizedErrorMessage(errorCode)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================
            HTTP Status Code Resolution
        ====================================================== */}

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm mb-6">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-bold">
              HTTP Status Code Resolution
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Raw HTTP status codes automatically mapped to localized messages.
            </p>
          </div>

          <div className="divide-y divide-zinc-100">
            {statusCodeTests.map((status) => (
              <div
                key={status}
                className="
                  grid
                  gap-2
                  px-6
                  py-4
                  sm:grid-cols-[260px_1fr]
                  sm:items-center
                "
              >
                <code
                  className="
                    w-fit
                    rounded-lg
                    bg-amber-50
                    border
                    border-amber-200
                    px-2.5
                    py-1
                    text-xs
                    font-bold
                    text-amber-800
                  "
                >
                  HTTP {status}
                </code>

                <p className="text-sm font-medium leading-6 text-zinc-800">
                  {getLocalizedErrorMessage(status)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================
            ApiError & Fallback Tests
        ====================================================== */}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">
            ApiError & Exception Tests
          </h2>

          <div className="mt-4 space-y-4">
            {/* ApiError with 401 */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                ApiError (status: 401)
              </p>
              <div className="mt-1 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium">
                {getLocalizedErrorMessage(new ApiError("Original message", 401))}
              </div>
            </div>

            {/* Network error exception */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Network exception (TypeError: Failed to fetch)
              </p>
              <div className="mt-1 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium">
                {getLocalizedErrorMessage(new TypeError("Failed to fetch"))}
              </div>
            </div>

            {/* Unknown error */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Unknown error code (default localized fallback)
              </p>
              <div className="mt-1 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium">
                {getLocalizedErrorMessage("SOME_NEW_ERROR")}
              </div>
            </div>

            {/* Empty error */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Empty / null error (default localized fallback)
              </p>
              <div className="mt-1 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium">
                {getLocalizedErrorMessage(null)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}