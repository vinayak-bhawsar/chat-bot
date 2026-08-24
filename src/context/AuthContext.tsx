"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  storeTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "@/lib/api";

// ================================================================
// Types
// ================================================================

export interface User {
  id?: string;
  name?: string;
  username?: string;
  email: string;
}

interface AuthContextType {
  user: User | null;

  isAuthenticated: boolean;

  isLoading: boolean;

  login: (
    accessToken: string,
    refreshToken: string
  ) => Promise<void>;

  logout: () => void;

  checkAuth: () => Promise<void>;
}

// ================================================================
// Context
// ================================================================

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

// ================================================================
// Normalize Backend User
// ================================================================

function normalizeUser(
  response: any
): User {
  /*
   * Backend /auth/me response:
   *
   * {
   *   success: true,
   *   status_code: 200,
   *   message: "Authentication successful",
   *   data: {
   *     email: "test@example.com"
   *   }
   * }
   */

  const backendUser =
    response?.data ?? response;

  return {
    id:
      backendUser?.id ??
      backendUser?.user_id,

    name:
      backendUser?.name ??
      backendUser?.username ??
      backendUser?.email ??
      "",

    username:
      backendUser?.username,

    email:
      backendUser?.email ?? "",
  };
}

// ================================================================
// Provider
// ================================================================

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  /*
   * Authentication must start in loading state.
   *
   * While this is true:
   *
   * - Login should NOT be shown
   * - Sign Up should NOT be shown
   * - Profile should NOT be shown
   * - Logout should NOT be shown
   *
   * The application waits until authentication
   * has been determined.
   */
  const [isLoading, setIsLoading] =
    useState(true);

  /*
   * Prevent multiple authentication checks
   * from running at the same time.
   */
  const authCheckPromise =
    useRef<Promise<void> | null>(null);

  // ==============================================================
  // Check Authentication
  // ==============================================================

  const checkAuth = useCallback(
    async (): Promise<void> => {
      /*
       * If an authentication check is already
       * running, reuse it.
       *
       * This prevents duplicate /auth/me calls.
       */
      if (authCheckPromise.current) {
        return authCheckPromise.current;
      }

      const checkPromise =
        (async () => {
          setIsLoading(true);

          try {
            let accessToken =
              getAccessToken();

            const refreshToken =
              getRefreshToken();

            /*
             * If no access token but refresh token
             * is present, try refreshing first.
             */
            if (!accessToken && refreshToken) {
              try {
                console.log(
                  "No access token found, refreshing using refresh token..."
                );
                accessToken =
                  await refreshAccessToken();
              } catch (refreshErr) {
                console.log(
                  "Initial refresh failed:",
                  refreshErr
                );
                clearTokens();
                setUser(null);
                return;
              }
            }

            /*
             * No tokens available means the user
             * is definitely logged out.
             */
            if (!accessToken) {
              setUser(null);
              return;
            }

            // ----------------------------------------------------
            // Validate access token
            // ----------------------------------------------------

            const response =
              await apiRequest<any>(
                "/auth/me",
                {
                  method: "GET",
                }
              );

            // ----------------------------------------------------
            // Normalize backend response
            // ----------------------------------------------------

            const currentUser =
              normalizeUser(
                response
              );

            /*
             * Make sure the backend actually
             * returned an email.
             */
            if (!currentUser.email) {
              throw new Error(
                "Invalid user response from backend."
              );
            }

            // ----------------------------------------------------
            // Authentication successful
            // ----------------------------------------------------

            setUser(currentUser);
          } catch (error) {
            console.log(
              "Session expired or unauthenticated. User logged out."
            );

            clearTokens();
            setUser(null);
          } finally {
            /*
             * Authentication decision is complete.
             */
            setIsLoading(false);

            authCheckPromise.current =
              null;
          }
        })();

      authCheckPromise.current =
        checkPromise;

      return checkPromise;
    },
    []
  );

  // ==============================================================
  // Login
  // ==============================================================

  const login = useCallback(
    async (
      accessToken: string,
      refreshToken: string
    ): Promise<void> => {
      /*
       * Store both tokens first.
       */
      storeTokens(
        accessToken,
        refreshToken
      );

      /*
       * Keep the application in loading
       * state while we validate the newly
       * received access token.
       */
      setIsLoading(true);

      try {
        // --------------------------------------------------------
        // Ask backend for current user
        // --------------------------------------------------------

        const response =
          await apiRequest<any>(
            "/auth/me",
            {
              method: "GET",
            }
          );

        // --------------------------------------------------------
        // Normalize user
        // --------------------------------------------------------

        const currentUser =
          normalizeUser(
            response
          );

        if (!currentUser.email) {
          throw new Error(
            "Invalid user response from backend."
          );
        }

        // --------------------------------------------------------
        // Set authenticated user
        // --------------------------------------------------------

        setUser(currentUser);
      } catch (error) {
        /*
         * Login token was accepted by the login
         * endpoint but /auth/me failed.
         *
         * Clear everything so we don't leave
         * an invalid authenticated state.
         */
        clearTokens();

        setUser(null);

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ==============================================================
  // Logout
  // ==============================================================

  const logout = useCallback(() => {
    /*
     * Remove access and refresh tokens.
     */
    clearTokens();

    /*
     * Immediately remove authenticated user.
     */
    setUser(null);

    /*
     * We are no longer checking authentication.
     */
    setIsLoading(false);
  }, []);

  // ==============================================================
  // Initial Authentication Check
  // ==============================================================

  useEffect(() => {
    /*
     * Only the AuthProvider performs the initial
     * authentication check.
     *
     * AppLayout should NOT call checkAuth()
     * again on mount.
     */
    checkAuth();
  }, [checkAuth]);

  // ==============================================================
  // Context Value
  // ==============================================================

  const value: AuthContextType = {
    user,

    isAuthenticated:
      user !== null,

    isLoading,

    login,

    logout,

    checkAuth,
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ================================================================
// useAuth
// ================================================================

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}