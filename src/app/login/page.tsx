"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";

import { apiRequest, clearTokens } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";

interface LoginResponse {
  success: boolean;
  status_code: number;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
  error_code: string | null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    try {
      setLoading(true);

      const data =
        await apiRequest<LoginResponse>(
          "/auth/login",
          {
            method: "POST",

            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

      // The deployed backend wraps tokens inside `data`.
      const accessToken =
        data.data?.access_token;

      const refreshToken =
        data.data?.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new Error(
          "Login succeeded but access or refresh token was not returned."
        );
      }

      // Store tokens returned by the deployed backend.
      localStorage.setItem(
        "access_token",
        accessToken
      );

      localStorage.setItem(
        "refresh_token",
        refreshToken
      );

      // Valid login → go to chat
      window.location.href = "/";

    } catch (error) {
      setError(
        getLocalizedErrorMessage(
          error,
          "Unable to login. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleContinueAsGuest() {
    clearTokens();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-10">

      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">

        <div className="w-full max-w-[420px]">

          {/* ================================================= */}
          {/* Login Card */}
          {/* ================================================= */}

          <div
            className="
              rounded-2xl
              border
              border-zinc-200
              bg-white
              p-7
              shadow-[0_8px_30px_rgba(0,0,0,0.06)]
              sm:p-8
            "
          >

            {/* ================================================= */}
            {/* Header */}
            {/* ================================================= */}

            <div className="mb-8 flex items-center gap-4">

              {/* Logo */}

              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-cyan-100
                  bg-cyan-50/60
                  shadow-2xs
                "
              >
                <BrandLogo className="h-6 w-6" />
              </div>

              {/* Heading */}

              <div>

                <h1
                  className="
                    text-[24px]
                    font-semibold
                    tracking-[-0.025em]
                    text-zinc-900
                  "
                >
                  Welcome back
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Sign in to continue to AI Chat
                </p>

              </div>

            </div>


            {/* ================================================= */}
            {/* Error */}
            {/* ================================================= */}

            {error && (
              <div
                className="
                  mb-5
                  rounded-lg
                  border
                  border-red-200
                  bg-red-50
                  px-3.5
                  py-3
                  text-sm
                  text-red-600
                "
              >
                {error}
              </div>
            )}


            {/* ================================================= */}
            {/* Form */}
            {/* ================================================= */}

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              {/* Email */}

              <div>

                <label
                  htmlFor="email"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-zinc-800
                  "
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="
                    h-11.5
                    w-full
                    rounded-lg
                    border
                    border-zinc-300
                    bg-white
                    px-3.5
                    text-sm
                    text-zinc-900
                    outline-none
                    transition
                    placeholder:text-zinc-400
                    hover:border-zinc-400
                    focus:border-zinc-500
                    focus:ring-4
                    focus:ring-zinc-900/5
                    disabled:cursor-not-allowed
                    disabled:bg-zinc-50
                  "
                />

              </div>


              {/* Password */}

              <div>

                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-zinc-800
                  "
                >
                  Password
                </label>

                <div className="relative">

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="
                      h-11.5
                      w-full
                      rounded-lg
                      border
                      border-zinc-300
                      bg-white
                      px-3.5
                      pr-11
                      text-sm
                      text-zinc-900
                      outline-none
                      transition
                      placeholder:text-zinc-400
                      hover:border-zinc-400
                      focus:border-zinc-500
                      focus:ring-4
                      focus:ring-zinc-900/5
                      disabled:cursor-not-allowed
                      disabled:bg-zinc-50
                    "
                  />

                  {/* Show / Hide Password */}

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      flex
                      h-7
                      w-7
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-md
                      text-zinc-400
                      transition
                      hover:bg-zinc-100
                      hover:text-zinc-700
                    "
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                </div>

              </div>


              {/* ================================================= */}
              {/* Login Button */}
              {/* ================================================= */}

              <button
                type="submit"
                disabled={loading}
                className="
                  h-11.5
                  w-full
                  rounded-lg
                  bg-zinc-900
                  px-4
                  text-sm
                  font-medium
                  text-white
                  shadow-sm
                  transition
                  hover:bg-zinc-800
                  active:bg-zinc-950
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {loading
                  ? "Signing in..."
                  : "Continue"}
              </button>

            </form>

            {/* ================================================= */}
            {/* Divider */}
            {/* ================================================= */}

            <div className="relative my-5 flex items-center justify-center">
              <div className="w-full border-t border-zinc-200" />
              <span className="absolute bg-white px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                or
              </span>
            </div>

            {/* ================================================= */}
            {/* Continue as Guest Button */}
            {/* ================================================= */}

            <button
              type="button"
              onClick={handleContinueAsGuest}
              disabled={loading}
              className="
                flex
                h-11.5
                w-full
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-zinc-300
                bg-white
                px-4
                text-sm
                font-medium
                text-zinc-700
                shadow-2xs
                transition
                hover:border-zinc-400
                hover:bg-zinc-50
                hover:text-zinc-900
                active:bg-zinc-100
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <User className="h-4 w-4 text-zinc-500" />
              <span>Continue as Guest</span>
            </button>

            {/* ================================================= */}
            {/* Signup */}
            {/* ================================================= */}

            <div
              className="
                mt-7
                border-t
                border-zinc-100
                pt-6
                text-center
              "
            >
              <p className="text-sm text-zinc-500">

                Don't have an account?{" "}

                <Link
                  href="/signup"
                  className="
                    font-medium
                    text-zinc-900
                    underline-offset-4
                    hover:underline
                  "
                >
                  Create an account
                </Link>

              </p>
            </div>

          </div>


          {/* Footer */}

          <p className="mt-6 text-center text-[11px] text-zinc-500">
            By continuing, you agree to our{" "}
            <span className="text-zinc-700">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="text-zinc-700">
              Privacy Policy
            </span>
            .
          </p>

        </div>

      </div>

    </main>
  );
}