"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
} from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";

import { apiRequest } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/i18n";

// ================================================================
// Types
// ================================================================

interface SignupResponse {
  success?: boolean;
  status_code?: number;
  message?: string;
  data?: {
    user_id?: string;
    username?: string;
    email?: string;
  };
  error_code?: string | null;
}

// ================================================================
// Signup Page
// ================================================================

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==============================================================
  // Signup
  // ==============================================================

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    // ------------------------------------------------------------
    // Frontend validation
    // ------------------------------------------------------------

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);

      // ----------------------------------------------------------
      // Backend request
      //
      // The deployed backend accepts ONLY:
      //
      // username
      // email
      // password
      //
      // No confirm_password is sent.
      // ----------------------------------------------------------

      const data =
        await apiRequest<SignupResponse>(
          "/auth/signup",
          {
            method: "POST",

            body: JSON.stringify({
              username: username.trim(),
              email: email.trim(),
              password,
            }),
          }
        );

      console.log(
        "Signup successful:",
        data
      );

      // ----------------------------------------------------------
      // Signup endpoint does not need
      // to log the user in automatically.
      //
      // Send the user to login after
      // successful registration.
      // ----------------------------------------------------------

      window.location.href =
        "/login";

    } catch (error) {
      setError(
        getLocalizedErrorMessage(
          error,
          "Unable to create your account. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  // ==============================================================
  // UI
  // ==============================================================

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-10">
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="w-full max-w-[420px]">

          {/* ================================================= */}
          {/* Signup Card */}
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

              <div>
                <h1
                  className="
                    text-[24px]
                    font-semibold
                    tracking-[-0.025em]
                    text-zinc-900
                  "
                >
                  Create your account
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Get started with AI Chat
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
            {/* Signup Form */}
            {/* ================================================= */}

            <form
              onSubmit={handleSignup}
              className="space-y-5"
            >

              {/* ================================================= */}
              {/* Username */}
              {/* ================================================= */}

              <div>
                <label
                  htmlFor="username"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-zinc-800
                  "
                >
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                    )
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                  minLength={2}
                  maxLength={100}
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

              {/* ================================================= */}
              {/* Email */}
              {/* ================================================= */}

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
                    setEmail(
                      event.target.value
                    )
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

              {/* ================================================= */}
              {/* Password */}
              {/* ================================================= */}

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
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
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

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous
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
              {/* Create Account Button */}
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
                  ? "Creating account..."
                  : "Create account"}
              </button>

            </form>

            {/* ================================================= */}
            {/* Login Link */}
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
                Already have an account?{" "}

                <Link
                  href="/login"
                  className="
                    font-medium
                    text-zinc-900
                    underline-offset-4
                    hover:underline
                  "
                >
                  Log in
                </Link>
              </p>
            </div>

          </div>

          {/* ================================================= */}
          {/* Footer */}
          {/* ================================================= */}

          <p className="mt-6 text-center text-[11px] text-zinc-500">
            By creating an account, you agree to our{" "}
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
